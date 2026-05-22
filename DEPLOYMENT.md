# Production setup

## Render web service

Use this repo as one Render web service.

- Build command: `npm install && npm run build:prod`
- Start command: `npm run start:prod`
- Runtime: Node

Required env vars:

- `NODE_ENV=production`
- `PORT=10000`
- `HOST=0.0.0.0`
- `SERVE_FRONTEND=true`
- `FRONTEND_DIST=frontend-review/dist`
- `JWT_SECRET=<strong random value>`
- `SUPABASE_URL=<project url>`
- `SUPABASE_PROJECT_REF=<project ref>`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key>`
- `SUPABASE_DB_URL=<postgres connection string>`
- `SUPABASE_STORAGE_BUCKET=knowledge-base`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64 encoded service account JSON>`
- `GOOGLE_CLOUD_PROJECT=<google cloud project id>`
- `VERTEX_LOCATION=us-central1`
- `GEMINI_CHAT_MODEL=gemini-2.5-flash`
- `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`
- `GEMINI_EMBEDDING_DIMENSIONS=768`

Local Vertex testing:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
$env:GOOGLE_CLOUD_PROJECT="<google cloud project id>"
$env:VERTEX_LOCATION="us-central1"
```

Encode the service account for Render:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\service-account.json"))
```

## Supabase schema

Run once from local after setting the Supabase env vars:

```bash
node scripts/setup-supabase-prod.mjs
```

This creates the L2 tables, vector extension, vector search RPC, indexes, storage bucket, and starter org/admin rows.

## Cron ping

Create the included Render cron job or manually create one that runs every 5 minutes:

```bash
npm run keepalive
```

Set `KEEPALIVE_URL=https://your-render-service.onrender.com`.

## Data flow

Frontend calls the backend under `/api`. The backend reads/writes Supabase Postgres. Uploaded knowledge files go to Supabase Storage, extracted chunks and embeddings go to `knowledge_chunks`, and Gemini answers using retrieved context from those chunks.
