import {
  BookingStatus,
  bookings,
  notifications,
} from "../data/mock-data";
import {
  clearAuthSession,
  hasAuthSession,
  readActiveStaff,
  readAuthToken,
  staffFromUser,
  StaffSession,
  writeActiveStaff,
  writeAuthToken,
} from "./auth";

const wait = (ms = 260) => new Promise((resolve) => window.setTimeout(resolve, ms));
const API_BASE = "";

let authToken: string | null = readAuthToken();
let activeStaff = readActiveStaff();

async function getToken() {
  if (authToken) return authToken;
  throw new Error("Not signed in");
}

async function authedFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export const api = {
  hasSession() {
    return hasAuthSession();
  },
  getActiveStaff() {
    return activeStaff;
  },
  setActiveStaff(staff: StaffSession) {
    activeStaff = staff;
    writeActiveStaff(staff);
    authToken = null;
  },
  async signIn(input: { email: string; password: string }) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Sign-in failed");
    const data = await response.json();
    authToken = data.token;
    writeAuthToken(data.token);
    const staff = staffFromUser(data.user);
    activeStaff = staff;
    writeActiveStaff(staff);
    return data;
  },
  async signUp(input: { name: string; email: string; password: string }) {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Sign-up failed");
    const data = await response.json();
    authToken = data.token;
    writeAuthToken(data.token);
    const staff = staffFromUser(data.user);
    activeStaff = staff;
    writeActiveStaff(staff);
    return data;
  },
  logout() {
    authToken = null;
    clearAuthSession();
  },
  async getMe() {
    const response = await authedFetch("/api/auth/me");
    if (!response.ok) throw new Error("Unable to load signed-in user");
    return response.json();
  },
  async getMembers() {
    const response = await authedFetch("/api/l2/members");
    if (!response.ok) return [];
    return response.json();
  },
  async updateMemberRole(id: string, role: "L2_ADMIN" | "L2_ASSISTANT") {
    const response = await authedFetch(`/api/l2/members/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error("Unable to update role");
    return response.json();
  },
  async getDashboard() {
    const [meResponse, overviewResponse, notificationsResponse, chatsResponse, bookingsResponse] = await Promise.all([
      authedFetch("/api/auth/me"),
      authedFetch("/api/l2/overview"),
      authedFetch("/api/l2/notifications"),
      authedFetch("/api/l2/chats"),
      api.getBookings(),
    ]);
    const me = meResponse.ok ? await meResponse.json() : null;
    const overview = overviewResponse.ok ? await overviewResponse.json() : null;
    const realNotifications = notificationsResponse.ok ? await notificationsResponse.json() : notifications;
    const realChats = chatsResponse.ok ? await chatsResponse.json() : [];
    return {
      clinic: {
        name: me?.organization?.name ?? "Clinic",
        plan: "L2 Admin Workspace",
        location: me?.organization?.address ?? "",
        modules: ["Website Chatbot", "Appointment Booking"],
      },
      metrics: [
        { label: "Total chats", value: String(overview?.totalChats ?? 0), delta: "live", tone: "teal" },
        { label: "Confirmed appointments", value: String(overview?.confirmedAppointments ?? 0), delta: "live", tone: "green" },
        { label: "Unresolved chats", value: String(overview?.unresolvedChats ?? 0), delta: "live", tone: "amber" },
        { label: "Booking requests", value: String(overview?.bookingRequests ?? 0), delta: "live", tone: "coral" },
      ] as const,
      notifications: realNotifications.map(mapNotification),
      transcripts: realChats.map(mapChat),
      bookings: bookingsResponse,
      conversionTrend: buildTrend(realChats, bookingsResponse),
    };
  },
  async getTranscripts() {
    const response = await authedFetch("/api/l2/chats");
    if (!response.ok) return [];
    const rows = await response.json();
    const detailedRows = await Promise.all(
      rows.map(async (chat: { id: string }) => {
        const detailResponse = await authedFetch(`/api/l2/chats/${chat.id}`);
        return detailResponse.ok ? detailResponse.json() : chat;
      }),
    );
    return detailedRows.map(mapChat);
  },
  async getLiveChats() {
    const response = await authedFetch("/api/l2/live-chats");
    if (!response.ok) return [];
    const rows = await response.json();
    return rows.map(mapChat);
  },
  async takeOverChat(id: string) {
    const response = await authedFetch(`/api/l2/live-chats/${id}/take-over`, { method: "PATCH" });
    if (!response.ok) throw new Error("Unable to take over chat");
    return response.json();
  },
  async handOverChatToAi(id: string) {
    const response = await authedFetch(`/api/l2/live-chats/${id}/hand-over-ai`, { method: "PATCH" });
    if (!response.ok) throw new Error("Unable to hand over chat");
    return response.json();
  },
  async sendStaffMessage(id: string, message: string) {
    const response = await authedFetch(`/api/l2/live-chats/${id}/staff-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error("Unable to send staff message");
    return response.json();
  },
  async getBookings() {
    const [requestsResponse, confirmedResponse] = await Promise.all([
      authedFetch("/api/l2/booking-requests"),
      authedFetch("/api/l2/confirmed-appointments"),
    ]);

    if (!requestsResponse.ok || !confirmedResponse.ok) {
      await wait();
      return bookings;
    }

    const rows = [...(await requestsResponse.json()), ...(await confirmedResponse.json())];
    return rows.map((booking: {
      id: string;
      patientName: string;
      reason: string;
      suggestedDoctor?: string;
      suggestedSpecialty: string;
      status: string;
      preferredDate: string;
      preferredTime: string;
    }): {
      id: string;
      patient: string;
      symptom: string;
      suggestedDoctor: string;
      specialty: string;
      status: BookingStatus;
      appointment: string;
      preferredDate: string;
      preferredTime: string;
    } => ({
      id: booking.id,
      patient: booking.patientName,
      symptom: booking.reason,
      suggestedDoctor: booking.suggestedDoctor || booking.suggestedSpecialty,
      specialty: booking.suggestedSpecialty,
      status:
        booking.status === "confirmed"
          ? "Confirmed"
          : booking.status === "follow_up_needed"
            ? "Needs review"
            : "Assisted",
      appointment:
        booking.status === "confirmed"
          ? `${booking.preferredDate} at ${booking.preferredTime}`
          : "Pending staff confirmation",
      preferredDate: booking.preferredDate,
      preferredTime: booking.preferredTime,
    }));
  },
  async getCalendarBookings() {
    const [requestsResponse, confirmedResponse] = await Promise.all([
      authedFetch("/api/l2/booking-requests"),
      authedFetch("/api/l2/confirmed-appointments"),
    ]);
    if (!requestsResponse.ok || !confirmedResponse.ok) return [];
    return [...(await requestsResponse.json()), ...(await confirmedResponse.json())];
  },
  async getFaqs() {
    const response = await authedFetch("/api/l2/faqs");
    if (!response.ok) return [];
    const rows = await response.json();
    return rows.map((faq: { id: string; question: string; answer: string; active: boolean }) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      active: faq.active,
    }));
  },
  async getDoctors() {
    const response = await authedFetch("/api/l2/doctors");
    if (!response.ok) return [];
    return response.json();
  },
  async createDoctor(input: {
    name: string;
    qualification: string;
    specialty: string;
    availableDays: string[];
    startTime: string;
    endTime: string;
    schedule: Array<{ day: string; startTime: string; endTime: string }>;
    consultationType: "in_person" | "online" | "both";
    active?: boolean;
  }) {
    const response = await authedFetch("/api/l2/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, active: input.active ?? true }),
    });
    if (!response.ok) throw new Error("Unable to create doctor");
    return response.json();
  },
  async updateDoctor(id: string, input: {
    name: string;
    qualification: string;
    specialty: string;
    availableDays: string[];
    startTime: string;
    endTime: string;
    schedule: Array<{ day: string; startTime: string; endTime: string }>;
    consultationType: "in_person" | "online" | "both";
    active?: boolean;
  }) {
    const response = await authedFetch(`/api/l2/doctors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, active: input.active ?? true }),
    });
    if (!response.ok) throw new Error("Unable to update doctor");
    return response.json();
  },
  async deleteDoctor(id: string) {
    const response = await authedFetch(`/api/l2/doctors/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete doctor");
    return response.json();
  },
  async createFaq(input: { question: string; answer: string; active?: boolean }) {
    const response = await authedFetch("/api/l2/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, active: input.active ?? true }),
    });
    if (!response.ok) throw new Error("Unable to create FAQ");
    return response.json();
  },
  async updateFaq(id: string, input: { question: string; answer: string; active?: boolean }) {
    const response = await authedFetch(`/api/l2/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Unable to update FAQ");
    return response.json();
  },
  async getClinicDetails() {
    const response = await authedFetch("/api/l2/clinic-details");
    if (!response.ok) throw new Error("Unable to load clinic details");
    return response.json();
  },
  async updateClinicDetails(input: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    openingDays?: string;
    openingHours?: string;
    parkingInfo?: string;
    insuranceInfo?: string;
    consultationFeeInfo?: string;
    emergencyNotice?: string;
  }) {
    const response = await authedFetch("/api/l2/clinic-details", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Unable to update clinic details");
    return response.json();
  },
  async getClinicProfileItems() {
    const response = await authedFetch("/api/l2/clinic-profile-items");
    if (!response.ok) return [];
    return response.json();
  },
  async createClinicProfileItem(input: { title: string; content: string }) {
    const response = await authedFetch("/api/l2/clinic-profile-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Unable to save clinic profile item");
    return response.json();
  },
  async deleteClinicProfileItem(id: string) {
    const response = await authedFetch(`/api/l2/clinic-profile-items/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete clinic profile item");
    return response.json();
  },
  async getRequests() {
    const response = await authedFetch("/api/l2/customization-requests");
    if (!response.ok) return [];
    const rows = await response.json();
    return rows.map((request: { id: string; title: string; category: string; status: string; createdAt: string }) => ({
      id: request.id,
      title: request.title,
      type: request.category,
      status: toTitleStatus(request.status),
      submitted: new Date(request.createdAt).toLocaleDateString(),
    }));
  },
  async getAnalytics() {
    const [transcriptRows, bookingRows] = await Promise.all([api.getTranscripts(), api.getBookings()]);
    return { conversionTrend: buildTrend(transcriptRows, bookingRows), transcripts: transcriptRows, bookings: bookingRows };
  },
  async getNotifications() {
    const response = await authedFetch("/api/l2/notifications");
    if (!response.ok) return notifications;
    return response.json();
  },
  async createBooking(input: {
    patientName: string;
    patientPhone: string;
    reason: string;
    suggestedSpecialty: string;
    suggestedDoctor?: string;
    preferredDate: string;
    preferredTime: string;
  }) {
    const response = await fetch("/api/public/aster-grove/widget/booking-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Unable to create booking");
    return response.json();
  },
  async deleteBooking(id: string) {
    const response = await authedFetch(`/api/l2/bookings/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Unable to delete booking");
    return response.json();
  },
  async getKnowledgeFiles() {
    const response = await authedFetch("/api/l2/knowledge-base/files");
    if (!response.ok) throw new Error("Unable to load files");
    return response.json();
  },
  async uploadKnowledgeFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await authedFetch("/api/l2/knowledge-base/files", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Unable to upload file");
    return response.json();
  },
};

function mapChat(chat: {
  id: string;
  patientName?: string;
  questionPreview: string;
  intent: string;
  status: string;
  aiPaused?: boolean;
  createdAt: string;
  messages?: Array<{ id: string; sender: "patient" | "assistant" | "staff"; text: string; createdAt: string }>;
}) {
  return {
    id: chat.id,
    visitor: chat.patientName || "Anonymous visitor",
    topic: chat.questionPreview || chat.intent,
    status: chat.status === "resolved" ? "Resolved" : chat.status === "unresolved" ? "Unresolved" : "Escalated",
    leadScore: chat.status === "booking_started" ? 85 : chat.status === "resolved" ? 70 : 45,
    lastMessage: chat.questionPreview,
    channel: "Website widget",
    aiPaused: chat.aiPaused ?? false,
    time: new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAt: chat.createdAt,
    messages: (chat.messages ?? []).map((message) => ({
      id: message.id,
      sender: message.sender,
      text: message.text,
      time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })),
  };
}

function mapNotification(notification: { id: string; title: string; type?: string; createdAt?: string }) {
  return {
    id: notification.id,
    title: notification.title,
    detail: notification.type ?? "Clinic event",
    time: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : "",
  };
}

function toTitleStatus(status: string) {
  if (status === "in_review") return "In review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildTrend(chats: Array<{ createdAt?: string }>, bookingRows: Array<{ id: string }>) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((label) => ({
    label,
    visitors: chats.length,
    chats: chats.length,
    bookings: bookingRows.length,
  }));
}
