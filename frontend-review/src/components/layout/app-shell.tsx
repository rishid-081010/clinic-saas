import {
  BarChart3,
  Bell,
  Bot,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Database,
  FileQuestion,
  Headphones,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
  Stethoscope,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { clinic } from "../../data/mock-data";
import { api } from "../../lib/mock-api";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { ChatbotWidget } from "../widget/chatbot-widget";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Doctors", to: "/doctors", icon: Stethoscope },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Live Chats", to: "/live-chats", icon: Headphones },
  { label: "Transcripts", to: "/transcripts", icon: MessageSquareText },
  { label: "Bookings", to: "/bookings", icon: CalendarCheck },
  { label: "FAQ Content", to: "/faq", icon: FileQuestion },
  { label: "Clinic Profile", to: "/customization", icon: Settings2 },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
];

export function AppShell() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeStaff, setActiveStaff] = useState(api.getActiveStaff());
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.getNotifications,
  });
  const { data: me } = useQuery({ queryKey: ["me", activeStaff.email], queryFn: api.getMe });
  const { data: members = [] } = useQuery({ queryKey: ["members", activeStaff.email], queryFn: api.getMembers });
  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "L2_ADMIN" | "L2_ASSISTANT" }) => api.updateMemberRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">EngageClinic AI</p>
            <p className="truncate text-xs text-muted-foreground">L2 tenant dashboard</p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/analytics/knowledge-base"
            className={({ isActive }) =>
              cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-accent text-accent-foreground",
              )
            }
          >
            <Database className="h-4 w-4" />
            Knowledge Base
          </NavLink>
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-7">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{clinic.name}</p>
            <p className="truncate text-xs text-muted-foreground">{clinic.location}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
            <Button
              variant="outline"
              size="icon"
              aria-label="Notifications"
              onClick={() => setNotificationsOpen((current) => !current)}
            >
              <Bell className="h-4 w-4" />
            </Button>
            {notificationsOpen && (
              <div className="absolute right-0 top-12 w-80 rounded-lg border bg-card p-3 shadow-xl">
                <p className="mb-2 text-sm font-semibold">Notifications</p>
                <div className="space-y-2">
                  {notifications.slice(0, 4).map((item: { id: string; title: string; type?: string }) => (
                    <div key={item.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.type ?? "Clinic update"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
            <div className="relative">
            <button
              className="flex h-10 items-center gap-2 rounded-md border bg-card px-2 text-left"
              onClick={() => setProfileOpen((current) => !current)}
              type="button"
            >
              <Avatar label={activeStaff.avatar} className="h-7 w-7 text-xs" />
              <span className="hidden text-sm font-medium sm:inline">{activeStaff.label}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 w-80 rounded-lg border bg-card p-3 shadow-xl">
                <p className="mb-2 text-sm font-semibold">Staff roles</p>
                <div className="space-y-2">
                  {members.map((member: any) => {
                    const role = staffDisplay(member);
                    const isCurrent = activeStaff.email === member.email;
                    const nextRole = member.role === "L2_ADMIN" ? "L2_ASSISTANT" : "L2_ADMIN";
                    return (
                    <div
                      key={member.email}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md border p-3 text-left",
                        isCurrent && "border-primary bg-primary/10",
                      )}
                    >
                      <Avatar label={role.avatar} className="h-8 w-8 text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{role.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{role.email}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{role.description}</span>
                      </span>
                      {me?.user?.role === "L2_ADMIN" && me.user.id !== member.id && (
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-background"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateRole.mutate({ id: member.id, role: nextRole });
                          }}
                        >
                          {member.role === "L2_ADMIN" ? "Make assistant" : "Make admin"}
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                  onClick={() => {
                    api.logout();
                    window.location.href = "/";
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-7">
          <Outlet />
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}

function staffDisplay(member: { name?: string; email: string; role: "L2_ADMIN" | "L2_ASSISTANT" }) {
  const label = member.role === "L2_ADMIN" ? "L2 Admin" : "L2 Assistant";
  const initials = (member.name || label)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    label,
    email: member.email,
    avatar: initials || (member.role === "L2_ADMIN" ? "LA" : "AS"),
    description:
      member.role === "L2_ADMIN"
        ? "Can manage clinic profile, FAQ, doctors, bookings, and transcripts."
        : "Can view transcripts and manage bookings, but cannot edit clinic content.",
  };
}
