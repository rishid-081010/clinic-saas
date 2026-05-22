import fs from "node:fs";
import { Client } from "pg";

const secretsPath = "C:/Users/Rishi D/Downloads/L2.txt";

function readEnvFile(path) {
  const env = {};
  const content = fs.readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

const env = readEnvFile(secretsPath);

if (!env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL missing from L2.txt");
}

function normalizePostgresUrl(rawUrl) {
  const prefix = "postgresql://postgres:";
  if (!rawUrl.startsWith(prefix)) return rawUrl;

  const hostMarker = "@db.";
  const hostIndex = rawUrl.indexOf(hostMarker);
  if (hostIndex === -1) return rawUrl;

  const password = rawUrl.slice(prefix.length, hostIndex);
  const rest = rawUrl.slice(hostIndex);
  return `${prefix}${encodeURIComponent(password)}${rest}`;
}

function buildPoolerUrl(rawUrl, projectRef) {
  const prefix = "postgresql://postgres:";
  const hostMarker = "@db.";
  if (!rawUrl.startsWith(prefix) || !rawUrl.includes(hostMarker)) {
    return normalizePostgresUrl(rawUrl);
  }

  const password = rawUrl.slice(prefix.length, rawUrl.indexOf(hostMarker));
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`;
}

const client = new Client({
  connectionString: buildPoolerUrl(env.SUPABASE_DB_URL, env.SUPABASE_PROJECT_REF),
  ssl: { rejectUnauthorized: false },
});

const sql = `
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text,
  phone text,
  email text,
  website text,
  opening_days text,
  opening_hours text,
  parking_info text,
  insurance_info text,
  consultation_fee_info text,
  emergency_notice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid,
  email text,
  password_hash text,
  role text not null check (role in ('L2_ADMIN', 'L2_ASSISTANT')),
  display_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table public.organization_members
  add column if not exists password_hash text;

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question text not null,
  answer text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'faqs' and column_name = 'category'
  ) then
    alter table public.faqs alter column category drop not null;
  end if;
end $$;

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  qualification text,
  specialty text not null,
  available_days text[] not null default '{}',
  start_time text,
  end_time text,
  schedule jsonb not null default '[]'::jsonb,
  consultation_type text check (consultation_type in ('in_person', 'online', 'both')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_user_id uuid,
  patient_name text,
  patient_phone text,
  patient_email text,
  question_preview text,
  intent text,
  status text not null check (status in ('resolved', 'unresolved', 'booking_started')),
  unresolved_reason text,
  ai_paused boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.chat_sessions
  add column if not exists ai_paused boolean not null default false;

alter table public.chat_sessions
  add column if not exists patient_user_id uuid;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat_sessions(id) on delete cascade,
  sender text not null check (sender in ('patient', 'assistant', 'staff')),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_name text not null,
  patient_age int,
  patient_phone text not null,
  patient_email text,
  reason text not null,
  suggested_specialty text not null,
  suggested_doctor text,
  preferred_date date not null,
  preferred_time time not null,
  status text not null check (status in ('pending', 'follow_up_needed', 'confirmed', 'cancelled')),
  source text not null check (source in ('widget', 'manual')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.knowledge_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  uploaded_by uuid,
  status text not null check (status in ('uploaded', 'processing', 'ready', 'failed')),
  chunk_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_id uuid not null references public.knowledge_files(id) on delete cascade,
  source_type text not null default 'file' check (source_type in ('file', 'faq')),
  source_id uuid,
  chunk_index int not null,
  text text not null,
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customization_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null check (status in ('open', 'in_review', 'approved', 'rejected', 'completed')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  type text not null check (type in ('new_lead', 'booking_confirmation', 'unresolved_chat')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs alter column entity_id type text using entity_id::text;
alter table public.knowledge_chunks add column if not exists source_type text not null default 'file';
alter table public.knowledge_chunks add column if not exists source_id uuid;
alter table public.doctors add column if not exists qualification text;
alter table public.doctors add column if not exists schedule jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists patient_age int;
update public.doctors
set schedule = (
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'startTime', start_time, 'endTime', end_time)), '[]'::jsonb)
  from unnest(available_days) as day
)
where schedule = '[]'::jsonb and array_length(available_days, 1) is not null;
alter table public.knowledge_chunks drop constraint if exists knowledge_chunks_source_type_check;
alter table public.knowledge_chunks add constraint knowledge_chunks_source_type_check check (source_type in ('file', 'faq'));
update public.knowledge_chunks set source_type = 'file' where source_type is null;
update public.knowledge_chunks set source_id = file_id where source_id is null;

alter table public.organization_members drop constraint if exists organization_members_role_check;
update public.organization_members set role = 'L2_ASSISTANT' where role = 'L2_READONLY';
alter table public.organization_members add constraint organization_members_role_check check (role in ('L2_ADMIN', 'L2_ASSISTANT'));

create or replace function public.match_knowledge_chunks (
  p_organization_id uuid,
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  file_id uuid,
  text text,
  similarity float
)
language sql stable
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.file_id,
    knowledge_chunks.text,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks
  where knowledge_chunks.organization_id = p_organization_id
    and 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;

create index if not exists knowledge_chunks_org_idx on public.knowledge_chunks (organization_id);
create index if not exists knowledge_chunks_source_idx on public.knowledge_chunks (organization_id, source_type, source_id);
create index if not exists chat_sessions_org_created_idx on public.chat_sessions (organization_id, created_at desc);
create index if not exists chat_sessions_patient_user_idx on public.chat_sessions (organization_id, patient_user_id, created_at asc);
create index if not exists bookings_org_status_idx on public.bookings (organization_id, status);
create index if not exists notifications_org_read_idx on public.notifications (organization_id, read);

insert into public.organizations (
  slug,
  name,
  address,
  phone,
  email,
  website,
  opening_days,
  opening_hours,
  parking_info,
  insurance_info,
  consultation_fee_info,
  emergency_notice
) values (
  'aster-grove',
  'Aster Grove Clinic',
  '12 80 Feet Road, Indiranagar, Bengaluru',
  '+91 80 4567 2400',
  'frontdesk@astergrove.example',
  'https://astergrove.example',
  'Monday to Saturday',
  '08:00 to 20:00',
  'Basement parking is available for patients.',
  'Star Health, HDFC Ergo, ICICI Lombard, and Care Health are accepted.',
  'General consultation starts at INR 700. Specialist fees vary by doctor.',
  'For chest pain, severe breathing difficulty, or loss of consciousness, call emergency services immediately.'
) on conflict (slug) do update set
  name = excluded.name,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  website = excluded.website,
  opening_days = excluded.opening_days,
  opening_hours = excluded.opening_hours,
  parking_info = excluded.parking_info,
  insurance_info = excluded.insurance_info,
  consultation_fee_info = excluded.consultation_fee_info,
  emergency_notice = excluded.emergency_notice,
  updated_at = now();

insert into public.organization_members (
  organization_id,
  email,
  password_hash,
  role,
  display_name
) select
  organizations.id,
  'admin@astergrove.example',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  'L2_ADMIN',
  'Aster Grove Admin'
from public.organizations
where slug = 'aster-grove'
on conflict (organization_id, email) do update set
  role = excluded.role,
  display_name = excluded.display_name,
  password_hash = coalesce(public.organization_members.password_hash, excluded.password_hash);

insert into public.organization_members (
  organization_id,
  email,
  password_hash,
  role,
  display_name
) select
  organizations.id,
  'assistant@astergrove.example',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  'L2_ASSISTANT',
  'Aster Grove Assistant'
from public.organizations
where slug = 'aster-grove'
on conflict (organization_id, email) do update set
  role = excluded.role,
  display_name = excluded.display_name,
  password_hash = coalesce(public.organization_members.password_hash, excluded.password_hash);

update public.organization_members
set password_hash = extensions.crypt('password123', extensions.gen_salt('bf'))
where password_hash is null;

insert into public.faqs (organization_id, question, answer, active)
select id, 'What are the clinic timings?', 'The clinic is open Monday to Saturday from 08:00 to 20:00.', true
from public.organizations where slug = 'aster-grove'
and not exists (
  select 1 from public.faqs
  where faqs.organization_id = organizations.id
    and faqs.question = 'What are the clinic timings?'
);

insert into public.doctors (
  organization_id,
  name,
  qualification,
  specialty,
  available_days,
  start_time,
  end_time,
  schedule,
  consultation_type,
  active
)
select id, 'Dr. Kavya Rao', 'MBBS, MD Pediatrics', 'Pediatrics', array['Mon','Tue','Wed','Thu','Fri','Sat'], '16:00', '20:00', '[{"day":"Mon","startTime":"16:00","endTime":"20:00"},{"day":"Tue","startTime":"16:00","endTime":"20:00"},{"day":"Wed","startTime":"16:00","endTime":"20:00"},{"day":"Thu","startTime":"16:00","endTime":"20:00"},{"day":"Fri","startTime":"16:00","endTime":"20:00"},{"day":"Sat","startTime":"16:00","endTime":"20:00"}]'::jsonb, 'in_person', true
from public.organizations where slug = 'aster-grove'
and not exists (
  select 1 from public.doctors
  where doctors.organization_id = organizations.id
    and doctors.name = 'Dr. Kavya Rao'
    and doctors.specialty = 'Pediatrics'
);

delete from public.faqs a
using public.faqs b
where a.organization_id = b.organization_id
  and a.question = b.question
  and a.ctid < b.ctid;

delete from public.doctors a
using public.doctors b
where a.organization_id = b.organization_id
  and a.name = b.name
  and a.specialty = b.specialty
  and a.ctid < b.ctid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-base',
  'knowledge-base',
  false,
  10485760,
  array['application/pdf','text/plain','text/csv','text/markdown']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
`;

async function main() {
  await client.connect();
  try {
    await client.query(sql);
    const result = await client.query(`
      select
        (select count(*)::int from public.organizations) as organizations,
        (select count(*)::int from public.organization_members) as organization_members,
        (select count(*)::int from public.faqs) as faqs,
        (select count(*)::int from public.doctors) as doctors
    `);
    console.log(JSON.stringify({ ok: true, counts: result.rows[0] }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
