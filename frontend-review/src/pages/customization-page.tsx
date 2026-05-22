import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "../components/shared/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type DaySchedule = Record<string, { open: boolean; startTime: string; endTime: string }>;

export function CustomizationPage() {
  const { data: clinic } = useQuery({ queryKey: ["clinic-details"], queryFn: api.getClinicDetails });
  const { data: profileItems = [] } = useQuery({ queryKey: ["clinic-profile-items"], queryFn: api.getClinicProfileItems });
  const queryClient = useQueryClient();
  const updateClinic = useMutation({
    mutationFn: api.updateClinicDetails,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clinic-details"] }),
  });
  const createProfileItem = useMutation({
    mutationFn: api.createClinicProfileItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clinic-profile-items"] }),
  });
  const deleteProfileItem = useMutation({
    mutationFn: api.deleteClinicProfileItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clinic-profile-items"] }),
  });

  return (
    <div>
      <PageHeader
        title="Clinic Profile"
        description="Manage clinic details, day-wise opening hours, and AI-readable profile content."
      />

      <section className="space-y-6">
        <ClinicProfileForm clinic={clinic} saving={updateClinic.isPending} onSave={(input) => updateClinic.mutate(input)} />

        <Card>
          <CardHeader>
            <CardTitle>Additional clinic content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-3 md:grid-cols-[280px_1fr_auto]"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                createProfileItem.mutate({
                  title: String(formData.get("title")),
                  content: String(formData.get("content")),
                }, {
                  onSuccess: () => form.reset(),
                });
              }}
            >
              <Input name="title" placeholder="Header" required />
              <Input name="content" placeholder="Content" required />
              <Button disabled={createProfileItem.isPending}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            <div className="grid gap-3 md:grid-cols-2">
              {profileItems.map((item: any) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-4">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.content}</p>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => deleteProfileItem.mutate(item.id)} aria-label="Delete profile item">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ClinicProfileForm({
  clinic,
  saving,
  onSave,
}: {
  clinic: any;
  saving: boolean;
  onSave: (input: Record<string, string>) => void;
}) {
  const initialSchedule = useMemo(() => parseSchedule(clinic?.openingHours, clinic?.openingDays), [clinic]);
  const [schedule, setSchedule] = useState<DaySchedule>(initialSchedule);

  useEffect(() => {
    setSchedule(initialSchedule);
  }, [initialSchedule]);

  function toggleDay(day: string) {
    setSchedule((current) => ({
      ...current,
      [day]: { ...current[day], open: !current[day].open },
    }));
  }

  function updateTime(day: string, key: "startTime" | "endTime", value: string) {
    setSchedule((current) => ({
      ...current,
      [day]: { ...current[day], [key]: value, open: true },
    }));
  }

  function handleClinicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const openRows = dayOptions
      .filter((day) => schedule[day].open)
      .map((day) => ({ day, startTime: schedule[day].startTime, endTime: schedule[day].endTime }));

    onSave({
      name: String(formData.get("name")),
      phone: String(formData.get("phone")),
      email: String(formData.get("email")),
      address: String(formData.get("address")),
      openingDays: openRows.map((row) => row.day).join(", "),
      openingHours: JSON.stringify(openRows),
      insuranceInfo: String(formData.get("insuranceInfo")),
      consultationFeeInfo: String(formData.get("consultationFeeInfo")),
      emergencyNotice: String(formData.get("emergencyNotice")),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Core clinic details</CardTitle>
      </CardHeader>
      <CardContent>
        <form key={clinic?.id ?? "clinic"} className="space-y-5" onSubmit={handleClinicSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Clinic name</span>
              <Input name="name" defaultValue={clinic?.name ?? ""} required />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Public phone</span>
              <Input name="phone" defaultValue={clinic?.phone ?? ""} required />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Booking handoff email</span>
              <Input name="email" defaultValue={clinic?.email ?? ""} required />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Address</span>
              <Input name="address" defaultValue={clinic?.address ?? ""} required />
            </label>
          </div>

          <div className="rounded-md border p-4">
            <p className="mb-3 text-sm font-semibold">Opening schedule</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dayOptions.map((day) => (
                <div key={day} className="rounded-md border p-3">
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={schedule[day].open ? "mb-3 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" : "mb-3 rounded-md border px-3 py-2 text-sm"}
                  >
                    {day}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" value={schedule[day].startTime} onChange={(event) => updateTime(day, "startTime", event.target.value)} disabled={!schedule[day].open} />
                    <Input type="time" value={schedule[day].endTime} onChange={(event) => updateTime(day, "endTime", event.target.value)} disabled={!schedule[day].open} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Insurance details</span>
              <textarea name="insuranceInfo" defaultValue={clinic?.insuranceInfo ?? ""} className="min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Consultation fee details</span>
              <textarea name="consultationFeeInfo" defaultValue={clinic?.consultationFeeInfo ?? ""} className="min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Emergency notice</span>
              <textarea name="emergencyNotice" defaultValue={clinic?.emergencyNotice ?? ""} className="min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
          </div>

          <Button disabled={saving}>
            <Save className="h-4 w-4" />
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function parseSchedule(openingHours?: string, openingDays?: string): DaySchedule {
  const fallback = Object.fromEntries(dayOptions.map((day) => [day, { open: false, startTime: "09:00", endTime: "17:00" }])) as DaySchedule;
  try {
    const rows = JSON.parse(openingHours || "[]") as Array<{ day: string; startTime: string; endTime: string }>;
    for (const row of rows) {
      if (fallback[row.day]) {
        fallback[row.day] = { open: true, startTime: row.startTime || "09:00", endTime: row.endTime || "17:00" };
      }
    }
    return fallback;
  } catch {
    for (const day of dayOptions) {
      fallback[day].open = openingDays?.toLowerCase().includes(day.toLowerCase()) ?? false;
    }
    return fallback;
  }
}
