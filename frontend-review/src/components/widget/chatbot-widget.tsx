import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { readSignedInUserId } from "../../lib/auth";

type WidgetMessage = {
  id: string;
  sender: "user" | "assistant" | "staff";
  text: string;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  schedule?: Array<{ day: string; startTime: string; endTime: string }>;
};

const quickReplies = [
  "What are your clinic timings?",
  "Where is the clinic located?",
  "Do you accept insurance?",
  "I want to book an appointment",
];

const bookingWidgetReply = "I'd be happy to help you schedule an appointment. Please fill out this form below.";

const emptyBooking = {
  patientName: "",
  patientAge: "",
  patientPhone: "",
  reason: "",
  preferredDate: "",
  preferredTime: "",
  suggestedDoctor: "",
};

const patientUserKey = "patientWidgetUserId";

function getPatientUserId() {
  const signedInUserId = readSignedInUserId();
  if (signedInUserId) return signedInUserId;

  const existing = window.localStorage.getItem(patientUserKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(patientUserKey, next);
  return next;
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string>();
  const [patientUserId] = useState(getPatientUserId);
  const [loading, setLoading] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [booking, setBooking] = useState(emptyBooking);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiPaused, setAiPaused] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hi. Ask me about clinic details, FAQs, or booking help.",
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/public/aster-grove/doctors")
      .then((response) => response.ok ? response.json() : [])
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const loadHistory = () => {
      fetch(`/api/public/aster-grove/widget/patients/${patientUserId}/messages`)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!data) return;
          if (data.chatId) setChatId(data.chatId);
          setAiPaused(Boolean(data.aiPaused));
          setMessages([
            {
              id: "welcome",
              sender: "assistant",
              text: "Hi. Ask me about clinic details, FAQs, or booking help.",
            },
            ...data.messages.map((message: { id: string; sender: "patient" | "assistant" | "staff"; text: string }) => ({
              id: message.id,
              sender: message.sender === "patient" ? "user" : message.sender,
              text: message.text,
            })),
          ]);
        })
        .catch(() => undefined);
    };
    loadHistory();
    const interval = window.setInterval(loadHistory, 2500);
    return () => window.clearInterval(interval);
  }, [open, patientUserId]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), sender: "user", text: trimmed },
    ]);

    try {
      const response = await fetch("/api/public/aster-grove/widget/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          patientUserId,
          message: trimmed,
          patientName: "Dashboard visitor",
          patientPhone: "0000000000",
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const data = (await response.json()) as {
        chatId: string;
        answer: string;
        actions?: Array<{ type: string }>;
        aiPaused?: boolean;
      };

      setChatId(data.chatId);
      setAiPaused(Boolean(data.aiPaused));
      if (data.actions?.some((action) => action.type === "OPEN_BOOKING_WIDGET") || data.answer.trim() === bookingWidgetReply) {
        setBookingOpen(true);
      }
      if (data.answer.trim()) {
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), sender: "assistant", text: data.answer },
        ]);
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: "I could not reach the chatbot server. Please check that the backend is running.",
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  async function suggestDoctor() {
    if (!booking.reason.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/public/aster-grove/widget/doctor-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: booking.reason,
          patientAge: booking.patientAge ? Number(booking.patientAge) : undefined,
        }),
      });
      if (!response.ok) throw new Error("Suggestion failed");
      const data = (await response.json()) as { doctorName: string; specialty: string; reason: string };
      setAiSuggestion(`${data.doctorName}: ${data.reason}`);
      setBooking((current) => ({ ...current, suggestedDoctor: data.doctorName }));
    } catch {
      setAiSuggestion("I could not suggest a doctor right now.");
    } finally {
      setLoading(false);
    }
  }

  async function submitBooking(bookingData = booking) {
    const missing = missingBookingFields(bookingData);
    if (missing.length) {
      setBookingError(`Missing: ${missing.join(", ")}`);
      return;
    }

    setBookingError("");
    setLoading(true);
    const doctor = doctors.find((item) => item.name === bookingData.suggestedDoctor);
    try {
      const response = await fetch("/api/public/aster-grove/widget/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: bookingData.patientName,
          patientAge: Number(bookingData.patientAge),
          patientPhone: bookingData.patientPhone,
          reason: bookingData.reason,
          preferredDate: bookingData.preferredDate,
          preferredTime: bookingData.preferredTime,
          suggestedDoctor: bookingData.suggestedDoctor,
          suggestedSpecialty: doctor?.specialty ?? "General Medicine",
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Booking failed");
      }
      const responseData = (await response.json()) as { message: string; available?: boolean };
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: responseData.available === false ? responseData.message : `${responseData.message} You can now see it in the Bookings tab.`,
        },
      ]);
      if (responseData.available === false) return;
      setBooking(emptyBooking);
      setAiSuggestion("");
      setBookingOpen(false);
    } catch {
      setBookingError("Booking request failed. Check the selected doctor, date, and time.");
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), sender: "assistant", text: "I could not create the booking request. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function updateBooking(key: keyof typeof booking, value: string) {
    setBooking((current) => ({ ...current, [key]: value }));
  }

  function isBookingComplete(data = booking) {
    return missingBookingFields(data).length === 0;
  }

  function missingBookingFields(data = booking) {
    const required: Array<[keyof typeof booking, string]> = [
      ["patientName", "name"],
      ["patientAge", "age"],
      ["patientPhone", "phone"],
      ["reason", "reason"],
      ["suggestedDoctor", "doctor"],
      ["preferredDate", "date"],
      ["preferredTime", "time"],
    ];
    return required.filter(([key]) => !data[key].trim()).map(([, label]) => label);
  }

  function selectedDoctorSlots() {
    const doctor = doctors.find((item) => item.name === booking.suggestedDoctor);
    if (!doctor || !booking.preferredDate) return [];
    const day = dayKeyForDate(booking.preferredDate);
    const schedule = doctor.schedule?.find((slot) => slot.day === day);
    if (!schedule) return [];
    return buildTimeSlots(schedule.startTime, schedule.endTime);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <section className="mb-3 flex h-[620px] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border bg-card shadow-2xl">
          <header className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Patient chatbot</p>
                <p className="text-xs text-muted-foreground">{aiPaused ? "Clinic staff is replying" : "Gemini via Vertex AI"}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close chatbot">
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.sender === "user" ? "flex justify-end" : "flex justify-start"}>
                <p className={message.sender === "user" ? "max-w-[82%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[82%] rounded-lg bg-muted px-3 py-2 text-sm leading-6"}>
                  {message.text}
                </p>
              </div>
            ))}
            {bookingOpen && (
              <div className="rounded-md border bg-background p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Appointment request</p>
                  <button className="text-xs text-muted-foreground" onClick={() => setBookingOpen(false)} type="button">Cancel</button>
                </div>
                <div className="grid gap-2">
                  <input className="h-9 rounded-md border px-3 text-sm" placeholder="Name" value={booking.patientName} onChange={(event) => updateBooking("patientName", event.target.value)} />
                  <input className="h-9 rounded-md border px-3 text-sm" placeholder="Age" type="number" value={booking.patientAge} onChange={(event) => updateBooking("patientAge", event.target.value)} />
                  <input className="h-9 rounded-md border px-3 text-sm" placeholder="Phone number" value={booking.patientPhone} onChange={(event) => updateBooking("patientPhone", event.target.value)} />
                  <input className="h-9 rounded-md border px-3 text-sm" placeholder="Issue / reason for visit" value={booking.reason} onChange={(event) => updateBooking("reason", event.target.value)} />
                  <select
                    className="h-9 rounded-md border bg-card px-3 text-sm"
                    value={booking.suggestedDoctor}
                    onChange={(event) => {
                      const next = { ...booking, suggestedDoctor: event.target.value, preferredTime: "" };
                      setBooking(next);
                      if (isBookingComplete(next)) void submitBooking(next);
                    }}
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.name}>{doctor.name} - {doctor.specialty}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-9 rounded-md border px-3 text-sm"
                      type="date"
                      value={booking.preferredDate}
                      onChange={(event) => setBooking((current) => ({ ...current, preferredDate: event.target.value, preferredTime: "" }))}
                    />
                    {booking.suggestedDoctor && booking.preferredDate ? (
                    <select
                      className="h-9 rounded-md border bg-card px-3 text-sm"
                      value={booking.preferredTime}
                      onChange={(event) => updateBooking("preferredTime", event.target.value)}
                    >
                      <option value="">Time</option>
                      {selectedDoctorSlots().map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    ) : (
                      <input
                        className="h-9 rounded-md border px-3 text-sm"
                        placeholder="Time"
                        type="time"
                        value={booking.preferredTime}
                        onChange={(event) => updateBooking("preferredTime", event.target.value)}
                      />
                    )}
                  </div>
                  {booking.suggestedDoctor && booking.preferredDate && selectedDoctorSlots().length > 0 && !booking.preferredTime && (
                    <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Choose one of this doctor's available times.</p>
                  )}
                  {booking.suggestedDoctor && booking.preferredDate && !selectedDoctorSlots().length && (
                    <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">This doctor has no listed slots for that date.</p>
                  )}
                  {bookingError && <p className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">{bookingError}</p>}
                  <Button variant="outline" type="button" onClick={suggestDoctor} disabled={loading || !booking.reason.trim()}>
                    <Sparkles className="h-4 w-4" />
                    AI assistance
                  </Button>
                  {aiSuggestion && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{aiSuggestion}</p>}
                  <Button type="button" onClick={() => submitBooking()} disabled={loading}>
                    Create booking
                  </Button>
                </div>
              </div>
            )}
            {loading && (
              <div className="flex justify-start">
                <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking locally...
                </p>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <button className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted" disabled={loading} key={reply} onClick={() => sendMessage(reply)} type="button">
                  {reply}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <input ref={inputRef} className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Ask a question" value={input} onChange={(event) => setInput(event.target.value)} />
              <Button size="icon" disabled={loading || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>
      )}

      <Button className="h-14 w-14 rounded-full shadow-xl" size="icon" onClick={() => setOpen((current) => !current)} aria-label="Open patient chatbot">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}

function dayKeyForDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parsed.getDay()];
}

function buildTimeSlots(startTime: string, endTime: string) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (start === null || end === null || end <= start) return [];

  const slots: string[] = [];
  for (let minute = start; minute + 30 <= end; minute += 30) {
    slots.push(timeFromMinutes(minute));
  }
  return slots;
}

function minutesFromTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}

function timeFromMinutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
