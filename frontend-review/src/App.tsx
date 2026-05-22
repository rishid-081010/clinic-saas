import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { AppShell } from "./components/layout/app-shell";
import { AnalyticsPage } from "./pages/analytics-page";
import { BookingsPage } from "./pages/bookings-page";
import { CalendarPage } from "./pages/calendar-page";
import { CustomizationPage } from "./pages/customization-page";
import { DashboardPage } from "./pages/dashboard-page";
import { DoctorsPage } from "./pages/doctors-page";
import { FaqPage } from "./pages/faq-page";
import { HomePage } from "./pages/home-page";
import { KnowledgeBasePage } from "./pages/knowledge-base-page";
import { LiveChatsPage } from "./pages/live-chats-page";
import { TranscriptsPage } from "./pages/transcripts-page";
import { api } from "./lib/mock-api";

export default function App() {
  const [signedIn, setSignedIn] = useState(api.hasSession());

  return (
    <Routes>
      <Route path="/" element={signedIn ? <Navigate to="/dashboard" replace /> : <HomePage onSignedIn={() => setSignedIn(true)} />} />
      <Route element={<RequireAuth signedIn={signedIn} />}>
        <Route element={<AppShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="live-chats" element={<LiveChatsPage />} />
        <Route path="transcripts" element={<TranscriptsPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="customization" element={<CustomizationPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="analytics/knowledge-base" element={<KnowledgeBasePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={signedIn ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}

function RequireAuth({ signedIn }: { signedIn: boolean }) {
  return signedIn ? <Outlet /> : <Navigate to="/" replace />;
}
