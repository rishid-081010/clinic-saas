import {
  Activity,
  Bell,
  BookOpenText,
  CalendarCheck2,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileQuestion,
  Filter,
  Hospital,
  Inbox,
  LayoutDashboard,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Ticket,
  UserRoundCog,
  Users,
} from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";

type Section =
  | "overview"
  | "chats"
  | "bookings"
  | "analytics"
  | "content"
  | "requests"
  | "settings"
  | "users";

type Role = "admin" | "readonly";

type StatusTone = "good" | "warning" | "danger" | "neutral" | "info";

type Chat = {
  id: string;
  patient: string;
  question: string;
  intent: string;
  outcome: string;
  status: "Resolved" | "Unresolved" | "Booking started";
  timestamp: string;
  transcript: string[];
};

type Booking = {
  id: string;
  patient: string;
  symptom: string;
  specialty: string;
  doctor: string;
  slot: string;
  status: "Pending review" | "Confirmed" | "Needs follow-up" | "Cancelled";
  source: string;
};

type TicketItem = {
  id: string;
  title: string;
  module: string;
  status: "Open" | "In review" | "Approved";
  requestedBy: string;
};

const clinic = {
  name: "Aster Grove Clinic",
  location: "Indiranagar, Bengaluru",
  contact: "+91 80 4567 2400",
  website: "astergrove.example",
  modules: ["FAQ Assistant", "Booking Assistant"],
};

const navItems: Array<{ id: Section; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { id: "chats", label: "Chats", icon: <MessageCircle size={18} /> },
  { id: "bookings", label: "Bookings", icon: <CalendarCheck2 size={18} /> },
  { id: "analytics", label: "Analytics", icon: <Activity size={18} /> },
  { id: "content", label: "Content", icon: <BookOpenText size={18} /> },
  { id: "requests", label: "Requests", icon: <Ticket size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
  { id: "users", label: "Users", icon: <Users size={18} /> },
];

const initialChats: Chat[] = [
  {
    id: "CH-2048",
    patient: "Meera K.",
    question: "Do you accept Star Health for dermatology visits?",
    intent: "Insurance",
    outcome: "FAQ resolved",
    status: "Resolved",
    timestamp: "Today, 10:42",
    transcript: [
      "Patient asked about Star Health coverage.",
      "Assistant confirmed accepted plans and shared billing desk number.",
      "Patient selected Contact clinic.",
    ],
  },
  {
    id: "CH-2047",
    patient: "Arjun P.",
    question: "I have chest tightness and dizziness. Should I book?",
    intent: "Symptom",
    outcome: "Safety notice shown",
    status: "Unresolved",
    timestamp: "Today, 10:18",
    transcript: [
      "Patient described chest tightness and dizziness.",
      "Assistant displayed emergency safety notice.",
      "Marked unresolved for staff review.",
    ],
  },
  {
    id: "CH-2046",
    patient: "Nisha S.",
    question: "Need a pediatrician this evening",
    intent: "Booking",
    outcome: "Booking flow opened",
    status: "Booking started",
    timestamp: "Today, 09:56",
    transcript: [
      "Patient requested pediatrician availability.",
      "Assistant suggested Pediatrics and collected preferred slot.",
      "Booking request B-1189 created.",
    ],
  },
  {
    id: "CH-2045",
    patient: "Rahul B.",
    question: "What preparation is needed before a thyroid test?",
    intent: "Procedure prep",
    outcome: "FAQ resolved",
    status: "Resolved",
    timestamp: "Yesterday, 18:30",
    transcript: [
      "Patient asked for thyroid test prep.",
      "Assistant answered from approved lab FAQ.",
      "Patient viewed timing details.",
    ],
  },
];

const initialBookings: Booking[] = [
  {
    id: "B-1191",
    patient: "Nisha S.",
    symptom: "Child fever",
    specialty: "Pediatrics",
    doctor: "Dr. Kavya Rao",
    slot: "Today, 17:30",
    status: "Pending review",
    source: "Chatbot",
  },
  {
    id: "B-1190",
    patient: "Vikram L.",
    symptom: "Knee pain after running",
    specialty: "Orthopedics",
    doctor: "Dr. Aman Verma",
    slot: "Tomorrow, 11:00",
    status: "Confirmed",
    source: "Booking page",
  },
  {
    id: "B-1189",
    patient: "Farah M.",
    symptom: "Recurring acne",
    specialty: "Dermatology",
    doctor: "Dr. Ira Menon",
    slot: "Tomorrow, 15:00",
    status: "Needs follow-up",
    source: "Chatbot",
  },
  {
    id: "B-1188",
    patient: "Dev N.",
    symptom: "Annual health check",
    specialty: "General Medicine",
    doctor: "Dr. Rohan Shah",
    slot: "Fri, 09:30",
    status: "Confirmed",
    source: "Booking page",
  },
];

const faqItems = [
  {
    question: "Which insurance plans are accepted?",
    answer:
      "Cashless support is available for Star Health, HDFC Ergo, ICICI Lombard, and Care Health for eligible outpatient services.",
    updated: "Updated 2 days ago",
  },
  {
    question: "What are the clinic timings?",
    answer:
      "The clinic is open Monday to Saturday from 08:00 to 20:00, with lab sample collection from 07:30 to 12:00.",
    updated: "Updated yesterday",
  },
  {
    question: "Do patients need to fast before thyroid testing?",
    answer:
      "Fasting is not required for routine thyroid profile tests unless paired with other fasting blood tests.",
    updated: "Updated 5 days ago",
  },
];

const doctors = [
  { name: "Dr. Kavya Rao", specialty: "Pediatrics", availability: "Mon-Sat evenings" },
  { name: "Dr. Aman Verma", specialty: "Orthopedics", availability: "Tue, Thu, Sat" },
  { name: "Dr. Ira Menon", specialty: "Dermatology", availability: "Mon-Fri afternoons" },
  { name: "Dr. Rohan Shah", specialty: "General Medicine", availability: "Daily mornings" },
];

const users = [
  { name: "Ananya Iyer", role: "L2 Admin", access: "Full clinic operations", status: "Active" },
  { name: "Sahil Mehta", role: "Operations exec", access: "Bookings and chats", status: "Active" },
  { name: "Priya Nair", role: "Read-only staff", access: "View analytics and records", status: "Invited" },
];

const topQuestions: Array<[string, number]> = [
  ["Insurance coverage", 36],
  ["Consultation fees", 28],
  ["Clinic timing", 22],
  ["Test preparation", 14],
];

const topSymptoms: Array<[string, number]> = [
  ["Fever", 31],
  ["Skin concern", 23],
  ["Joint pain", 17],
  ["Annual checkup", 12],
];

const funnel = [
  { label: "Widget impressions", value: 2483, percent: 100 },
  { label: "Chat starts", value: 612, percent: 25 },
  { label: "Booking starts", value: 188, percent: 31 },
  { label: "Booking completed", value: 79, percent: 42 },
];

function App() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [role, setRole] = useState<Role>("admin");
  const [chatStatus, setChatStatus] = useState("All");
  const [bookingStatus, setBookingStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState(initialChats[0]);
  const [bookings, setBookings] = useState(initialBookings);
  const [tickets, setTickets] = useState<TicketItem[]>([
    {
      id: "CR-43",
      title: "Add WhatsApp confirmation template",
      module: "Booking Assistant",
      status: "In review",
      requestedBy: "Ananya Iyer",
    },
    {
      id: "CR-41",
      title: "Show parking directions in widget",
      module: "FAQ Assistant",
      status: "Approved",
      requestedBy: "Sahil Mehta",
    },
  ]);
  const [ticketTitle, setTicketTitle] = useState("");

  const isReadOnly = role === "readonly";
  const pageTitle = navItems.find((item) => item.id === activeSection)?.label ?? "Overview";

  const filteredChats = useMemo(() => {
    return initialChats.filter((chat) => {
      const matchesStatus = chatStatus === "All" || chat.status === chatStatus;
      const haystack = `${chat.patient} ${chat.question} ${chat.intent}`.toLowerCase();
      return matchesStatus && haystack.includes(search.toLowerCase());
    });
  }, [chatStatus, search]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesStatus = bookingStatus === "All" || booking.status === bookingStatus;
      const haystack = `${booking.patient} ${booking.symptom} ${booking.specialty} ${booking.doctor}`.toLowerCase();
      return matchesStatus && haystack.includes(search.toLowerCase());
    });
  }, [bookingStatus, bookings, search]);

  function handleBookingStatus(id: string, status: Booking["status"]) {
    if (isReadOnly) return;
    setBookings((current) => current.map((booking) => (booking.id === id ? { ...booking, status } : booking)));
  }

  function handleTicketSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReadOnly || !ticketTitle.trim()) return;

    const nextTicket: TicketItem = {
      id: `CR-${44 + tickets.length}`,
      title: ticketTitle.trim(),
      module: "Clinic configuration",
      status: "Open",
      requestedBy: "Ananya Iyer",
    };

    setTickets((current) => [nextTicket, ...current]);
    setTicketTitle("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="L2 navigation">
        <div className="brand">
          <div className="brand-mark">
            <Hospital size={24} />
          </div>
          <div>
            <strong>{clinic.name}</strong>
            <span>L2 workspace</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              className={item.id === activeSection ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setSearch("");
              }}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="module-pill">
            <Sparkles size={16} />
            <span>2 modules active</span>
          </div>
          <p>{clinic.location}</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Assigned organization</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            <div className="role-switch" aria-label="Role preview">
              <button className={role === "admin" ? "selected" : ""} onClick={() => setRole("admin")} type="button">
                <UserRoundCog size={16} />
                <span>Admin</span>
              </button>
              <button
                className={role === "readonly" ? "selected" : ""}
                onClick={() => setRole("readonly")}
                type="button"
              >
                <Lock size={16} />
                <span>Read-only</span>
              </button>
            </div>
            <button className="icon-button" aria-label="Notifications" type="button">
              <Bell size={18} />
              <span className="dot" />
            </button>
          </div>
        </header>

        {isReadOnly && (
          <div className="notice" role="status">
            <Lock size={16} />
            <span>Read-only staff can view clinic records and analytics, but changes are locked.</span>
          </div>
        )}

        {activeSection === "overview" && (
          <Overview
            onNavigate={setActiveSection}
            pendingBookings={bookings.filter((booking) => booking.status === "Pending review").length}
            unresolvedChats={initialChats.filter((chat) => chat.status === "Unresolved").length}
          />
        )}

        {activeSection === "chats" && (
          <Chats
            chatStatus={chatStatus}
            filteredChats={filteredChats}
            search={search}
            selectedChat={selectedChat}
            setChatStatus={setChatStatus}
            setSearch={setSearch}
            setSelectedChat={setSelectedChat}
          />
        )}

        {activeSection === "bookings" && (
          <Bookings
            bookingStatus={bookingStatus}
            filteredBookings={filteredBookings}
            isReadOnly={isReadOnly}
            onStatusChange={handleBookingStatus}
            search={search}
            setBookingStatus={setBookingStatus}
            setSearch={setSearch}
          />
        )}

        {activeSection === "analytics" && <Analytics />}

        {activeSection === "content" && <Content isReadOnly={isReadOnly} />}

        {activeSection === "requests" && (
          <Requests
            isReadOnly={isReadOnly}
            onSubmit={handleTicketSubmit}
            setTicketTitle={setTicketTitle}
            ticketTitle={ticketTitle}
            tickets={tickets}
          />
        )}

        {activeSection === "settings" && <SettingsPanel isReadOnly={isReadOnly} />}

        {activeSection === "users" && <UsersPanel isReadOnly={isReadOnly} />}
      </main>
    </div>
  );
}

function Overview({
  onNavigate,
  pendingBookings,
  unresolvedChats,
}: {
  onNavigate: (section: Section) => void;
  pendingBookings: number;
  unresolvedChats: number;
}) {
  return (
    <section className="page-grid">
      <div className="kpi-grid">
        <MetricCard icon={<Inbox size={20} />} label="Chat starts" value="612" trend="+18% this month" />
        <MetricCard icon={<ShieldCheck size={20} />} label="FAQ resolution" value="78%" trend="+6% this month" />
        <MetricCard icon={<CalendarCheck2 size={20} />} label="Booking completion" value="42%" trend="+9% this month" />
        <MetricCard icon={<Clock3 size={20} />} label="Avg response" value="1.4s" trend="P95 under 2.1s" />
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Queues</p>
              <h2>Staff attention</h2>
            </div>
            <CircleAlert size={20} />
          </div>
          <div className="queue-list">
            <QueueRow
              action="Open chats"
              count={unresolvedChats}
              label="Unresolved conversations"
              onClick={() => onNavigate("chats")}
              tone="danger"
            />
            <QueueRow
              action="Review bookings"
              count={pendingBookings}
              label="Booking requests pending"
              onClick={() => onNavigate("bookings")}
              tone="warning"
            />
            <QueueRow
              action="View requests"
              count={1}
              label="Customization requests in review"
              onClick={() => onNavigate("requests")}
              tone="info"
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Modules</p>
              <h2>Clinic activation</h2>
            </div>
            <Check size={20} />
          </div>
          <div className="module-list">
            {clinic.modules.map((module) => (
              <div className="module-row" key={module}>
                <div>
                  <strong>{module}</strong>
                  <span>Active for {clinic.website}</span>
                </div>
                <StatusBadge status="Enabled" tone="good" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Conversion funnel</h2>
          </div>
          <Activity size={20} />
        </div>
        <FunnelChart />
      </section>
    </section>
  );
}

function Chats({
  chatStatus,
  filteredChats,
  search,
  selectedChat,
  setChatStatus,
  setSearch,
  setSelectedChat,
}: {
  chatStatus: string;
  filteredChats: Chat[];
  search: string;
  selectedChat: Chat;
  setChatStatus: (status: string) => void;
  setSearch: (value: string) => void;
  setSelectedChat: (chat: Chat) => void;
}) {
  return (
    <section className="split-page">
      <div className="panel">
        <Toolbar
          filterValue={chatStatus}
          filters={["All", "Resolved", "Unresolved", "Booking started"]}
          search={search}
          setFilter={setChatStatus}
          setSearch={setSearch}
        />

        <div className="record-list">
          {filteredChats.map((chat) => (
            <button
              className={selectedChat.id === chat.id ? "record-row selected" : "record-row"}
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              type="button"
            >
              <div className="record-main">
                <strong>{chat.patient}</strong>
                <span>{chat.question}</span>
              </div>
              <div className="record-meta">
                <StatusBadge status={chat.status} tone={chatTone(chat.status)} />
                <small>{chat.timestamp}</small>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="panel detail-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{selectedChat.id}</p>
            <h2>{selectedChat.patient}</h2>
          </div>
          <StatusBadge status={selectedChat.status} tone={chatTone(selectedChat.status)} />
        </div>

        <dl className="detail-list">
          <div>
            <dt>Intent</dt>
            <dd>{selectedChat.intent}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{selectedChat.outcome}</dd>
          </div>
        </dl>

        <div className="timeline">
          {selectedChat.transcript.map((line) => (
            <div className="timeline-item" key={line}>
              <span />
              <p>{line}</p>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function Bookings({
  bookingStatus,
  filteredBookings,
  isReadOnly,
  onStatusChange,
  search,
  setBookingStatus,
  setSearch,
}: {
  bookingStatus: string;
  filteredBookings: Booking[];
  isReadOnly: boolean;
  onStatusChange: (id: string, status: Booking["status"]) => void;
  search: string;
  setBookingStatus: (status: string) => void;
  setSearch: (value: string) => void;
}) {
  return (
    <section className="panel">
      <Toolbar
        filterValue={bookingStatus}
        filters={["All", "Pending review", "Confirmed", "Needs follow-up", "Cancelled"]}
        search={search}
        setFilter={setBookingStatus}
        setSearch={setSearch}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Symptom</th>
              <th>Recommendation</th>
              <th>Preferred slot</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <strong>{booking.patient}</strong>
                  <span>{booking.id} via {booking.source}</span>
                </td>
                <td>{booking.symptom}</td>
                <td>
                  <strong>{booking.specialty}</strong>
                  <span>{booking.doctor}</span>
                </td>
                <td>{booking.slot}</td>
                <td>
                  <StatusBadge status={booking.status} tone={bookingTone(booking.status)} />
                </td>
                <td>
                  <div className="button-row compact">
                    <button
                      className="icon-text-button"
                      disabled={isReadOnly}
                      onClick={() => onStatusChange(booking.id, "Confirmed")}
                      type="button"
                    >
                      <Check size={16} />
                      <span>Confirm</span>
                    </button>
                    <button
                      className="icon-button small"
                      disabled={isReadOnly}
                      onClick={() => onStatusChange(booking.id, "Needs follow-up")}
                      type="button"
                      aria-label="Mark for follow-up"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Analytics() {
  return (
    <section className="page-grid">
      <div className="kpi-grid">
        <MetricCard icon={<MessageCircle size={20} />} label="Widget impressions" value="2,483" trend="+14% vs last week" />
        <MetricCard icon={<ClipboardList size={20} />} label="Booking starts" value="188" trend="31% of chat starts" />
        <MetricCard icon={<CircleAlert size={20} />} label="Unresolved queries" value="18" trend="-5 since Monday" />
        <MetricCard icon={<Stethoscope size={20} />} label="Top specialty" value="Pediatrics" trend="31 requests" />
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Flow</p>
              <h2>Booking path</h2>
            </div>
            <Activity size={20} />
          </div>
          <FunnelChart />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Questions</p>
              <h2>Top FAQ intents</h2>
            </div>
            <FileQuestion size={20} />
          </div>
          <BarList items={topQuestions} />
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Demand</p>
            <h2>Top symptoms requested</h2>
          </div>
          <Stethoscope size={20} />
        </div>
        <BarList items={topSymptoms} />
      </section>
    </section>
  );
}

function Content({ isReadOnly }: { isReadOnly: boolean }) {
  return (
    <section className="page-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Approved knowledge</p>
            <h2>FAQ content</h2>
          </div>
          <button className="icon-text-button" disabled={isReadOnly} type="button">
            <Plus size={16} />
            <span>Add FAQ</span>
          </button>
        </div>
        <div className="faq-grid">
          {faqItems.map((item) => (
            <article className="faq-card" key={item.question}>
              <div>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </div>
              <span>{item.updated}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Booking rules</p>
            <h2>Doctor mapping</h2>
          </div>
          <button className="icon-text-button" disabled={isReadOnly} type="button">
            <Plus size={16} />
            <span>Add doctor</span>
          </button>
        </div>
        <div className="doctor-grid">
          {doctors.map((doctor) => (
            <article className="doctor-card" key={doctor.name}>
              <div className="avatar">{doctor.name.split(" ").at(-1)?.slice(0, 1)}</div>
              <div>
                <strong>{doctor.name}</strong>
                <span>{doctor.specialty}</span>
              </div>
              <small>{doctor.availability}</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function Requests({
  isReadOnly,
  onSubmit,
  setTicketTitle,
  ticketTitle,
  tickets,
}: {
  isReadOnly: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setTicketTitle: (value: string) => void;
  ticketTitle: string;
  tickets: TicketItem[];
}) {
  return (
    <section className="two-column align-start">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2>Customization requests</h2>
          </div>
          <Ticket size={20} />
        </div>
        <div className="request-list">
          {tickets.map((ticket) => (
            <article className="request-card" key={ticket.id}>
              <div>
                <strong>{ticket.title}</strong>
                <span>{ticket.id} · {ticket.module}</span>
              </div>
              <StatusBadge status={ticket.status} tone={ticketTone(ticket.status)} />
            </article>
          ))}
        </div>
      </section>

      <form className="panel request-form" onSubmit={onSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">New request</p>
            <h2>Raise ticket</h2>
          </div>
          {isReadOnly ? <Lock size={20} /> : <Plus size={20} />}
        </div>
        <label>
          Request title
          <input
            disabled={isReadOnly}
            onChange={(event) => setTicketTitle(event.target.value)}
            placeholder="Example: Add Hindi FAQ set"
            value={ticketTitle}
          />
        </label>
        <label>
          Module
          <select disabled={isReadOnly} defaultValue="FAQ Assistant">
            <option>FAQ Assistant</option>
            <option>Booking Assistant</option>
            <option>Clinic configuration</option>
          </select>
        </label>
        <button className="primary-button" disabled={isReadOnly || !ticketTitle.trim()} type="submit">
          <Ticket size={16} />
          <span>Submit request</span>
        </button>
      </form>
    </section>
  );
}

function SettingsPanel({ isReadOnly }: { isReadOnly: boolean }) {
  return (
    <section className="page-grid">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Clinic details</p>
            <h2>Organization settings</h2>
          </div>
          <Settings size={20} />
        </div>
        <div className="settings-grid">
          <label>
            Clinic name
            <input disabled={isReadOnly} defaultValue={clinic.name} />
          </label>
          <label>
            Website
            <input disabled={isReadOnly} defaultValue={clinic.website} />
          </label>
          <label>
            Contact number
            <input disabled={isReadOnly} defaultValue={clinic.contact} />
          </label>
          <label>
            Location
            <input disabled={isReadOnly} defaultValue={clinic.location} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Staff events</p>
            <h2>Notifications</h2>
          </div>
          <Bell size={20} />
        </div>
        <div className="toggle-list">
          {["New lead", "Booking confirmation", "Unresolved chat", "Customization status"].map((item) => (
            <label className="toggle-row" key={item}>
              <span>{item}</span>
              <input disabled={isReadOnly} type="checkbox" defaultChecked />
            </label>
          ))}
        </div>
      </section>
    </section>
  );
}

function UsersPanel({ isReadOnly }: { isReadOnly: boolean }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Clinic team</p>
          <h2>Users and roles</h2>
        </div>
        <button className="icon-text-button" disabled={isReadOnly} type="button">
          <Plus size={16} />
          <span>Invite user</span>
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Access</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.name}>
                <td>
                  <strong>{user.name}</strong>
                  <span>{clinic.name}</span>
                </td>
                <td>{user.role}</td>
                <td>{user.access}</td>
                <td>
                  <StatusBadge status={user.status} tone={user.status === "Active" ? "good" : "info"} />
                </td>
                <td>
                  <button className="icon-button small" disabled={isReadOnly} type="button" aria-label={`Edit ${user.name}`}>
                    <UserRoundCog size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Toolbar({
  filterValue,
  filters,
  search,
  setFilter,
  setSearch,
}: {
  filterValue: string;
  filters: string[];
  search: string;
  setFilter: (value: string) => void;
  setSearch: (value: string) => void;
}) {
  return (
    <div className="toolbar">
      <label className="search-field">
        <Search size={16} />
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Search records" value={search} />
      </label>
      <label className="filter-field">
        <Filter size={16} />
        <select onChange={(event) => setFilter(event.target.value)} value={filterValue}>
          {filters.map((filter) => (
            <option key={filter}>{filter}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>
    </div>
  );
}

function MetricCard({ icon, label, trend, value }: { icon: ReactNode; label: string; trend: string; value: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{trend}</small>
    </article>
  );
}

function QueueRow({
  action,
  count,
  label,
  onClick,
  tone,
}: {
  action: string;
  count: number;
  label: string;
  onClick: () => void;
  tone: StatusTone;
}) {
  return (
    <div className="queue-row">
      <div className={`queue-count ${tone}`}>{count}</div>
      <div>
        <strong>{label}</strong>
        <button className="text-button" onClick={onClick} type="button">
          {action}
        </button>
      </div>
    </div>
  );
}

function FunnelChart() {
  return (
    <div className="funnel">
      {funnel.map((item) => (
        <div className="funnel-row" key={item.label}>
          <div className="funnel-label">
            <strong>{item.label}</strong>
            <span>{item.value.toLocaleString()}</span>
          </div>
          <div className="funnel-track">
            <div style={{ width: `${item.percent}%` }} />
          </div>
          <small>{item.percent}%</small>
        </div>
      ))}
    </div>
  );
}

function BarList({ items }: { items: Array<[string, number]> }) {
  const max = Math.max(...items.map(([, value]) => value));
  return (
    <div className="bar-list">
      {items.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <div>
            <strong>{label}</strong>
            <span>{value}</span>
          </div>
          <div className="bar-track">
            <div style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, tone }: { status: string; tone: StatusTone }) {
  return <span className={`status ${tone}`}>{status}</span>;
}

function chatTone(status: Chat["status"]): StatusTone {
  if (status === "Resolved") return "good";
  if (status === "Unresolved") return "danger";
  return "info";
}

function bookingTone(status: Booking["status"]): StatusTone {
  if (status === "Confirmed") return "good";
  if (status === "Pending review") return "warning";
  if (status === "Needs follow-up") return "danger";
  return "neutral";
}

function ticketTone(status: TicketItem["status"]): StatusTone {
  if (status === "Approved") return "good";
  if (status === "In review") return "info";
  return "warning";
}

export default App;
