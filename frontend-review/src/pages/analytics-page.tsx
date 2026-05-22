import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { api } from "../lib/mock-api";

export function AnalyticsPage() {
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: api.getAnalytics });

  if (!data) return null;

  const totalVisitors = data.conversionTrend.reduce((sum, day) => sum + day.visitors, 0);
  const totalChats = data.conversionTrend.reduce((sum, day) => sum + day.chats, 0);
  const totalBookings = data.conversionTrend.reduce((sum, day) => sum + day.bookings, 0);

  return (
    <div>
      <PageHeader
        title="Organization analytics"
        description="Measure the clinic's website-to-booking conversion, chatbot resolution, and booking assistance outcomes."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Visitors to chat</p>
            <p className="mt-3 text-3xl font-semibold">{Math.round((totalChats / totalVisitors) * 100)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Chats to booking</p>
            <p className="mt-3 text-3xl font-semibold">{Math.round((totalBookings / totalChats) * 100)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Escalation rate</p>
            <p className="mt-3 text-3xl font-semibold">11%</p>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Weekly conversion trend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {data.conversionTrend.map((day) => (
            <div key={day.label} className="grid gap-2 md:grid-cols-[56px_1fr_90px] md:items-center">
              <span className="text-sm font-medium">{day.label}</span>
              <div className="space-y-2">
                <Progress value={(day.chats / day.visitors) * 100} />
                <Progress value={(day.bookings / day.visitors) * 100} className="[&>div]:bg-emerald-500" />
              </div>
              <span className="text-sm text-muted-foreground">{day.visitors} visits</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
