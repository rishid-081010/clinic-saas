import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

export const chatStatusSchema = z.object({
  status: z.enum(["resolved", "unresolved", "booking_started"]),
});

export const bookingStatusSchema = z.object({
  status: z.enum(["pending", "follow_up_needed", "confirmed", "cancelled"]),
});

export const faqSchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(3),
  category: z.string().min(2).default("General"),
  active: z.boolean().default(true),
});

export const doctorSchema = z.object({
  name: z.string().min(2),
  qualification: z.string().min(2),
  specialty: z.string().min(2),
  availableDays: z.array(z.string()).default([]),
  startTime: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  schedule: z.array(z.object({
    day: z.string().min(2),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
  })).min(1),
  consultationType: z.enum(["in_person", "online", "both"]),
  active: z.boolean().default(true),
});

export const clinicDetailsSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(2).optional(),
  phone: z.string().min(3).optional(),
  email: z.string().email().optional(),
  website: z.string().min(2).optional(),
  openingDays: z.string().min(2).optional(),
  openingHours: z.string().min(2).optional(),
  parkingInfo: z.string().optional(),
  insuranceInfo: z.string().optional(),
  consultationFeeInfo: z.string().optional(),
  emergencyNotice: z.string().optional(),
});

export const customizationRequestSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  category: z.string().min(2),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const clinicProfileItemSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(2),
});

export const memberRoleSchema = z.object({
  role: z.enum(["L2_ADMIN", "L2_ASSISTANT"]),
});

export const staffMessageSchema = z.object({
  message: z.string().min(1),
});

export const publicChatMessageSchema = z.object({
  chatId: z.string().optional(),
  patientUserId: z.string().uuid().optional(),
  message: z.string().min(1),
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
  patientEmail: z.string().email().optional(),
});

export const structuredAiResponseSchema = z.object({
  reply: z.string().min(1),
  actions: z.array(z.object({
    type: z.enum(["ESCALATE_CHAT"]),
    payload: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
  flags: z.object({
    intent: z.enum(["faq", "booking", "escalation", "general", "safety"]).default("general"),
    escalated: z.boolean().default(false),
    urgency: z.enum(["low", "normal", "high"]).default("normal"),
  }).default({
    intent: "general",
    escalated: false,
    urgency: "normal",
  }),
});

export const bookingRequestSchema = z.object({
  patientName: z.string().min(2),
  patientAge: z.coerce.number().int().min(0).max(130).optional(),
  patientPhone: z.string().min(5),
  patientEmail: z.string().email().optional(),
  reason: z.string().min(2),
  suggestedSpecialty: z.string().min(2).optional(),
  suggestedDoctor: z.string().min(2),
  preferredDate: z.string().min(1),
  preferredTime: z.string().min(1),
  source: z.enum(["widget", "manual"]).default("widget"),
});

export const doctorSuggestionSchema = z.object({
  reason: z.string().min(2),
  patientAge: z.coerce.number().int().min(0).max(130).optional(),
});
