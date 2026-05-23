import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import bcrypt from "bcryptjs";
import Fastify from "fastify";
import path from "node:path";
import { answerWithStructuredAi, bookingConfirmationText, checkBookingAvailabilityWithAi, detectBookingIntentWithAi, detectIntent, isSafetyConcern, retrieveKnowledge, suggestDoctor, suggestDoctorWithAi, embedText } from "./ai.js";
import { authenticate, requireRole } from "./auth.js";
import { config, isSupabaseConfigured } from "./config.js";
import { chunkText, extractText } from "./documents.js";
import {
  bookingRequestSchema,
  bookingStatusSchema,
  chatStatusSchema,
  clinicDetailsSchema,
  clinicProfileItemSchema,
  customizationRequestSchema,
  doctorSuggestionSchema,
  doctorSchema,
  faqSchema,
  loginSchema,
  memberRoleSchema,
  publicChatMessageSchema,
  signupSchema,
  staffMessageSchema,
} from "./schemas.js";
import { getDb, id, loadDb, now, saveDb } from "./store.js";
import { BookingRequest, Chat, ChatMessage, Doctor, KnowledgeFile } from "./types.js";

const app = Fastify({ logger: true });

await loadDb();

await app.register(cors, {
  origin: process.env.FRONTEND_ORIGIN ?? true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-only-change-me",
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

if (process.env.SERVE_FRONTEND === "true") {
  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), process.env.FRONTEND_DIST ?? "frontend-review/dist"),
    prefix: "/",
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }

    return reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: "Not Found",
      statusCode: 404,
    });
  });
}

app.get("/health", async () => ({ ok: true, service: "patient-engagement-api" }));

app.post("/api/auth/login", async (request, reply) => {
  const body = loginSchema.parse(request.body);
  const user = getDb().users.find((item) => item.email.toLowerCase() === body.email.toLowerCase());

  if (!user || !bcrypt.compareSync(body.password, user.passwordHash)) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const token = app.jwt.sign({ userId: user.id }, { expiresIn: "8h" });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { token, user: safeUser };
});

app.post("/api/auth/signup", async (request, reply) => {
  const body = signupSchema.parse(request.body);
  const db = getDb();
  const organization = db.organizations[0];
  if (!organization) return reply.code(500).send({ error: "No organization configured" });

  const existing = db.users.find((item) => item.email.toLowerCase() === body.email.toLowerCase());
  if (existing) {
    return reply.code(409).send({ error: "Account already exists" });
  }

  const user = {
    id: id("usr"),
    organizationId: organization.id,
    name: body.name,
    email: body.email,
    passwordHash: bcrypt.hashSync(body.password, 10),
    role: "L2_ADMIN" as const,
  };
  db.users.push(user);
  await saveDb();

  const token = app.jwt.sign({ userId: user.id }, { expiresIn: "8h" });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { token, user: safeUser, organization };
});

app.get("/api/auth/me", { preHandler: authenticate }, async (request) => {
  const db = getDb();
  const organization = db.organizations.find((item) => item.id === request.userContext!.organizationId);
  return { user: request.userContext!.user, organization };
});

app.get("/api/l2/members", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  return getDb().users
    .filter((item) => item.organizationId === orgId)
    .map(({ passwordHash: _passwordHash, ...user }) => user);
});

app.patch("/api/l2/members/:id/role", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const memberId = (request.params as { id: string }).id;
  if (memberId === request.userContext!.user.id) {
    return reply.code(400).send({ error: "You cannot change your own role from this menu" });
  }

  const body = memberRoleSchema.parse(request.body);
  const member = getDb().users.find((item) => item.id === memberId && item.organizationId === orgId);
  if (!member) return reply.code(404).send({ error: "Member not found" });

  member.role = body.role;
  await audit(request.userContext!.user.id, orgId, "member.role.updated", "member", member.id);
  await saveDb();
  const { passwordHash: _passwordHash, ...safeMember } = member;
  return safeMember;
});

app.get("/api/l2/overview", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  const db = getDb();
  const chats = db.chats.filter((item) => item.organizationId === orgId);
  const bookings = db.bookings.filter((item) => item.organizationId === orgId);

  return {
    totalChats: chats.length,
    unresolvedChats: chats.filter((item) => item.status === "unresolved").length,
    bookingRequests: bookings.filter((item) => item.status === "pending" || item.status === "follow_up_needed").length,
    confirmedAppointments: bookings.filter((item) => item.status === "confirmed").length,
    unreadNotifications: db.notifications.filter((item) => item.organizationId === orgId && !item.read).length,
  };
});

app.get("/api/l2/chats", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  const status = (request.query as { status?: string }).status;
  return getDb().chats
    .filter((item) => item.organizationId === orgId)
    .filter((item) => !status || item.status === status)
    .map(({ messages: _messages, ...chat }) => chat);
});

app.get("/api/l2/chats/:id", { preHandler: authenticate }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const chat = getDb().chats.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!chat) return reply.code(404).send({ error: "Chat not found" });
  return chat;
});

app.get("/api/l2/live-chats", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  return getDb().chats
    .filter((item) => item.organizationId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

app.patch("/api/l2/live-chats/:id/take-over", { preHandler: requireRole(["L2_ADMIN", "L2_ASSISTANT"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const chat = getDb().chats.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!chat) return reply.code(404).send({ error: "Chat not found" });
  chat.aiPaused = true;
  chat.status = "unresolved";
  chat.unresolvedReason = "Staff takeover";
  await audit(request.userContext!.user.id, orgId, "chat.ai_paused", "chat", chat.id);
  await saveDb();
  return chat;
});

app.patch("/api/l2/live-chats/:id/hand-over-ai", { preHandler: requireRole(["L2_ADMIN", "L2_ASSISTANT"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const chat = getDb().chats.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!chat) return reply.code(404).send({ error: "Chat not found" });
  chat.aiPaused = false;
  await audit(request.userContext!.user.id, orgId, "chat.ai_resumed", "chat", chat.id);
  await saveDb();
  return chat;
});

app.post("/api/l2/live-chats/:id/staff-message", { preHandler: requireRole(["L2_ADMIN", "L2_ASSISTANT"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const body = staffMessageSchema.parse(request.body);
  const chat = getDb().chats.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!chat) return reply.code(404).send({ error: "Chat not found" });
  if (!chat.aiPaused) return reply.code(409).send({ error: "Take over the chat before sending staff messages" });

  const message: ChatMessage = {
    id: id("msg"),
    chatId: chat.id,
    sender: "staff",
    text: body.message,
    createdAt: now(),
  };
  chat.messages.push(message);
  await audit(request.userContext!.user.id, orgId, "chat.staff_message.created", "chat", chat.id);
  await saveDb();
  return message;
});

app.patch("/api/l2/chats/:id/status", { preHandler: requireRole(["L2_ADMIN", "L2_ASSISTANT"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const body = chatStatusSchema.parse(request.body);
  const chat = getDb().chats.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!chat) return reply.code(404).send({ error: "Chat not found" });
  chat.status = body.status;
  await audit(request.userContext!.user.id, orgId, "chat.status.updated", "chat", chat.id);
  await saveDb();
  return chat;
});

app.get("/api/l2/booking-requests", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  return getDb().bookings.filter((item) => item.organizationId === orgId && item.status !== "confirmed");
});

app.get("/api/l2/confirmed-appointments", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  return getDb().bookings.filter((item) => item.organizationId === orgId && item.status === "confirmed");
});

app.patch("/api/l2/booking-requests/:id/status", { preHandler: requireRole(["L2_ADMIN", "L2_ASSISTANT"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const body = bookingStatusSchema.parse(request.body);
  const booking = getDb().bookings.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!booking) return reply.code(404).send({ error: "Booking request not found" });

  booking.status = body.status;
  if (body.status === "confirmed") booking.confirmedAt = now();
  await audit(request.userContext!.user.id, orgId, "booking.status.updated", "booking", booking.id);
  await saveDb();
  return booking;
});

app.delete("/api/l2/bookings/:id", { preHandler: requireRole(["L2_ADMIN", "L2_ASSISTANT"]) }, async (request, reply) => {
  const orgId = request.userContext!.organizationId;
  const bookingId = (request.params as { id: string }).id;
  const booking = getDb().bookings.find((item) => item.id === bookingId && item.organizationId === orgId);
  if (!booking) return reply.code(404).send({ error: "Booking not found" });

  getDb().bookings = getDb().bookings.filter((item) => item.id !== bookingId);
  await audit(request.userContext!.user.id, orgId, "booking.deleted", "booking", bookingId);
  await saveDb();
  return { ok: true };
});

app.get("/api/l2/faqs", { preHandler: authenticate }, async (request) => {
  return getDb().faqs.filter((item) => item.organizationId === request.userContext!.organizationId);
});

app.post("/api/l2/faqs", { preHandler: requireRole(["L2_ADMIN"]) }, async (request) => {
  const body = faqSchema.parse(request.body);
  const faq = { id: id("faq"), organizationId: request.userContext!.organizationId, ...body, updatedAt: now() };
  getDb().faqs.unshift(faq);
  await upsertFaqKnowledgeChunk(faq.organizationId, faq.id, faq.question, faq.answer, request.userContext!.user.id);
  await audit(request.userContext!.user.id, faq.organizationId, "faq.created", "faq", faq.id);
  await saveDb();
  return faq;
});

app.patch("/api/l2/faqs/:id", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const body = faqSchema.partial().parse(request.body);
  const faq = getDb().faqs.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === request.userContext!.organizationId);
  if (!faq) return reply.code(404).send({ error: "FAQ not found" });
  Object.assign(faq, body, { updatedAt: now() });
  if (body.question || body.answer || body.active !== undefined) {
    getDb().knowledgeChunks = getDb().knowledgeChunks.filter((item) => !(item.sourceType === "faq" && item.sourceId === faq.id));
    if (faq.active) {
      await upsertFaqKnowledgeChunk(faq.organizationId, faq.id, faq.question, faq.answer, request.userContext!.user.id);
    }
  }
  await audit(request.userContext!.user.id, faq.organizationId, "faq.updated", "faq", faq.id);
  await saveDb();
  return faq;
});

app.delete("/api/l2/faqs/:id", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const db = getDb();
  const orgId = request.userContext!.organizationId;
  const faq = db.faqs.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!faq) return reply.code(404).send({ error: "FAQ not found" });
  db.faqs = db.faqs.filter((item) => item.id !== faq.id);
  db.knowledgeChunks = db.knowledgeChunks.filter((item) => !(item.sourceType === "faq" && item.sourceId === faq.id));
  await audit(request.userContext!.user.id, orgId, "faq.deleted", "faq", faq.id);
  await saveDb();
  return { ok: true };
});

app.get("/api/l2/doctors", { preHandler: authenticate }, async (request) => {
  return getDb().doctors.filter((item) => item.organizationId === request.userContext!.organizationId);
});

app.post("/api/l2/doctors", { preHandler: requireRole(["L2_ADMIN"]) }, async (request) => {
  const body = doctorSchema.parse(request.body);
  const doctor = { id: id("doc"), organizationId: request.userContext!.organizationId, ...body };
  getDb().doctors.unshift(doctor);
  await audit(request.userContext!.user.id, doctor.organizationId, "doctor.created", "doctor", doctor.id);
  await saveDb();
  return doctor;
});

app.patch("/api/l2/doctors/:id", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const body = doctorSchema.partial().parse(request.body);
  const doctor = getDb().doctors.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === request.userContext!.organizationId);
  if (!doctor) return reply.code(404).send({ error: "Doctor not found" });
  Object.assign(doctor, body);
  await audit(request.userContext!.user.id, doctor.organizationId, "doctor.updated", "doctor", doctor.id);
  await saveDb();
  return doctor;
});

app.delete("/api/l2/doctors/:id", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const db = getDb();
  const orgId = request.userContext!.organizationId;
  const doctor = db.doctors.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === orgId);
  if (!doctor) return reply.code(404).send({ error: "Doctor not found" });
  db.doctors = db.doctors.filter((item) => item.id !== doctor.id);
  await audit(request.userContext!.user.id, orgId, "doctor.deleted", "doctor", doctor.id);
  await saveDb();
  return { ok: true };
});

app.get("/api/l2/clinic-details", { preHandler: authenticate }, async (request) => {
  return getDb().organizations.find((item) => item.id === request.userContext!.organizationId);
});

app.patch("/api/l2/clinic-details", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const body = clinicDetailsSchema.parse(request.body);
  const organization = getDb().organizations.find((item) => item.id === request.userContext!.organizationId);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });
  Object.assign(organization, body);
  await audit(request.userContext!.user.id, organization.id, "organization.updated", "organization", organization.id);
  await saveDb();
  return organization;
});

app.get("/api/l2/knowledge-base/files", { preHandler: authenticate }, async (request) => {
  return getDb().knowledgeFiles.filter((item) => item.organizationId === request.userContext!.organizationId);
});

app.post("/api/l2/knowledge-base/files", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const file = await request.file();
  if (!file) return reply.code(400).send({ error: "File is required" });

  const orgId = request.userContext!.organizationId;
  const fileId = id("file");
  const db = getDb();
  const knowledgeFile: KnowledgeFile = {
    id: fileId,
    organizationId: orgId,
    fileName: file.filename,
    fileType: file.mimetype,
    uploadedBy: request.userContext!.user.id,
    uploadedAt: now(),
    status: "processing",
    chunkCount: 0,
    extractedText: "",
  };

  db.knowledgeFiles.unshift(knowledgeFile);

  try {
    const buffer = await file.toBuffer();
    if (isSupabaseConfigured() && config.supabaseUrl && config.supabaseServiceRoleKey) {
      const storagePath = `${orgId}/${fileId}/${file.filename}`;
      const storageResponse = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseStorageBucket}/${storagePath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
          "Content-Type": file.mimetype,
          "x-upsert": "true",
        },
        body: new Uint8Array(buffer),
      });
      if (!storageResponse.ok) throw new Error(`Supabase storage upload failed: ${storageResponse.status}`);
    }
    const extractedText = await extractText(buffer, file.filename, file.mimetype);
    const chunks = chunkText(extractedText);
    knowledgeFile.status = "ready";
    knowledgeFile.chunkCount = chunks.length;
    knowledgeFile.extractedText = extractedText.slice(0, 5000);
    for (const text of chunks) {
      db.knowledgeChunks.push({
        id: id("chunk"),
        organizationId: orgId,
        fileId,
        text,
        embedding: await embedText(text),
      });
    }
  } catch {
    knowledgeFile.status = "failed";
  }

  await audit(request.userContext!.user.id, orgId, "knowledge_file.uploaded", "knowledge_file", fileId);
  await saveDb();
  return knowledgeFile;
});

app.delete("/api/l2/knowledge-base/files/:id", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const db = getDb();
  const orgId = request.userContext!.organizationId;
  const fileId = (request.params as { id: string }).id;
  const file = db.knowledgeFiles.find((item) => item.id === fileId && item.organizationId === orgId);
  if (!file) return reply.code(404).send({ error: "File not found" });
  db.knowledgeFiles = db.knowledgeFiles.filter((item) => item.id !== fileId);
  db.knowledgeChunks = db.knowledgeChunks.filter((item) => item.fileId !== fileId);
  await audit(request.userContext!.user.id, orgId, "knowledge_file.deleted", "knowledge_file", fileId);
  await saveDb();
  return { ok: true };
});

app.get("/api/l2/customization-requests", { preHandler: authenticate }, async (request) => {
  return getDb().customizationRequests.filter((item) => item.organizationId === request.userContext!.organizationId);
});

app.post("/api/l2/customization-requests", { preHandler: requireRole(["L2_ADMIN"]) }, async (request) => {
  const body = customizationRequestSchema.parse(request.body);
  const item = {
    id: id("req"),
    organizationId: request.userContext!.organizationId,
    ...body,
    status: "open" as const,
    createdBy: request.userContext!.user.id,
    createdAt: now(),
  };
  getDb().customizationRequests.unshift(item);
  await audit(request.userContext!.user.id, item.organizationId, "customization_request.created", "customization_request", item.id);
  await saveDb();
  return item;
});

app.get("/api/l2/clinic-profile-items", { preHandler: authenticate }, async (request) => {
  const orgId = request.userContext!.organizationId;
  return getDb().customizationRequests
    .filter((item) => item.organizationId === orgId && item.category === "clinic_profile")
    .map((item) => ({
      id: item.id,
      title: item.title,
      content: item.description,
      createdAt: item.createdAt,
    }));
});

app.post("/api/l2/clinic-profile-items", { preHandler: requireRole(["L2_ADMIN"]) }, async (request) => {
  const body = clinicProfileItemSchema.parse(request.body);
  const orgId = request.userContext!.organizationId;
  const item = {
    id: id("profile"),
    organizationId: orgId,
    title: body.title,
    description: body.content,
    category: "clinic_profile",
    priority: "low" as const,
    status: "completed" as const,
    createdBy: request.userContext!.user.id,
    createdAt: now(),
  };
  getDb().customizationRequests.unshift(item);
  await upsertClinicProfileKnowledgeChunk(orgId, item.id, item.title, item.description, request.userContext!.user.id);
  await audit(request.userContext!.user.id, orgId, "clinic_profile_item.created", "clinic_profile_item", item.id);
  await saveDb();
  return { id: item.id, title: item.title, content: item.description, createdAt: item.createdAt };
});

app.delete("/api/l2/clinic-profile-items/:id", { preHandler: requireRole(["L2_ADMIN"]) }, async (request, reply) => {
  const db = getDb();
  const orgId = request.userContext!.organizationId;
  const itemId = (request.params as { id: string }).id;
  const item = db.customizationRequests.find((entry) => entry.id === itemId && entry.organizationId === orgId && entry.category === "clinic_profile");
  if (!item) return reply.code(404).send({ error: "Clinic profile item not found" });

  db.customizationRequests = db.customizationRequests.filter((entry) => entry.id !== item.id);
  db.knowledgeChunks = db.knowledgeChunks.filter((chunk) => !(chunk.sourceType === "clinic_profile" && chunk.sourceId === item.id));
  await audit(request.userContext!.user.id, orgId, "clinic_profile_item.deleted", "clinic_profile_item", item.id);
  await saveDb();
  return { ok: true };
});

app.get("/api/l2/notifications", { preHandler: authenticate }, async (request) => {
  return getDb().notifications.filter((item) => item.organizationId === request.userContext!.organizationId);
});

app.get("/api/public/:orgSlug/doctors", async (request, reply) => {
  const db = getDb();
  const organization = db.organizations.find((item) => item.slug === (request.params as { orgSlug: string }).orgSlug);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });
  return db.doctors.filter((item) => item.organizationId === organization.id && item.active);
});

app.get("/api/public/:orgSlug/widget/chats/:id/messages", async (request, reply) => {
  const db = getDb();
  const organization = db.organizations.find((item) => item.slug === (request.params as { orgSlug: string }).orgSlug);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });
  const chat = db.chats.find((item) => item.id === (request.params as { id: string }).id && item.organizationId === organization.id);
  if (!chat) return reply.code(404).send({ error: "Chat not found" });
  return { chatId: chat.id, aiPaused: chat.aiPaused ?? false, messages: chat.messages };
});

app.get("/api/public/:orgSlug/widget/patients/:patientUserId/messages", async (request, reply) => {
  const params = request.params as { orgSlug: string; patientUserId: string };
  const db = getDb();
  const organization = db.organizations.find((item) => item.slug === params.orgSlug);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });

  const chats = db.chats
    .filter((item) => item.organizationId === organization.id && item.patientUserId === params.patientUserId)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  const activeChat = [...chats].reverse().find((item) => item.aiPaused || item.status === "booking_started") ?? chats.at(-1);
  const messages = chats.flatMap((chat) => chat.messages);

  return {
    chatId: activeChat?.id,
    aiPaused: activeChat?.aiPaused ?? false,
    messages,
  };
});

app.post("/api/public/:orgSlug/widget/chat/message", async (request, reply) => {
  const body = publicChatMessageSchema.parse(request.body);
  const db = getDb();
  const organization = db.organizations.find((item) => item.slug === (request.params as { orgSlug: string }).orgSlug);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });

  const intent = detectIntent(body.message);
  let chat = body.chatId ? db.chats.find((item) => item.id === body.chatId && item.organizationId === organization.id) : undefined;
  if (!chat && body.patientUserId) {
    chat = db.chats
      .filter((item) => item.organizationId === organization.id && item.patientUserId === body.patientUserId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  }
  if (!chat) {
    chat = {
      id: id("chat"),
      organizationId: organization.id,
      patientUserId: body.patientUserId,
      patientName: body.patientName,
      patientPhone: body.patientPhone,
      patientEmail: body.patientEmail,
      questionPreview: body.message.slice(0, 120),
      intent,
      status: "resolved",
      createdAt: now(),
      messages: [],
    };
    db.chats.unshift(chat);
  }

  const patientMessage: ChatMessage = {
    id: id("msg"),
    chatId: chat.id,
    sender: "patient",
    text: body.message,
    createdAt: now(),
  };
  chat.messages.push(patientMessage);

  if (chat.aiPaused) {
    await saveDb();
    return { chatId: chat.id, answer: "", status: chat.status, intent: chat.intent, actions: [], aiPaused: true };
  }

  let answer = "";
  let responseActions: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  if (isSafetyConcern(body.message)) {
    chat.status = "unresolved";
    chat.unresolvedReason = "Medical/safety concern";
    answer = organization.emergencyNotice;
  } else {
    const bookingIntent = await detectBookingIntentWithAi(
      body.message,
      chat.messages.slice(-30).map((message) => ({ sender: message.sender, text: message.text })),
    );
    const bookingActions: Array<{ type: string; payload?: Record<string, unknown> }> = bookingIntent.wantsBooking ? [{ type: "OPEN_BOOKING_WIDGET" }] : [];
    app.log.info({
      latestMessage: body.message,
      ruleMatched: bookingIntent.ruleMatched,
      geminiResult: bookingIntent.geminiWantsBooking,
      source: bookingIntent.source,
      returnedActions: bookingActions.map((action) => action.type),
    }, "booking classification");
    if (bookingIntent.wantsBooking) {
      answer = bookingIntent.reply;
      responseActions = bookingActions;
      chat.intent = "booking";
      chat.status = "booking_started";
    } else {
    const context = await retrieveKnowledge(
      body.message,
      db.knowledgeChunks.filter((item) => item.organizationId === organization.id),
      db.faqs.filter((item) => item.organizationId === organization.id),
      organization,
    );

    if (!context.length) {
      chat.status = "unresolved";
      chat.unresolvedReason = "No matching knowledge found";
    }

    const aiResponse = await answerWithStructuredAi({
      message: body.message,
      context,
      recentMessages: chat.messages.slice(-30).map((message) => ({ sender: message.sender, text: message.text })),
      organization,
    });
    answer = aiResponse.reply;
    responseActions = aiResponse.actions;
    chat.intent = aiResponse.flags.intent;

    for (const action of aiResponse.actions) {
      if (action.type === "ESCALATE_CHAT") {
        chat.status = "unresolved";
        chat.unresolvedReason = String(action.payload?.reason ?? "AI escalation");
      }

    }

    if (aiResponse.flags.escalated) {
      chat.status = "unresolved";
      chat.unresolvedReason ||= "AI marked this chat for staff attention";
    }
    }
  }

  chat.messages.push({
    id: id("msg"),
    chatId: chat.id,
    sender: "assistant",
    text: answer,
    createdAt: now(),
  });

  if (chat.status === "unresolved") {
    db.notifications.unshift({
      id: id("not"),
      organizationId: organization.id,
      title: `Unresolved chat: ${chat.questionPreview}`,
      type: "unresolved_chat",
      read: false,
      createdAt: now(),
    });
  }

  await saveDb();
  return { chatId: chat.id, answer, status: chat.status, intent: chat.intent, actions: responseActions };
});

app.post("/api/public/:orgSlug/widget/booking-request", async (request, reply) => {
  const body = bookingRequestSchema.parse(request.body);
  const db = getDb();
  const organization = db.organizations.find((item) => item.slug === (request.params as { orgSlug: string }).orgSlug);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });

  const orgDoctors = db.doctors.filter((item) => item.organizationId === organization.id);
  const doctor = orgDoctors.find((item) => item.name.toLowerCase() === body.suggestedDoctor.toLowerCase() && item.active);
  if (!doctor) return reply.code(400).send({ error: "Selected doctor is not available" });

  const suggestion = suggestDoctor(body.reason, orgDoctors);
  const booking: BookingRequest = {
    id: id("book"),
    organizationId: organization.id,
    patientName: body.patientName,
    patientAge: body.patientAge,
    patientPhone: body.patientPhone,
    patientEmail: body.patientEmail,
    reason: body.reason,
    suggestedSpecialty: body.suggestedSpecialty || suggestion.specialty,
    suggestedDoctor: doctor.name,
    preferredDate: body.preferredDate,
    preferredTime: body.preferredTime,
    status: "pending",
    source: body.source,
    createdAt: now(),
  };

  const existingBookings = db.bookings.filter((item) =>
    item.organizationId === organization.id &&
    item.suggestedDoctor?.toLowerCase() === doctor.name.toLowerCase() &&
    item.preferredDate === booking.preferredDate &&
    item.status !== "cancelled"
  );
  const availableTimings = getAvailableDoctorSlots(doctor, booking.preferredDate, existingBookings, 30);
  const slotAvailable = availableTimings.includes(booking.preferredTime);
  let availability = {
    available: slotAvailable,
    availableTimings,
    message: slotAvailable
      ? `Your appointment slot at ${booking.preferredTime} is available and has been confirmed.`
      : `That slot is not available. Available timings for this doctor are: ${availableTimings.length ? availableTimings.join(", ") : "no slots available for this day"}.`,
  };

  try {
    availability = await checkBookingAvailabilityWithAi({
      booking,
      doctor,
      existingBookings,
      availableTimings,
      appointmentMinutes: 30,
    });
  } catch (error) {
    app.log.warn({ error }, "AI booking availability check failed; using deterministic slot check");
  }

  if (!availability.available) {
    return {
      booking: null,
      available: false,
      availableTimings: availability.availableTimings,
      message: availability.message,
    };
  }

  booking.status = "confirmed";
  booking.confirmedAt = now();
  db.bookings.unshift(booking);
  db.notifications.unshift({
    id: id("not"),
    organizationId: organization.id,
    title: `Booking confirmed for ${booking.patientName}`,
    type: "booking_confirmation",
    read: false,
    createdAt: now(),
  });
  await saveDb();

  return { booking, available: true, availableTimings: availability.availableTimings, message: bookingConfirmationText(booking) };
});

app.post("/api/public/:orgSlug/widget/doctor-suggestion", async (request, reply) => {
  const body = doctorSuggestionSchema.parse(request.body);
  const db = getDb();
  const organization = db.organizations.find((item) => item.slug === (request.params as { orgSlug: string }).orgSlug);
  if (!organization) return reply.code(404).send({ error: "Organization not found" });

  return suggestDoctorWithAi({
    reason: body.reason,
    patientAge: body.patientAge,
    doctors: db.doctors.filter((item) => item.organizationId === organization.id),
  });
});

async function audit(actorUserId: string, organizationId: string, action: string, entityType: string, entityId: string) {
  getDb().auditLogs.unshift({
    id: id("audit"),
    organizationId,
    actorUserId,
    action,
    entityType,
    entityId,
    createdAt: now(),
  });
}

async function upsertFaqKnowledgeChunk(organizationId: string, faqId: string, question: string, answer: string, uploadedBy: string) {
  const db = getDb();
  const faqFile = getOrCreateFaqKnowledgeFile(organizationId, uploadedBy);
  const text = [`FAQ question: ${question}`, `FAQ answer: ${answer}`].join("\n");
  db.knowledgeChunks.unshift({
    id: id("chunk"),
    organizationId,
    fileId: faqFile.id,
    sourceType: "faq",
    sourceId: faqId,
    text,
    embedding: await embedText(text),
  });
  faqFile.chunkCount = db.knowledgeChunks.filter((item) => item.fileId === faqFile.id).length;
}

async function upsertClinicProfileKnowledgeChunk(organizationId: string, itemId: string, title: string, content: string, uploadedBy: string) {
  const db = getDb();
  const profileFile = getOrCreateClinicProfileKnowledgeFile(organizationId, uploadedBy);
  const text = [`Clinic profile header: ${title}`, `Clinic profile content: ${content}`].join("\n");
  db.knowledgeChunks.unshift({
    id: id("chunk"),
    organizationId,
    fileId: profileFile.id,
    sourceType: "clinic_profile",
    sourceId: itemId,
    text,
    embedding: await embedText(text),
  });
  profileFile.chunkCount = db.knowledgeChunks.filter((item) => item.fileId === profileFile.id).length;
}

function getOrCreateFaqKnowledgeFile(organizationId: string, uploadedBy: string) {
  const db = getDb();
  const existing = db.knowledgeFiles.find((item) => item.organizationId === organizationId && item.fileName === "FAQ Content");
  if (existing) return existing;

  const file: KnowledgeFile = {
    id: id("file"),
    organizationId,
    fileName: "FAQ Content",
    fileType: "text/faq",
    uploadedBy,
    uploadedAt: now(),
    status: "ready",
    chunkCount: 0,
    extractedText: "",
  };
  db.knowledgeFiles.unshift(file);
  return file;
}

function getOrCreateClinicProfileKnowledgeFile(organizationId: string, uploadedBy: string) {
  const db = getDb();
  const existing = db.knowledgeFiles.find((item) => item.organizationId === organizationId && item.fileName === "Clinic Profile");
  if (existing) return existing;

  const file: KnowledgeFile = {
    id: id("file"),
    organizationId,
    fileName: "Clinic Profile",
    fileType: "text/clinic-profile",
    uploadedBy,
    uploadedAt: now(),
    status: "ready",
    chunkCount: 0,
    extractedText: "",
  };
  db.knowledgeFiles.unshift(file);
  return file;
}

function createBookingFromAiPayload(payload: Record<string, unknown> | undefined, organizationId: string, doctors: Doctor[]) {
  if (!payload) return null;
  const patientName = typeof payload.patientName === "string" ? payload.patientName.trim() : "";
  const patientPhone = typeof payload.patientPhone === "string" ? payload.patientPhone.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const preferredDate = normalizeDate(typeof payload.preferredDate === "string" ? payload.preferredDate.trim() : "");
  const preferredTime = normalizeTime(typeof payload.preferredTime === "string" ? payload.preferredTime.trim() : "");
  if (!patientName || !patientPhone || !reason || !preferredDate || !preferredTime) return null;

  const suggestion = suggestDoctor(reason, doctors);
  return {
    id: id("book"),
    organizationId,
    patientName,
    patientPhone,
    patientEmail: typeof payload.patientEmail === "string" ? payload.patientEmail : undefined,
    reason,
    suggestedSpecialty: typeof payload.suggestedSpecialty === "string" ? payload.suggestedSpecialty : suggestion.specialty,
    suggestedDoctor: typeof payload.suggestedDoctor === "string" ? payload.suggestedDoctor : suggestion.doctorName,
    preferredDate,
    preferredTime,
    status: "pending" as const,
    source: "widget" as const,
    createdAt: now(),
  };
}

function buildBookingFlowResponse(chat: Chat, organizationId: string, doctors: Doctor[]) {
  const slots = extractBookingSlots(chat.messages);
  const missing = firstMissingBookingField(slots);
  if (missing) {
    return { answer: bookingQuestionFor(missing), booking: null };
  }

  const suggestion = suggestDoctor(slots.reason!, doctors);
  const booking: BookingRequest = {
    id: id("book"),
    organizationId,
    patientName: slots.patientName!,
    patientPhone: slots.patientPhone!,
    reason: slots.reason!,
    suggestedSpecialty: suggestion.specialty,
    suggestedDoctor: suggestion.doctorName,
    preferredDate: slots.preferredDate!,
    preferredTime: slots.preferredTime!,
    status: "pending",
    source: "widget",
    createdAt: now(),
  };

  return {
    answer: bookingConfirmationText(booking),
    booking,
  };
}

type BookingSlots = {
  patientName?: string;
  patientPhone?: string;
  reason?: string;
  preferredDate?: string;
  preferredTime?: string;
};

function extractBookingSlots(messages: ChatMessage[]): BookingSlots {
  const slots: BookingSlots = {};
  const patientMessages = messages.filter((message) => message.sender === "patient").map((message) => message.text);

  for (const text of patientMessages) {
    slots.patientPhone ||= extractPhone(text);
    slots.preferredDate ||= extractDate(text);
    slots.preferredTime ||= extractTime(text);
    slots.patientName ||= extractPatientName(text);
    slots.reason ||= extractReason(text);
  }

  if (!slots.reason && (slots.patientPhone || slots.preferredDate || slots.preferredTime)) {
    slots.reason = "General consultation";
  }

  return slots;
}

function firstMissingBookingField(slots: BookingSlots) {
  if (!slots.patientName) return "patientName";
  if (!slots.patientPhone) return "patientPhone";
  if (!slots.reason) return "reason";
  if (!slots.preferredDate) return "preferredDate";
  if (!slots.preferredTime) return "preferredTime";
  return null;
}

function bookingQuestionFor(field: string) {
  const questions: Record<string, string> = {
    patientName: "Sure. What is the patient's name?",
    patientPhone: "Please share a phone number for confirmation.",
    reason: "What is the symptom or reason for the visit?",
    preferredDate: "What date would you prefer? You can say something like tomorrow or 2026-05-22.",
    preferredTime: "What time would you prefer? You can say something like 2 PM or 14:00.",
  };
  return questions[field] ?? "Please share the missing booking detail.";
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?\d[\d\s-]{6,}\d)/);
  return match?.[0].replace(/[^\d+]/g, "");
}

function extractPatientName(text: string) {
  const explicit = text.match(/\b(?:my name is|name is|i am|i'm)\s+([a-z][a-z\s]{1,40})/i);
  if (explicit) return cleanName(explicit[1]);

  const commaName = text.split(",")[0]?.trim();
  if (commaName && /^[a-z][a-z\s.'-]{1,40}$/i.test(commaName) && !/\b(book|appointment|doctor|visit|clinic|want|need)\b/i.test(commaName)) {
    return cleanName(commaName);
  }

  if (/^[a-z][a-z\s.'-]{1,40}$/i.test(text.trim()) && text.trim().split(/\s+/).length <= 3 && !/\b(book|appointment|doctor|visit|clinic|want|need|hi|hello|ok|thanks)\b/i.test(text)) {
    return cleanName(text);
  }

  return undefined;
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.,!?]+$/g, "");
}

function extractReason(text: string) {
  const explicit = text.match(/\b(?:reason is|for|because of|symptom is)\s+([^,.]+(?:\s+[^,.]+){0,8})/i);
  if (explicit) return cleanReason(explicit[1]);

  if (/\b(visit|see|consult)\s+(?:a\s+)?doctor\b/i.test(text)) {
    return "General consultation";
  }

  const symptoms = ["fever", "pain", "cough", "cold", "headache", "skin", "acne", "knee", "joint", "stomach", "diabetes", "blood pressure"];
  const lower = text.toLowerCase();
  const symptom = symptoms.find((item) => lower.includes(item));
  return symptom ? cleanReason(symptom) : undefined;
}

function cleanReason(value: string) {
  return value.trim().replace(/\b(?:preferred|date|time|tomorrow|tmr|today)\b.*$/i, "").replace(/[.,!?]+$/g, "") || "General consultation";
}

function extractDate(text: string) {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return normalizeDate(iso[0]);

  const slashOrDash = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/);
  if (slashOrDash) return normalizeDate(slashOrDash[0]);

  const lower = text.toLowerCase();
  if (/\b(tomorrow|tmr|tmrw)\b/.test(lower)) return formatDate(addDays(new Date(), 1));
  if (/\btoday\b/.test(lower)) return formatDate(new Date());

  const weekday = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekday) return nextWeekdayDate(weekday[1]);

  return undefined;
}

function extractTime(text: string) {
  const meridiem = text.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i);
  if (meridiem) return normalizeTime(meridiem[0]);

  const contextual = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:in the\s+)?(morning|noon|afternoon|evening|night)\b/i);
  if (contextual) {
    let hour = Number(contextual[1]);
    const minute = Number(contextual[2] ?? "0");
    const period = contextual[3].toLowerCase();
    if (period === "noon" || period === "afternoon" || period === "evening" || period === "night") {
      if (hour < 12) hour += 12;
    }
    if (period === "morning" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  const exact = text.match(/\b\d{1,2}:\d{2}\b/);
  if (exact) return normalizeTime(exact[0]);

  return undefined;
}

function normalizeDate(value: string) {
  const lower = value.toLowerCase();
  if (lower === "tomorrow" || lower === "tmr" || lower === "tmrw") return formatDate(addDays(new Date(), 1));
  if (lower === "today") return formatDate(new Date());

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const slashOrDash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashOrDash) {
    const [, day, month, year] = slashOrDash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextWeekdayDate(dayName: string) {
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const target = weekdays.indexOf(dayName);
  if (target === -1) return undefined;
  const today = new Date();
  const delta = ((target - today.getDay() + 7) % 7) || 7;
  return formatDate(addDays(today, delta));
}

function normalizeTime(value: string) {
  const exact = value.match(/^(\d{1,2}):(\d{2})$/);
  if (exact) {
    const hour = Number(exact[1]);
    const minute = Number(exact[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  const meridiem = value.toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (meridiem) {
    let hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? "0");
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return "";
    if (meridiem[3] === "pm" && hour !== 12) hour += 12;
    if (meridiem[3] === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return "";
}

function getAvailableDoctorSlots(doctor: Doctor, date: string, existingBookings: BookingRequest[], appointmentMinutes: number) {
  const day = dayKeyForDate(date);
  const schedule = doctor.schedule.find((slot) => slot.day.toLowerCase().startsWith(day.toLowerCase()));
  if (!schedule) return [];

  const start = minutesFromTime(schedule.startTime);
  const end = minutesFromTime(schedule.endTime);
  if (start === null || end === null || end <= start) return [];

  const busyStarts = new Set(
    existingBookings
      .map((booking) => minutesFromTime(booking.preferredTime))
      .filter((value): value is number => value !== null),
  );

  const slots: string[] = [];
  for (let minute = start; minute + appointmentMinutes <= end; minute += appointmentMinutes) {
    if (!busyStarts.has(minute)) slots.push(timeFromMinutes(minute));
  }
  return slots;
}

function dayKeyForDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parsed.getDay()];
}

function minutesFromTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function timeFromMinutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
