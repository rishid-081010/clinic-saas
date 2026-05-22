export type Role = "L2_ADMIN" | "L2_ASSISTANT";

export type ChatStatus = "resolved" | "unresolved" | "booking_started";
export type BookingStatus = "pending" | "follow_up_needed" | "confirmed" | "cancelled";
export type KnowledgeFileStatus = "uploaded" | "processing" | "ready" | "failed";
export type CustomizationStatus = "open" | "in_review" | "approved" | "rejected" | "completed";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  openingDays: string;
  openingHours: string;
  parkingInfo: string;
  insuranceInfo: string;
  consultationFeeInfo: string;
  emergencyNotice: string;
};

export type User = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  sender: "patient" | "assistant" | "staff";
  text: string;
  createdAt: string;
};

export type Chat = {
  id: string;
  organizationId: string;
  patientUserId?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  questionPreview: string;
  intent: string;
  status: ChatStatus;
  unresolvedReason?: string;
  aiPaused?: boolean;
  createdAt: string;
  messages: ChatMessage[];
};

export type BookingRequest = {
  id: string;
  organizationId: string;
  patientName: string;
  patientAge?: number;
  patientPhone: string;
  patientEmail?: string;
  reason: string;
  suggestedSpecialty: string;
  suggestedDoctor?: string;
  preferredDate: string;
  preferredTime: string;
  status: BookingStatus;
  source: "widget" | "manual";
  createdAt: string;
  confirmedAt?: string;
};

export type Faq = {
  id: string;
  organizationId: string;
  question: string;
  answer: string;
  category: string;
  active: boolean;
  updatedAt: string;
};

export type Doctor = {
  id: string;
  organizationId: string;
  name: string;
  qualification: string;
  specialty: string;
  availableDays: string[];
  startTime: string;
  endTime: string;
  schedule: Array<{ day: string; startTime: string; endTime: string }>;
  consultationType: "in_person" | "online" | "both";
  active: boolean;
};

export type KnowledgeFile = {
  id: string;
  organizationId: string;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  status: KnowledgeFileStatus;
  chunkCount: number;
  extractedText?: string;
};

export type KnowledgeChunk = {
  id: string;
  organizationId: string;
  fileId: string;
  sourceType?: "file" | "faq" | "clinic_profile";
  sourceId?: string;
  text: string;
  embedding: number[];
};

export type CustomizationRequest = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: CustomizationStatus;
  createdBy: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  organizationId: string;
  title: string;
  type: "new_lead" | "booking_confirmation" | "unresolved_chat";
  read: boolean;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  organizationId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export type Database = {
  organizations: Organization[];
  users: User[];
  chats: Chat[];
  bookings: BookingRequest[];
  faqs: Faq[];
  doctors: Doctor[];
  knowledgeFiles: KnowledgeFile[];
  knowledgeChunks: KnowledgeChunk[];
  customizationRequests: CustomizationRequest[];
  notifications: Notification[];
  auditLogs: AuditLog[];
};
