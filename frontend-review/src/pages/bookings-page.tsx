import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { PageHeader } from "../components/shared/page-header";
import { StatusBadge } from "../components/shared/status-badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

export function BookingsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["bookings"], queryFn: api.getBookings });
  const createBooking = useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => {
      setMessage("Booking request created in the backend.");
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
  const deleteBooking = useMutation({
    mutationFn: api.deleteBooking,
    onSuccess: () => {
      setMessage("Booking deleted.");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createBooking.mutate({
      patientName: String(formData.get("patientName")),
      patientPhone: String(formData.get("patientPhone")),
      reason: String(formData.get("reason")),
      suggestedSpecialty: String(formData.get("suggestedSpecialty")),
      suggestedDoctor: String(formData.get("suggestedDoctor") || ""),
      preferredDate: String(formData.get("preferredDate")),
      preferredTime: String(formData.get("preferredTime")),
    });
  }

  return (
    <div>
      <PageHeader
        title="Appointment bookings"
        description="Track symptom intake, doctor suggestions, booking assistance, and confirmation status inside this organization."
        action={
          <Button onClick={() => setFormOpen((current) => !current)}>
            <CalendarPlus className="h-4 w-4" />
            Add booking
          </Button>
        }
      />
      {message && <p className="mb-4 rounded-md border bg-accent p-3 text-sm font-medium">{message}</p>}
      {formOpen && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Add booking request</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <Input name="patientName" placeholder="Patient name" required />
              <Input name="patientPhone" placeholder="Phone number" required />
              <Input name="reason" placeholder="Symptom / reason" required />
              <Input name="suggestedSpecialty" placeholder="Suggested specialty" required />
              <Input name="suggestedDoctor" placeholder="Suggested doctor" required />
              <Input name="preferredDate" type="date" required />
              <Input name="preferredTime" type="time" required />
              <Button className="md:col-span-2" disabled={createBooking.isPending}>
                {createBooking.isPending ? "Creating..." : "Create booking request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4">
        {data.map((booking) => (
          <Card key={booking.id}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-center">
              <div>
                <p className="text-sm text-muted-foreground">Patient</p>
                <p className="font-semibold">{booking.patient}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Symptom → doctor</p>
                <p className="font-medium">{booking.symptom} → {booking.suggestedDoctor}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Appointment</p>
                <p className="font-medium">{booking.appointment}</p>
              </div>
              <StatusBadge status={booking.status} />
              <Button
                variant="outline"
                size="icon"
                aria-label={`Delete booking ${booking.id}`}
                disabled={deleteBooking.isPending}
                onClick={() => deleteBooking.mutate(booking.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
