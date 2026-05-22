import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/shared/page-header";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/mock-api";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarPage() {
  const { data: doctors = [] } = useQuery({ queryKey: ["doctors"], queryFn: api.getDoctors });
  const { data: bookings = [] } = useQuery({ queryKey: ["calendar-bookings"], queryFn: api.getCalendarBookings });
  const [doctorId, setDoctorId] = useState("");
  const activeDoctor = doctors.find((doctor: any) => doctor.id === doctorId) ?? doctors[0];
  const weekDays = useMemo(() => currentWeekDays(), []);
  const slots = useMemo(() => buildSlots(activeDoctor), [activeDoctor]);
  const visibleBookings = bookings.filter((booking: any) =>
    activeDoctor &&
    booking.suggestedDoctor === activeDoctor.name &&
    weekDays.some((day) => day.date === booking.preferredDate),
  );

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="View doctor-wise appointment slots and confirmed bookings."
      />

      <Card>
        <CardContent className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <p className="font-semibold">{activeDoctor?.name ?? "No doctor selected"}</p>
            </div>
            <select
              className="h-10 min-w-64 rounded-md border bg-card px-3 text-sm"
              value={activeDoctor?.id ?? ""}
              onChange={(event) => setDoctorId(event.target.value)}
            >
              {doctors.map((doctor: any) => (
                <option key={doctor.id} value={doctor.id}>{doctor.name} - {doctor.specialty}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px] rounded-md border">
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b bg-muted/60">
                <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
                {weekDays.map((day) => (
                  <div key={day.date} className="border-l p-3">
                    <p className="text-sm font-semibold">{day.label}</p>
                    <p className="text-xs text-muted-foreground">{day.date}</p>
                  </div>
                ))}
              </div>
              {slots.map((slot) => (
                <div key={slot} className="grid min-h-20 grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0">
                  <div className="p-3 text-xs text-muted-foreground">{slot}</div>
                  {weekDays.map((day) => {
                    const booking = visibleBookings.find((item: any) => item.preferredDate === day.date && item.preferredTime === slot);
                    return (
                      <div key={`${day.date}-${slot}`} className="border-l p-2">
                        {booking && (
                          <div className="rounded-md bg-primary/10 p-2 text-xs text-primary">
                            <p className="font-semibold">{booking.patientName}</p>
                            <p className="mt-1 text-primary/80">{booking.reason}</p>
                            <p className="mt-1 uppercase">{booking.status}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function currentWeekDays() {
  const today = new Date();
  const monday = new Date(today);
  const delta = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - delta);
  return dayLabels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, date: formatDate(date) };
  });
}

function buildSlots(doctor: any) {
  const schedule = doctor?.schedule?.length ? doctor.schedule : [{ startTime: "09:00", endTime: "17:00" }];
  const start = Math.min(...schedule.map((slot: any) => minutes(slot.startTime)).filter(Number.isFinite));
  const end = Math.max(...schedule.map((slot: any) => minutes(slot.endTime)).filter(Number.isFinite));
  const rows = [];
  for (let minute = start; minute + 30 <= end; minute += 30) rows.push(timeFromMinutes(minute));
  return rows.length ? rows : ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"];
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
