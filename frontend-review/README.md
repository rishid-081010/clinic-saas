# AI Patient Engagement Platform - L2 Frontend

Frontend MVP for a tenant-scoped hospital/clinic admin dashboard.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui-style components
- lucide-react
- TanStack Query
- React Router

## Scope

This build is for **L2 Hospital Staff / Office Admin** users only.

Included modules:

- Website chatbot transcript review
- Appointment booking records
- FAQ and clinic detail management
- Customization request tracking
- Organization-level analytics
- Notifications for leads, bookings, and unresolved chats

Excluded from this L2 frontend:

- Super Admin / L1 tenant management
- Cross-organization analytics
- Platform-wide AI defaults
- Platform-level module availability controls

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```txt
src/
  components/
    layout/      App shell and navigation
    shared/      Reusable dashboard components
    ui/          shadcn-style primitives
  data/          Tenant-scoped mock data
  lib/           Utilities and mock API
  pages/         Route-level screens
```

## Notes

Data is currently mocked through TanStack Query-compatible async functions in
`src/lib/mock-api.ts`, making it straightforward to replace with real API calls.

