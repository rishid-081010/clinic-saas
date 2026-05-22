import fs from "node:fs";

const localSecretsPath = "C:/Users/Rishi D/Downloads/L2.txt";

if (fs.existsSync(localSecretsPath)) {
  const content = fs.readFileSync(localSecretsPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    process.env[key] ??= value;
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseDbUrl: process.env.SUPABASE_DB_URL,
  supabaseProjectRef: process.env.SUPABASE_PROJECT_REF,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "knowledge-base",
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  googleServiceAccountJsonBase64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  vertexLocation: process.env.VERTEX_LOCATION ?? process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
  geminiEmbeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 768),
};

export function isSupabaseConfigured() {
  return Boolean(config.supabaseDbUrl);
}

export function normalizePostgresUrl(rawUrl: string) {
  const prefix = "postgresql://postgres:";
  if (!rawUrl.startsWith(prefix)) return rawUrl;

  const hostIndex = rawUrl.indexOf("@db.");
  if (hostIndex === -1) return rawUrl;

  const password = rawUrl.slice(prefix.length, hostIndex);
  const rest = rawUrl.slice(hostIndex);
  return `${prefix}${encodeURIComponent(password)}${rest}`;
}

export function buildSupabasePoolerUrl(rawUrl: string) {
  if (!config.supabaseProjectRef) return normalizePostgresUrl(rawUrl);

  const prefix = "postgresql://postgres:";
  const hostIndex = rawUrl.indexOf("@db.");
  if (!rawUrl.startsWith(prefix) || hostIndex === -1) return normalizePostgresUrl(rawUrl);

  const password = rawUrl.slice(prefix.length, hostIndex);
  return `postgresql://postgres.${config.supabaseProjectRef}:${encodeURIComponent(password)}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`;
}
