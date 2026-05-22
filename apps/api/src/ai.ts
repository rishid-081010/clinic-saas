import { BookingRequest, Doctor, Faq, KnowledgeChunk, Organization } from "./types.js";
import { structuredAiResponseSchema } from "./schemas.js";
import { vertexEmbedText, vertexGenerateContent } from "./vertex.js";

const safetyWords = ["chest pain", "chest tightness", "breathing difficulty", "faint", "unconscious", "severe bleeding"];

export function isSafetyConcern(message: string) {
  const normalized = message.toLowerCase();
  return safetyWords.some((word) => normalized.includes(word));
}

export function detectIntent(message: string) {
  const text = message.toLowerCase();
  if (text.includes("book") || text.includes("appointment") || text.includes("doctor")) return "Booking";
  if (text.includes("insurance") || text.includes("cashless")) return "Insurance";
  if (text.includes("fee") || text.includes("price") || text.includes("cost")) return "Pricing";
  if (text.includes("time") || text.includes("open") || text.includes("hours")) return "Clinic Timing";
  if (text.includes("location") || text.includes("address") || text.includes("parking")) return "Location";
  return "General FAQ";
}

export function suggestDoctor(reason: string, doctors: Doctor[]) {
  const text = reason.toLowerCase();
  const specialty =
    text.includes("child") || text.includes("fever")
      ? "Pediatrics"
      : text.includes("knee") || text.includes("joint") || text.includes("bone")
        ? "Orthopedics"
        : text.includes("skin") || text.includes("acne")
          ? "Dermatology"
          : "General Medicine";

  const doctor = doctors.find((item) => item.active && item.specialty === specialty);
  return { specialty, doctorName: doctor?.name };
}

const bookingWidgetReply = "I'd be happy to help you schedule an appointment. Please fill out this form below.";

export async function embedText(text: string) {
  return vertexEmbedText(text);
}

export async function retrieveKnowledge(message: string, chunks: KnowledgeChunk[], faqs: Faq[], organization: Organization) {
  const queryEmbedding = await embedText(message);
  const faqChunks = faqs
    .filter((faq) => faq.active)
    .map((faq) => `${faq.question}\n${faq.answer}`);
  const clinicChunks = [
    [
        `Clinic name: ${organization.name}`,
        `Address: ${organization.address}`,
        `Phone: ${organization.phone}`,
        `Email: ${organization.email}`,
        `Opening days: ${organization.openingDays}`,
        `Opening hours: ${describeOpeningHours(organization.openingHours)}`,
        `Parking: ${organization.parkingInfo}`,
        `Insurance: ${organization.insuranceInfo}`,
        `Fees: ${organization.consultationFeeInfo}`,
      ].join("\n"),
  ];

  const vectorMatches = chunks
    .filter((chunk) => chunk.embedding.length > 0)
    .map((chunk) => ({
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.text);

  const lexicalMatches = retrieveLexical(message, [...clinicChunks, ...faqChunks]);
  return [...vectorMatches, ...lexicalMatches].slice(0, 6);
}

function describeOpeningHours(value: string) {
  try {
    const rows = JSON.parse(value) as Array<{ day: string; startTime: string; endTime: string }>;
    if (Array.isArray(rows) && rows.length) {
      return rows.map((row) => `${row.day}: ${row.startTime}-${row.endTime}`).join(", ");
    }
  } catch {
    // Keep legacy plain-text opening hours.
  }
  return value;
}

export async function answerWithLocalLlm(message: string, context: string[]) {
  const prompt = [
    "You are a clinic FAQ and appointment assistant.",
    "Answer only using the verified clinic context below.",
    "Do not give diagnosis, treatment, or emergency medical advice.",
    "If the answer is not in context, say you do not have verified information and staff will review it.",
    "",
    "Verified clinic context:",
    context.join("\n---\n"),
    "",
    `Patient question: ${message}`,
  ].join("\n");

  try {
    return await vertexGenerateContent(prompt, { temperature: 0.2 }) || fallbackAnswer(context);
  } catch {
    return fallbackAnswer(context);
  }
}

export async function answerWithStructuredAi(input: {
  message: string;
  context: string[];
  recentMessages: Array<{ sender: string; text: string }>;
  organization: Organization;
}) {
  const prompt = buildStructuredPrompt(input);
  const fallback = structuredAiResponseSchema.parse({
    reply: input.context.length
      ? fallbackAnswer(input.context)
      : "I do not have verified clinic information for that yet. I have marked this for staff review.",
    actions: input.context.length ? [] : [{ type: "ESCALATE_CHAT", payload: { reason: "No verified knowledge matched", urgency: "normal" } }],
    flags: { intent: "general", escalated: !input.context.length, urgency: "normal" },
  });

  const raw = await callChatModel(prompt);
  const parsed = parseStructuredResponse(raw);
  if (parsed) return parsed;

  const retryRaw = await callChatModel(`${prompt}\n\nYour previous response was invalid. Return valid JSON only.`);
  return parseStructuredResponse(retryRaw) ?? fallback;
}

export function bookingConfirmationText(booking: BookingRequest) {
  return `Thanks ${booking.patientName}. Your appointment request for ${booking.suggestedSpecialty} on ${booking.preferredDate} at ${booking.preferredTime} has been sent to the clinic staff for confirmation.`;
}

export async function detectBookingIntentWithAi(message: string, recentMessages: Array<{ sender: string; text: string }>) {
  const prompt = [
    "Classify whether the latest patient message is asking to make an appointment immediately.",
    "Return only valid JSON.",
    JSON.stringify({
      wantsBooking: "boolean",
      reply: "exact required patient-facing response if wantsBooking is true, otherwise empty string",
    }),
    "",
    "Set wantsBooking=true only when the latest message clearly means the user wants to book/schedule/request an appointment now.",
    "Examples that are true: I want to book an appointment, book me for tomorrow, yes I want an appointment, schedule a visit, can I make a booking.",
    "Set wantsBooking=false for greetings, thanks, general questions, clinic timing/location/insurance questions, and symptom-only messages.",
    "Examples that are false: hi, hello, thanks, I have knee pain, my child has fever, do you accept insurance, what are your timings.",
    "If the user only mentions a symptom without asking to book, wantsBooking must be false. The normal assistant can ask whether they want appointment help.",
    "Use the recent chat only as context. The latest message must still show immediate booking intent or confirmation.",
    `If wantsBooking=true, reply must be exactly: ${bookingWidgetReply}`,
    "",
    "Recent chat:",
    recentMessages.map((item) => `${item.sender}: ${item.text}`).join("\n"),
    "",
    `Latest patient message: ${message}`,
  ].join("\n");

  const raw = await callChatModel(prompt);
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as { wantsBooking?: boolean; reply?: string };
    return {
      wantsBooking: parsed.wantsBooking === true,
      reply: parsed.wantsBooking === true ? bookingWidgetReply : "",
    };
  } catch {
    const fallback = /\b(book|booking|appointment|schedule|reserve)\b/i.test(message) || /\b(yes|yeah|yep|sure|ok)\b.*\b(appointment|booking|book|schedule)\b/i.test(message);
    return {
      wantsBooking: fallback,
      reply: fallback ? bookingWidgetReply : "",
    };
  }
}

export async function suggestDoctorWithAi(input: { reason: string; patientAge?: number; doctors: Doctor[] }) {
  const activeDoctors = input.doctors.filter((doctor) => doctor.active);
  const prompt = [
    "Suggest the best doctor for an appointment request from this clinic roster.",
    "Return only valid JSON.",
    JSON.stringify({
      doctorName: "exact doctor name from roster",
      reason: "short explanation",
    }),
    "",
    `Patient age: ${input.patientAge ?? "not provided"}`,
    `Issue/reason: ${input.reason}`,
    "",
    "Doctor roster:",
    activeDoctors.map((doctor) => [
      `Name: ${doctor.name}`,
      `Qualification: ${doctor.qualification}`,
      `Specialty: ${doctor.specialty}`,
      `Schedule: ${doctor.schedule.map((slot) => `${slot.day} ${slot.startTime}-${slot.endTime}`).join(", ")}`,
    ].join("\n")).join("\n---\n"),
  ].join("\n");

  const raw = await callChatModel(prompt);
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as { doctorName?: string; reason?: string };
    const doctor = activeDoctors.find((item) => item.name.toLowerCase() === parsed.doctorName?.toLowerCase());
    if (doctor) return { doctorName: doctor.name, specialty: doctor.specialty, reason: parsed.reason || `Best match for ${doctor.specialty}.` };
  } catch {
    // Fallback below.
  }

  const fallback = suggestDoctor(input.reason, activeDoctors);
  return {
    doctorName: fallback.doctorName ?? activeDoctors[0]?.name ?? "",
    specialty: fallback.specialty,
    reason: "Matched using clinic specialty rules.",
  };
}

export async function checkBookingAvailabilityWithAi(input: {
  booking: Pick<BookingRequest, "patientName" | "patientAge" | "patientPhone" | "reason" | "suggestedDoctor" | "preferredDate" | "preferredTime">;
  doctor: Doctor;
  existingBookings: BookingRequest[];
  availableTimings: string[];
  appointmentMinutes?: number;
}) {
  const appointmentMinutes = input.appointmentMinutes ?? 30;
  const requestedSlotAvailable = input.availableTimings.includes(input.booking.preferredTime);
  const prompt = [
    "Task: check_booking",
    "You are checking clinic appointment slot availability.",
    "Return only valid JSON. No markdown. No extra text.",
    JSON.stringify({
      available: "boolean",
      message: "patient-facing message",
      availableTimings: ["HH:mm"],
    }),
    "",
    "Rules:",
    `- Average appointment duration is ${appointmentMinutes} minutes.`,
    "- The requested slot is available only if it appears in availableTimings.",
    "- If available=true, confirm the requested slot in the message.",
    "- If available=false, say the requested slot is not available and include the available timings.",
    "- Use HH:mm time format only.",
    "",
    "Booking details:",
    JSON.stringify(input.booking),
    "",
    "Doctor:",
    JSON.stringify({
      name: input.doctor.name,
      specialty: input.doctor.specialty,
      qualification: input.doctor.qualification,
      schedule: input.doctor.schedule,
    }),
    "",
    "Existing bookings for this doctor on this date:",
    JSON.stringify(input.existingBookings.map((booking) => ({
      patientName: booking.patientName,
      preferredDate: booking.preferredDate,
      preferredTime: booking.preferredTime,
      status: booking.status,
    }))),
    "",
    "Available timings:",
    JSON.stringify(input.availableTimings),
  ].join("\n");

  const raw = await callChatModel(prompt);
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as {
      available?: boolean;
      message?: string;
      availableTimings?: string[];
    };
    const available = parsed.available === true && requestedSlotAvailable;
    return {
      available,
      message: buildAvailabilityMessage(available, input.booking.preferredTime, input.availableTimings, parsed.message),
      availableTimings: normalizeAiTimings(parsed.availableTimings, input.availableTimings),
    };
  } catch {
    return {
      available: requestedSlotAvailable,
      message: buildAvailabilityMessage(requestedSlotAvailable, input.booking.preferredTime, input.availableTimings),
      availableTimings: input.availableTimings,
    };
  }
}

function buildAvailabilityMessage(available: boolean, requestedTime: string, availableTimings: string[], aiMessage?: string) {
  if (available) {
    return aiMessage?.trim() || `Your appointment slot at ${requestedTime} is available and has been confirmed.`;
  }

  const timings = availableTimings.length ? availableTimings.join(", ") : "no slots available for this day";
  return `That slot is not available. Available timings for this doctor are: ${timings}.`;
}

function normalizeAiTimings(value: unknown, allowedTimings: string[]) {
  if (!Array.isArray(value)) return allowedTimings;
  const filtered = value.filter((item): item is string => typeof item === "string" && allowedTimings.includes(item));
  return filtered.length ? filtered : allowedTimings;
}

async function callChatModel(prompt: string) {
  try {
    return await vertexGenerateContent(prompt, { temperature: 0.1, responseMimeType: "application/json" });
  } catch {
    return "";
  }
}

function buildStructuredPrompt(input: {
  message: string;
  context: string[];
  recentMessages: Array<{ sender: string; text: string }>;
  organization: Organization;
}) {
  return [
    "You are a clinic FAQ and appointment assistant.",
    "Return only valid JSON. No markdown. No extra text.",
    "Schema:",
    JSON.stringify({
      reply: "string shown to the patient",
      actions: [
        {
          type: "ESCALATE_CHAT",
          payload: {},
        },
      ],
      flags: {
        intent: "faq | booking | escalation | general | safety",
        escalated: false,
        urgency: "low | normal | high",
      },
    }),
    "",
    "Rules:",
    "- Answer only from verified clinic context.",
    "- Do not give diagnosis, treatment, or emergency medical advice.",
    "- If the user is angry, stuck, asks for a human, or the answer is not verified, add ESCALATE_CHAT.",
    "- Do not open, trigger, or mention internal booking widgets in this response.",
    "- If the user mentions symptoms but does not clearly ask to book, answer safely and ask whether they want appointment help.",
    "- For emergency/safety concerns, escalate with urgency high and use the clinic emergency notice.",
    "",
    "Clinic:",
    `${input.organization.name} | ${input.organization.phone} | ${input.organization.address}`,
    `Emergency notice: ${input.organization.emergencyNotice}`,
    "",
    "Current date/time:",
    getCurrentDateContext(),
    "",
    "Verified clinic context:",
    input.context.join("\n---\n") || "No matching verified context.",
    "",
    "Recent chat:",
    input.recentMessages.map((message) => `${message.sender}: ${message.text}`).join("\n"),
    "",
    `Latest patient message: ${input.message}`,
  ].join("\n");
}

function getCurrentDateContext() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });
  return `${formatter.format(now)} Asia/Kolkata. Use this to resolve relative booking dates and times.`;
}

function parseStructuredResponse(raw: string) {
  if (!raw.trim()) return null;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    return structuredAiResponseSchema.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

function fallbackAnswer(context: string[]) {
  if (!context.length) {
    return "I do not have verified clinic information for that yet. I have marked this for staff review.";
  }

  return `Based on the clinic's verified information: ${context[0].replace(/\s+/g, " ").slice(0, 450)}`;
}

function retrieveLexical(message: string, chunks: string[]) {
  const tokens = tokenize(message);
  return chunks
    .map((text) => ({
      text,
      score: tokens.reduce((score, token) => score + (text.toLowerCase().includes(token) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.text);
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let aMag = 0;
  let bMag = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aMag += a[index] * a[index];
    bMag += b[index] * b[index];
  }

  if (!aMag || !bMag) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function tokenize(message: string) {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}
