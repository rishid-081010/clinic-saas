import bcrypt from "bcryptjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { buildSupabasePoolerUrl, config, isSupabaseConfigured } from "./config.js";
import { AuditLog, BookingRequest, Chat, ChatMessage, CustomizationRequest, Database, Doctor, Faq, KnowledgeChunk, KnowledgeFile, Notification, Organization, Role } from "./types.js";

const dataDir = path.resolve(process.cwd(), "apps/api/data");
const dataPath = path.join(dataDir, "db.json");

let db: Database | null = null;

export async function loadDb() {
  if (db) return db;

  if (isSupabaseConfigured()) {
    db = await loadSupabaseDb();
    return db;
  }

  await mkdir(dataDir, { recursive: true });

  try {
    db = JSON.parse(await readFile(dataPath, "utf8")) as Database;
  } catch {
    db = seedDb();
    await saveDb();
  }

  return db;
}

export async function saveDb() {
  if (!db) return;
  if (isSupabaseConfigured()) {
    await saveSupabaseDb(db);
    return;
  }
  await writeFile(dataPath, JSON.stringify(db, null, 2));
}

export function getDb() {
  if (!db) throw new Error("Database not loaded");
  return db;
}

export function id(prefix: string) {
  if (isSupabaseConfigured()) return crypto.randomUUID();
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function now() {
  return new Date().toISOString();
}

function seedDb(): Database {
  const organizationId = "org_aster_grove";
  const passwordHash = bcrypt.hashSync("password123", 10);

  return {
    organizations: [
      {
        id: organizationId,
        slug: "aster-grove",
        name: "Aster Grove Clinic",
        address: "12 80 Feet Road, Indiranagar, Bengaluru",
        phone: "+91 80 4567 2400",
        email: "frontdesk@astergrove.example",
        website: "https://astergrove.example",
        openingDays: "Monday to Saturday",
        openingHours: "08:00 to 20:00",
        parkingInfo: "Basement parking is available for patients.",
        insuranceInfo: "Star Health, HDFC Ergo, ICICI Lombard, and Care Health are accepted.",
        consultationFeeInfo: "General consultation starts at INR 700. Specialist fees vary by doctor.",
        emergencyNotice: "For chest pain, severe breathing difficulty, or loss of consciousness, call emergency services immediately.",
      },
    ],
    users: [
      {
        id: "usr_admin",
        organizationId,
        name: "Ananya Iyer",
        email: "admin@astergrove.example",
        passwordHash,
        role: "L2_ADMIN",
      },
      {
        id: "usr_assistant",
        organizationId,
        name: "Priya Nair",
        email: "assistant@astergrove.example",
        passwordHash,
        role: "L2_ASSISTANT",
      },
    ],
    chats: [
      {
        id: "chat_2048",
        organizationId,
        patientName: "Meera K",
        patientPhone: "+91 90000 11111",
        questionPreview: "Do you accept Star Health for dermatology visits?",
        intent: "Insurance",
        status: "resolved",
        createdAt: now(),
        messages: [
          {
            id: "msg_1",
            chatId: "chat_2048",
            sender: "patient",
            text: "Do you accept Star Health for dermatology visits?",
            createdAt: now(),
          },
          {
            id: "msg_2",
            chatId: "chat_2048",
            sender: "assistant",
            text: "Yes. Star Health is accepted for eligible outpatient services. Please confirm cashless eligibility at the billing desk.",
            createdAt: now(),
          },
        ],
      },
      {
        id: "chat_2047",
        organizationId,
        patientName: "Arjun P",
        patientPhone: "+91 90000 22222",
        questionPreview: "I have chest tightness and dizziness. Should I book?",
        intent: "Safety",
        status: "unresolved",
        unresolvedReason: "Medical/safety concern",
        createdAt: now(),
        messages: [
          {
            id: "msg_3",
            chatId: "chat_2047",
            sender: "patient",
            text: "I have chest tightness and dizziness. Should I book?",
            createdAt: now(),
          },
        ],
      },
    ],
    bookings: [
      {
        id: "book_1191",
        organizationId,
        patientName: "Nisha S",
        patientAge: 8,
        patientPhone: "+91 90000 33333",
        patientEmail: "nisha@example.com",
        reason: "Child fever",
        suggestedSpecialty: "Pediatrics",
        suggestedDoctor: "Dr. Kavya Rao",
        preferredDate: "2026-05-10",
        preferredTime: "17:30",
        status: "pending",
        source: "widget",
        createdAt: now(),
      },
      {
        id: "book_1190",
        organizationId,
        patientName: "Vikram L",
        patientAge: 34,
        patientPhone: "+91 90000 44444",
        reason: "Knee pain after running",
        suggestedSpecialty: "Orthopedics",
        suggestedDoctor: "Dr. Aman Verma",
        preferredDate: "2026-05-11",
        preferredTime: "11:00",
        status: "confirmed",
        source: "widget",
        createdAt: now(),
        confirmedAt: now(),
      },
    ],
    faqs: [
      {
        id: "faq_insurance",
        organizationId,
        question: "Which insurance plans are accepted?",
        answer: "Star Health, HDFC Ergo, ICICI Lombard, and Care Health are accepted for eligible services.",
        category: "Insurance",
        active: true,
        updatedAt: now(),
      },
      {
        id: "faq_timings",
        organizationId,
        question: "What are the clinic timings?",
        answer: "The clinic is open Monday to Saturday from 08:00 to 20:00.",
        category: "Clinic Timing",
        active: true,
        updatedAt: now(),
      },
    ],
    doctors: [
      {
        id: "doc_kavya",
        organizationId,
        name: "Dr. Kavya Rao",
        qualification: "MBBS, MD Pediatrics",
        specialty: "Pediatrics",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        startTime: "16:00",
        endTime: "20:00",
        schedule: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({ day, startTime: "16:00", endTime: "20:00" })),
        consultationType: "in_person",
        active: true,
      },
      {
        id: "doc_aman",
        organizationId,
        name: "Dr. Aman Verma",
        qualification: "MBBS, MS Orthopedics",
        specialty: "Orthopedics",
        availableDays: ["Tue", "Thu", "Sat"],
        startTime: "10:00",
        endTime: "14:00",
        schedule: ["Tue", "Thu", "Sat"].map((day) => ({ day, startTime: "10:00", endTime: "14:00" })),
        consultationType: "both",
        active: true,
      },
    ],
    knowledgeFiles: [],
    knowledgeChunks: [],
    customizationRequests: [
      {
        id: "req_43",
        organizationId,
        title: "Add WhatsApp confirmation template",
        description: "We want booking confirmations to be formatted for WhatsApp.",
        category: "Booking Flow Change",
        priority: "medium",
        status: "in_review",
        createdBy: "usr_admin",
        createdAt: now(),
      },
    ],
    notifications: [
      {
        id: "not_1",
        organizationId,
        title: "New booking request from Nisha S",
        type: "new_lead",
        read: false,
        createdAt: now(),
      },
      {
        id: "not_2",
        organizationId,
        title: "Unresolved safety chat needs review",
        type: "unresolved_chat",
        read: false,
        createdAt: now(),
      },
    ],
    auditLogs: [],
  };
}

async function withPg<T>(fn: (client: Client) => Promise<T>) {
  if (!config.supabaseDbUrl) throw new Error("SUPABASE_DB_URL is not configured");
  const client = new Client({
    connectionString: buildSupabasePoolerUrl(config.supabaseDbUrl),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function loadSupabaseDb(): Promise<Database> {
  return withPg(async (client) => {
    const [
      organizations,
      members,
      chats,
      messages,
      bookings,
      faqs,
      doctors,
      files,
      chunks,
      requests,
      notifications,
      auditLogs,
    ] = await Promise.all([
      client.query("select * from public.organizations order by created_at asc"),
      client.query("select * from public.organization_members order by created_at asc"),
      client.query("select * from public.chat_sessions order by created_at desc"),
      client.query("select * from public.chat_messages order by created_at asc"),
      client.query("select * from public.bookings order by created_at desc"),
      client.query("select * from public.faqs order by updated_at desc"),
      client.query("select * from public.doctors order by created_at desc"),
      client.query("select * from public.knowledge_files order by created_at desc"),
      client.query("select id, organization_id, file_id, source_type, source_id, chunk_index, text, embedding::text, created_at from public.knowledge_chunks order by chunk_index asc"),
      client.query("select * from public.customization_requests order by created_at desc"),
      client.query("select * from public.notifications order by created_at desc"),
      client.query("select * from public.audit_logs order by created_at desc"),
    ]);

    const chatMessages = messages.rows.map(mapChatMessage);
    return {
      organizations: organizations.rows.map(mapOrganization),
      users: members.rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.display_name ?? row.email ?? "Staff user",
        email: row.email ?? "admin@astergrove.example",
        passwordHash: row.password_hash ?? bcrypt.hashSync("password123", 10),
        role: normalizeRole(row.role),
      })),
      chats: chats.rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        patientUserId: row.patient_user_id ?? undefined,
        patientName: row.patient_name ?? undefined,
        patientPhone: row.patient_phone ?? undefined,
        patientEmail: row.patient_email ?? undefined,
        questionPreview: row.question_preview ?? "",
        intent: row.intent ?? "General FAQ",
        status: row.status,
        unresolvedReason: row.unresolved_reason ?? undefined,
        aiPaused: row.ai_paused ?? false,
        createdAt: row.created_at.toISOString(),
        messages: chatMessages.filter((message) => message.chatId === row.id),
      })),
      bookings: bookings.rows.map(mapBooking),
      faqs: faqs.rows.map(mapFaq),
      doctors: doctors.rows.map(mapDoctor),
      knowledgeFiles: files.rows.map(mapKnowledgeFile),
      knowledgeChunks: chunks.rows.map(mapKnowledgeChunk),
      customizationRequests: requests.rows.map(mapCustomizationRequest),
      notifications: notifications.rows.map(mapNotification),
      auditLogs: auditLogs.rows.map(mapAuditLog),
    };
  });
}

function normalizeRole(role: string): Role {
  if (role === "L2_ADMIN" || role === "L2_ASSISTANT") return role;
  return "L2_ASSISTANT";
}

async function saveSupabaseDb(current: Database) {
  await withPg(async (client) => {
    await client.query("begin");
    try {
      await upsertOrganizations(client, current.organizations);
      await upsertUsers(client, current.users);
      await replaceOrgScoped(client, "faqs", current.faqs, upsertFaqs);
      await replaceOrgScoped(client, "doctors", current.doctors, upsertDoctors);
      await replaceOrgScoped(client, "chat_sessions", current.chats, upsertChats);
      await replaceOrgScoped(client, "bookings", current.bookings, upsertBookings);
      await replaceOrgScoped(client, "knowledge_files", current.knowledgeFiles, upsertKnowledgeFiles);
      await replaceOrgScoped(client, "knowledge_chunks", current.knowledgeChunks, upsertKnowledgeChunks);
      await replaceOrgScoped(client, "customization_requests", current.customizationRequests, upsertCustomizationRequests);
      await replaceOrgScoped(client, "notifications", current.notifications, upsertNotifications);
      await replaceOrgScoped(client, "audit_logs", current.auditLogs, upsertAuditLogs);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function replaceOrgScoped<T extends { organizationId: string }>(
  client: Client,
  table: string,
  rows: T[],
  upsert: (client: Client, rows: T[]) => Promise<void>,
) {
  const orgIds = [...new Set(rows.map((row) => row.organizationId))];
  for (const orgId of orgIds) {
    await client.query(`delete from public.${table} where organization_id = $1`, [orgId]);
  }
  await upsert(client, rows);
}

async function upsertOrganizations(client: Client, rows: Organization[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.organizations (id, slug, name, address, phone, email, website, opening_days, opening_hours, parking_info, insurance_info, consultation_fee_info, emergency_notice)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (id) do update set slug=excluded.slug, name=excluded.name, address=excluded.address, phone=excluded.phone, email=excluded.email, website=excluded.website, opening_days=excluded.opening_days, opening_hours=excluded.opening_hours, parking_info=excluded.parking_info, insurance_info=excluded.insurance_info, consultation_fee_info=excluded.consultation_fee_info, emergency_notice=excluded.emergency_notice, updated_at=now()`,
      [row.id, row.slug, row.name, row.address, row.phone, row.email, row.website, row.openingDays, row.openingHours, row.parkingInfo, row.insuranceInfo, row.consultationFeeInfo, row.emergencyNotice],
    );
  }
}

async function upsertUsers(client: Client, rows: Database["users"]) {
  const hasPasswordHash = await columnExists(client, "organization_members", "password_hash");
  for (const row of rows) {
    if (hasPasswordHash) {
      await client.query(
        `insert into public.organization_members (id, organization_id, email, role, display_name, password_hash)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (organization_id, email) do update set role=excluded.role, display_name=excluded.display_name, password_hash=excluded.password_hash`,
        [row.id, row.organizationId, row.email, row.role, row.name, row.passwordHash],
      );
    } else {
      await client.query(
        `insert into public.organization_members (id, organization_id, email, role, display_name)
         values ($1,$2,$3,$4,$5)
         on conflict (organization_id, email) do update set role=excluded.role, display_name=excluded.display_name`,
        [row.id, row.organizationId, row.email, row.role, row.name],
      );
    }
  }
}

async function upsertFaqs(client: Client, rows: Faq[]) {
  const hasCategory = await columnExists(client, "faqs", "category");
  for (const row of rows) {
    if (hasCategory) {
      await client.query(
        `insert into public.faqs (id, organization_id, question, answer, category, active, updated_at) values ($1,$2,$3,$4,$5,$6,$7)`,
        [row.id, row.organizationId, row.question, row.answer, row.category ?? "General", row.active, row.updatedAt],
      );
    } else {
      await client.query(
        `insert into public.faqs (id, organization_id, question, answer, active, updated_at) values ($1,$2,$3,$4,$5,$6)`,
        [row.id, row.organizationId, row.question, row.answer, row.active, row.updatedAt],
      );
    }
  }
}

async function upsertDoctors(client: Client, rows: Doctor[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.doctors (id, organization_id, name, qualification, specialty, available_days, start_time, end_time, schedule, consultation_type, active) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
      [row.id, row.organizationId, row.name, row.qualification, row.specialty, row.availableDays, row.startTime, row.endTime, JSON.stringify(row.schedule ?? []), row.consultationType, row.active],
    );
  }
}

async function upsertChats(client: Client, rows: Chat[]) {
  const hasAiPaused = await columnExists(client, "chat_sessions", "ai_paused");
  const hasPatientUserId = await columnExists(client, "chat_sessions", "patient_user_id");
  for (const row of rows) {
    if (hasAiPaused && hasPatientUserId) {
      await client.query(
        `insert into public.chat_sessions (id, organization_id, patient_user_id, patient_name, patient_phone, patient_email, question_preview, intent, status, unresolved_reason, ai_paused, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [row.id, row.organizationId, row.patientUserId ?? null, row.patientName, row.patientPhone, row.patientEmail, row.questionPreview, row.intent, row.status, row.unresolvedReason, row.aiPaused ?? false, row.createdAt],
      );
    } else if (hasAiPaused) {
      await client.query(
        `insert into public.chat_sessions (id, organization_id, patient_name, patient_phone, patient_email, question_preview, intent, status, unresolved_reason, ai_paused, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [row.id, row.organizationId, row.patientName, row.patientPhone, row.patientEmail, row.questionPreview, row.intent, row.status, row.unresolvedReason, row.aiPaused ?? false, row.createdAt],
      );
    } else if (hasPatientUserId) {
      await client.query(
        `insert into public.chat_sessions (id, organization_id, patient_user_id, patient_name, patient_phone, patient_email, question_preview, intent, status, unresolved_reason, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [row.id, row.organizationId, row.patientUserId ?? null, row.patientName, row.patientPhone, row.patientEmail, row.questionPreview, row.intent, row.status, row.unresolvedReason, row.createdAt],
      );
    } else {
      await client.query(
        `insert into public.chat_sessions (id, organization_id, patient_name, patient_phone, patient_email, question_preview, intent, status, unresolved_reason, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [row.id, row.organizationId, row.patientName, row.patientPhone, row.patientEmail, row.questionPreview, row.intent, row.status, row.unresolvedReason, row.createdAt],
      );
    }
    for (const message of row.messages) {
      await client.query(
        `insert into public.chat_messages (id, chat_id, sender, text, created_at) values ($1,$2,$3,$4,$5)`,
        [message.id, row.id, message.sender, message.text, message.createdAt],
      );
    }
  }
}

async function upsertBookings(client: Client, rows: BookingRequest[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.bookings (id, organization_id, patient_name, patient_age, patient_phone, patient_email, reason, suggested_specialty, suggested_doctor, preferred_date, preferred_time, status, source, created_at, confirmed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [row.id, row.organizationId, row.patientName, row.patientAge ?? null, row.patientPhone, row.patientEmail, row.reason, row.suggestedSpecialty, row.suggestedDoctor, row.preferredDate, row.preferredTime, row.status, row.source, row.createdAt, row.confirmedAt],
    );
  }
}

async function upsertKnowledgeFiles(client: Client, rows: KnowledgeFile[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.knowledge_files (id, organization_id, storage_path, file_name, file_type, uploaded_by, status, chunk_count, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id, row.organizationId, `${row.organizationId}/${row.id}/${row.fileName}`, row.fileName, row.fileType, row.uploadedBy || null, row.status, row.chunkCount, row.uploadedAt],
    );
  }
}

async function upsertKnowledgeChunks(client: Client, rows: KnowledgeChunk[]) {
  let index = 0;
  for (const row of rows) {
    await client.query(
      `insert into public.knowledge_chunks (id, organization_id, file_id, source_type, source_id, chunk_index, text, embedding) values ($1,$2,$3,$4,$5,$6,$7,$8::extensions.vector)`,
      [row.id, row.organizationId, row.fileId, row.sourceType ?? "file", row.sourceId ?? row.fileId, index, row.text, `[${row.embedding.join(",")}]`],
    );
    index += 1;
  }
}

async function upsertCustomizationRequests(client: Client, rows: CustomizationRequest[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.customization_requests (id, organization_id, title, description, category, priority, status, created_by, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id, row.organizationId, row.title, row.description, row.category, row.priority, row.status, row.createdBy, row.createdAt],
    );
  }
}

async function upsertNotifications(client: Client, rows: Notification[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.notifications (id, organization_id, title, type, read, created_at) values ($1,$2,$3,$4,$5,$6)`,
      [row.id, row.organizationId, row.title, row.type, row.read, row.createdAt],
    );
  }
}

async function upsertAuditLogs(client: Client, rows: AuditLog[]) {
  for (const row of rows) {
    await client.query(
      `insert into public.audit_logs (id, organization_id, actor_user_id, action, entity_type, entity_id, created_at) values ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, row.organizationId, row.actorUserId, row.action, row.entityType, row.entityId, row.createdAt],
    );
  }
}

function mapOrganization(row: any): Organization {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    openingDays: row.opening_days ?? "",
    openingHours: row.opening_hours ?? "",
    parkingInfo: row.parking_info ?? "",
    insuranceInfo: row.insurance_info ?? "",
    consultationFeeInfo: row.consultation_fee_info ?? "",
    emergencyNotice: row.emergency_notice ?? "",
  };
}

function mapChatMessage(row: any): ChatMessage {
  return { id: row.id, chatId: row.chat_id, sender: row.sender, text: row.text, createdAt: row.created_at.toISOString() };
}

function mapBooking(row: any): BookingRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientName: row.patient_name,
    patientAge: row.patient_age ?? undefined,
    patientPhone: row.patient_phone,
    patientEmail: row.patient_email ?? undefined,
    reason: row.reason,
    suggestedSpecialty: row.suggested_specialty,
    suggestedDoctor: row.suggested_doctor ?? undefined,
    preferredDate: row.preferred_date.toISOString?.().slice(0, 10) ?? row.preferred_date,
    preferredTime: String(row.preferred_time).slice(0, 5),
    status: row.status,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    confirmedAt: row.confirmed_at?.toISOString(),
  };
}

function mapFaq(row: any): Faq {
  return { id: row.id, organizationId: row.organization_id, question: row.question, answer: row.answer, category: row.category, active: row.active, updatedAt: row.updated_at.toISOString() };
}

function mapDoctor(row: any): Doctor {
  const availableDays = row.available_days ?? [];
  const startTime = row.start_time ?? "";
  const endTime = row.end_time ?? "";
  const schedule = Array.isArray(row.schedule) && row.schedule.length
    ? row.schedule
    : availableDays.map((day: string) => ({ day, startTime, endTime }));
  return { id: row.id, organizationId: row.organization_id, name: row.name, qualification: row.qualification ?? "", specialty: row.specialty, availableDays, startTime, endTime, schedule, consultationType: row.consultation_type ?? "in_person", active: row.active };
}

function mapKnowledgeFile(row: any): KnowledgeFile {
  return { id: row.id, organizationId: row.organization_id, fileName: row.file_name, fileType: row.file_type, uploadedBy: row.uploaded_by ?? "", uploadedAt: row.created_at.toISOString(), status: row.status, chunkCount: row.chunk_count };
}

function mapKnowledgeChunk(row: any): KnowledgeChunk {
  return { id: row.id, organizationId: row.organization_id, fileId: row.file_id, sourceType: row.source_type ?? "file", sourceId: row.source_id ?? row.file_id, text: row.text, embedding: parseVector(row.embedding) };
}

function mapCustomizationRequest(row: any): CustomizationRequest {
  return { id: row.id, organizationId: row.organization_id, title: row.title, description: row.description, category: row.category, priority: row.priority, status: row.status, createdBy: row.created_by ?? "", createdAt: row.created_at.toISOString() };
}

function mapNotification(row: any): Notification {
  return { id: row.id, organizationId: row.organization_id, title: row.title, type: row.type, read: row.read, createdAt: row.created_at.toISOString() };
}

function mapAuditLog(row: any): AuditLog {
  return { id: row.id, organizationId: row.organization_id, actorUserId: row.actor_user_id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, createdAt: row.created_at.toISOString() };
}

function parseVector(value: string | number[]) {
  if (Array.isArray(value)) return value;
  return value.replace(/^\[|\]$/g, "").split(",").filter(Boolean).map(Number);
}

async function columnExists(client: Client, tableName: string, columnName: string) {
  const result = await client.query(
    `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2 limit 1`,
    [tableName, columnName],
  );
  return (result.rowCount ?? 0) > 0;
}
