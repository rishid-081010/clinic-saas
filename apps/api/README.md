# Patient Engagement API

Backend for the L2 Hospital Staff MVP.

## Run

```bash
npm run start:api
```

API runs at:

```txt
http://127.0.0.1:4000
```

## Demo Login

```txt
Admin:     admin@astergrove.example / password123
Read-only: readonly@astergrove.example / password123
```

## Environment

```txt
PORT=4000
HOST=127.0.0.1
FRONTEND_ORIGIN=http://127.0.0.1:5173
JWT_SECRET=replace-this
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id
VERTEX_LOCATION=us-central1
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
```

Uploaded documents are extracted, chunked, embedded with Vertex Gemini, stored in the vector store, retrieved with cosine similarity, and answered by Gemini through Vertex AI.

## Main Routes

```txt
POST /api/auth/login
GET  /api/auth/me

GET   /api/l2/overview
GET   /api/l2/chats
GET   /api/l2/chats/:id
PATCH /api/l2/chats/:id/status

GET   /api/l2/booking-requests
GET   /api/l2/confirmed-appointments
PATCH /api/l2/booking-requests/:id/status
DELETE /api/l2/bookings/:id

GET    /api/l2/faqs
POST   /api/l2/faqs
PATCH  /api/l2/faqs/:id
DELETE /api/l2/faqs/:id

GET    /api/l2/doctors
POST   /api/l2/doctors
PATCH  /api/l2/doctors/:id
DELETE /api/l2/doctors/:id

GET   /api/l2/clinic-details
PATCH /api/l2/clinic-details

GET    /api/l2/knowledge-base/files
POST   /api/l2/knowledge-base/files
DELETE /api/l2/knowledge-base/files/:id

GET  /api/l2/customization-requests
POST /api/l2/customization-requests

POST /api/public/:orgSlug/widget/chat/message
POST /api/public/:orgSlug/widget/booking-request
```

## Frontend Connection

Set the frontend env var:

```txt
VITE_API_URL=http://127.0.0.1:4000
```

Then call backend only through the frontend's `apiClient.ts`.
