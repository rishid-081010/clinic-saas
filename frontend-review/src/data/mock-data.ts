export type BookingStatus = "Confirmed" | "Needs review" | "Assisted";
export type ChatStatus = "Resolved" | "Unresolved" | "Escalated";
export type RequestStatus = "Open" | "In review" | "Approved";

export const clinic = {
  name: "Northstar Family Clinic",
  plan: "L2 Admin Workspace",
  location: "Austin, TX",
  modules: ["Website Chatbot", "Appointment Booking"],
};

export const metrics = [
  { label: "Website leads", value: "186", delta: "+18%", tone: "teal" },
  { label: "Booked appointments", value: "74", delta: "+11%", tone: "green" },
  { label: "Unresolved chats", value: "9", delta: "-6%", tone: "amber" },
  { label: "Front-desk hours saved", value: "31h", delta: "+7h", tone: "coral" },
] as const;

export const notifications = [
  {
    id: "n-1",
    title: "New appointment confirmed",
    detail: "Maya Thompson booked with Dr. Patel for Tuesday 10:30 AM.",
    time: "4 min ago",
  },
  {
    id: "n-2",
    title: "Chat needs staff review",
    detail: "Visitor asked about insurance coverage not found in FAQ.",
    time: "22 min ago",
  },
  {
    id: "n-3",
    title: "Customization request updated",
    detail: "Brand color change is now in review by the service team.",
    time: "1 hr ago",
  },
];

export const transcripts = [
  {
    id: "chat-1001",
    visitor: "Maya Thompson",
    topic: "Knee pain and appointment availability",
    status: "Resolved" as ChatStatus,
    leadScore: 92,
    lastMessage: "The assistant suggested Orthopedics and offered two slots.",
    channel: "Website widget",
    time: "12:18 PM",
  },
  {
    id: "chat-1002",
    visitor: "Anonymous visitor",
    topic: "Accepted insurance plans",
    status: "Unresolved" as ChatStatus,
    leadScore: 61,
    lastMessage: "Visitor asked if the clinic accepts a local employer plan.",
    channel: "Website widget",
    time: "11:46 AM",
  },
  {
    id: "chat-1003",
    visitor: "Robert Chen",
    topic: "Chest discomfort after exercise",
    status: "Escalated" as ChatStatus,
    leadScore: 88,
    lastMessage: "Assistant recommended urgent review and notified staff.",
    channel: "Website widget",
    time: "10:30 AM",
  },
];

export const bookings = [
  {
    id: "book-2101",
    patient: "Maya Thompson",
    symptom: "Knee pain",
    suggestedDoctor: "Dr. Anika Patel",
    specialty: "Orthopedics",
    status: "Confirmed" as BookingStatus,
    appointment: "Tue, May 12 at 10:30 AM",
  },
  {
    id: "book-2102",
    patient: "Daniel Reyes",
    symptom: "Fever and sore throat",
    suggestedDoctor: "Dr. Leah Morgan",
    specialty: "Primary Care",
    status: "Assisted" as BookingStatus,
    appointment: "Wed, May 13 at 2:00 PM",
  },
  {
    id: "book-2103",
    patient: "Aisha Khan",
    symptom: "Prenatal nutrition question",
    suggestedDoctor: "Dr. Priya Shah",
    specialty: "OB-GYN",
    status: "Needs review" as BookingStatus,
    appointment: "Pending staff confirmation",
  },
];

export const faqs = [
  {
    id: "faq-1",
    question: "What insurance plans do you accept?",
    answer: "The clinic accepts most major commercial plans, Medicare, and select employer plans.",
    usage: 64,
    confidence: 78,
  },
  {
    id: "faq-2",
    question: "Can I book a same-day appointment?",
    answer: "Same-day slots are available for primary care when capacity is open.",
    usage: 48,
    confidence: 91,
  },
  {
    id: "faq-3",
    question: "Where is the clinic located?",
    answer: "Northstar Family Clinic is located at 412 Cedar Avenue, Austin, TX.",
    usage: 37,
    confidence: 96,
  },
];

export const requests = [
  {
    id: "req-1",
    title: "Update chatbot welcome tone",
    type: "AI behavior",
    status: "Open" as RequestStatus,
    submitted: "Today",
  },
  {
    id: "req-2",
    title: "Add Spanish FAQ set",
    type: "Content expansion",
    status: "In review" as RequestStatus,
    submitted: "Yesterday",
  },
  {
    id: "req-3",
    title: "Use clinic brand accent color",
    type: "Branding",
    status: "Approved" as RequestStatus,
    submitted: "May 7",
  },
];

export const conversionTrend = [
  { label: "Mon", visitors: 74, chats: 41, bookings: 18 },
  { label: "Tue", visitors: 88, chats: 49, bookings: 22 },
  { label: "Wed", visitors: 81, chats: 46, bookings: 20 },
  { label: "Thu", visitors: 95, chats: 54, bookings: 26 },
  { label: "Fri", visitors: 108, chats: 61, bookings: 31 },
  { label: "Sat", visitors: 84, chats: 43, bookings: 19 },
  { label: "Sun", visitors: 91, chats: 52, bookings: 24 },
];
