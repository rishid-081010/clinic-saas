import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { MetricCard } from "../components/shared/metric-card";
import { StatusBadge } from "../components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { api } from "../lib/mock-api";

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const fallbackName = api.getActiveStaff().email.split("@")[0];
  const name = me?.user?.name || fallbackName;

  const today = new Date().toISOString().slice(0, 10);
  const todaysAppointments = (data?.bookings ?? []).filter((booking: any) => booking.preferredDate === today);
  const urgentItems = [
    ...(data?.transcripts ?? [])
      .filter((chat: any) => chat.status === "Escalated" || chat.status === "Unresolved")
      .map((chat: any) => ({ id: chat.id, title: chat.visitor, detail: chat.topic, status: chat.status })),
    ...(data?.bookings ?? [])
      .filter((booking: any) => booking.status === "Needs review")
      .map((booking: any) => ({ id: booking.id, title: booking.patient, detail: booking.symptom, status: booking.status })),
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">
          Hey <span className="text-primary">{name}</span>, welcome back
        </h1>
      </div>

      {!data && <p className="text-sm text-muted-foreground">Loading dashboard...</p>}

      {data && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Today's appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {todaysAppointments.length ? (
                  <div className="space-y-3">
                    {todaysAppointments.map((booking: any) => (
                      <div key={booking.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_90px_120px] md:items-center">
                        <p className="font-medium">{booking.patient}</p>
                        <p className="text-sm text-muted-foreground">{booking.suggestedDoctor}</p>
                        <p className="text-sm">{booking.preferredTime}</p>
                        <StatusBadge status={booking.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">No appointments booked for today.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Urgent attention</CardTitle>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </CardHeader>
              <CardContent>
                {urgentItems.length ? (
                  <div className="space-y-3">
                    {urgentItems.slice(0, 6).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">No urgent chats or booking issues right now.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
