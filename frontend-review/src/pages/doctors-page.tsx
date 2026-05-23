import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../components/shared/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduleRow = { day: string; startTime: string; endTime: string };

export function DoctorsPage() {
  const { data = [] } = useQuery({ queryKey: ["doctors"], queryFn: api.getDoctors });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const [editingDoctor, setEditingDoctor] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [expandedDoctors, setExpandedDoctors] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const canManageDoctors = me?.user?.role === "L2_ADMIN";
  const createDoctor = useMutation({
    mutationFn: api.createDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doctors"] }),
  });
  const updateDoctor = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DoctorInput }) => api.updateDoctor(id, input),
    onSuccess: () => {
      setEditingDoctor(null);
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
  });
  const deleteDoctor = useMutation({
    mutationFn: api.deleteDoctor,
    onSuccess: () => {
      setDeleteError("");
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: () => setDeleteError("Only L2 Admins can delete doctors."),
  });

  return (
    <div>
      <PageHeader
        title="Doctors"
        description="Add and manage doctors, qualifications, specialties, and day-wise consultation timings."
      />

      <section className="grid gap-6 xl:grid-cols-[460px_1fr]">
        <DoctorForm
          key={editingDoctor?.id ?? "new"}
          doctor={editingDoctor}
          saving={createDoctor.isPending || updateDoctor.isPending}
          onCancel={editingDoctor ? () => setEditingDoctor(null) : undefined}
          onSubmit={(input) => {
            if (editingDoctor) {
              updateDoctor.mutate({ id: editingDoctor.id, input });
            } else {
              createDoctor.mutate(input);
            }
          }}
        />

        <div className="columns-1 gap-4 md:columns-2">
          {deleteError && <p className="mb-4 break-inside-avoid rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{deleteError}</p>}
          {data.map((doctor: any) => (
            <Card key={doctor.id} className="mb-4 break-inside-avoid">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{doctor.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Qualification:</span>{" "}
                      {doctor.qualification || "Not added"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setExpandedDoctors((current) => current.includes(doctor.id) ? current.filter((id) => id !== doctor.id) : [...current, doctor.id])}
                      aria-label="Toggle doctor details"
                    >
                      <ChevronDown className={expandedDoctors.includes(doctor.id) ? "h-4 w-4 rotate-180 transition-transform" : "h-4 w-4 transition-transform"} />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => setEditingDoctor(doctor)} aria-label="Edit doctor">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={!canManageDoctors || deleteDoctor.isPending}
                      onClick={() => {
                        if (!canManageDoctors) {
                          setDeleteError("Only L2 Admins can delete doctors.");
                          return;
                        }
                        deleteDoctor.mutate(doctor.id);
                      }}
                      aria-label="Delete doctor"
                      title={canManageDoctors ? "Delete doctor" : "Only L2 Admins can delete doctors"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {expandedDoctors.includes(doctor.id) && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground">Specialty:</span> {doctor.specialty}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {(doctor.schedule?.length ? doctor.schedule : doctor.availableDays?.map((day: string) => ({ day, startTime: doctor.startTime, endTime: doctor.endTime }))).map((slot: ScheduleRow) => (
                        <p key={slot.day}>{slot.day}: {slot.startTime} - {slot.endTime}</p>
                      ))}
                    </div>
                    <p className="mt-3 text-xs uppercase text-muted-foreground">{doctor.consultationType?.replace("_", " ")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

type DoctorInput = {
  name: string;
  qualification: string;
  specialty: string;
  availableDays: string[];
  startTime: string;
  endTime: string;
  schedule: ScheduleRow[];
  consultationType: "in_person" | "online" | "both";
  active: boolean;
};

function DoctorForm({
  doctor,
  saving,
  onCancel,
  onSubmit,
}: {
  doctor?: any;
  saving: boolean;
  onCancel?: () => void;
  onSubmit: (input: DoctorInput) => void;
}) {
  const initialSchedule = useMemo<ScheduleRow[]>(() => {
    if (doctor?.schedule?.length) return doctor.schedule;
    if (doctor?.availableDays?.length) {
      return doctor.availableDays.map((day: string) => ({ day, startTime: doctor.startTime, endTime: doctor.endTime }));
    }
    return [];
  }, [doctor]);
  const [sameTiming, setSameTiming] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(initialSchedule.map((slot) => slot.day));
  const [schedule, setSchedule] = useState<Record<string, { startTime: string; endTime: string }>>(() => {
    const map: Record<string, { startTime: string; endTime: string }> = {};
    for (const day of dayOptions) {
      const existing = initialSchedule.find((slot) => slot.day === day);
      map[day] = { startTime: existing?.startTime ?? doctor?.startTime ?? "09:00", endTime: existing?.endTime ?? doctor?.endTime ?? "17:00" };
    }
    return map;
  });

  function toggleDay(day: string) {
    setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  }

  function updateSchedule(day: string, key: "startTime" | "endTime", value: string) {
    setSchedule((current) => {
      if (!sameTiming) return { ...current, [day]: { ...current[day], [key]: value } };
      const next = { ...current };
      for (const item of dayOptions) next[item] = { ...next[item], [key]: value };
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const rows = selectedDays.map((day) => ({ day, ...schedule[day] }));
    onSubmit({
      name: String(formData.get("name")),
      qualification: String(formData.get("qualification")),
      specialty: String(formData.get("specialty")),
      availableDays: selectedDays,
      startTime: rows[0]?.startTime ?? "",
      endTime: rows[0]?.endTime ?? "",
      schedule: rows,
      consultationType: String(formData.get("consultationType")) as "in_person" | "online" | "both",
      active: true,
    });
    if (!doctor) form.reset();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input name="name" placeholder="Doctor name" defaultValue={doctor?.name ?? ""} required />
          <Input name="qualification" placeholder="Qualification" defaultValue={doctor?.qualification ?? ""} required />
          <Input name="specialty" placeholder="Specialty" defaultValue={doctor?.specialty ?? ""} required />

          <label className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span>Use same timing for all selected days</span>
            <input type="checkbox" checked={sameTiming} onChange={(event) => setSameTiming(event.target.checked)} />
          </label>

          <div className="flex flex-wrap gap-2">
            {dayOptions.map((day) => (
              <button
                key={day}
                className={selectedDays.includes(day) ? "rounded-md border bg-primary px-3 py-2 text-sm text-primary-foreground" : "rounded-md border px-3 py-2 text-sm"}
                onClick={() => toggleDay(day)}
                type="button"
              >
                {day}
              </button>
            ))}
          </div>

          {sameTiming ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input type="time" value={schedule.Mon.startTime} onChange={(event) => updateSchedule("Mon", "startTime", event.target.value)} required />
              <Input type="time" value={schedule.Mon.endTime} onChange={(event) => updateSchedule("Mon", "endTime", event.target.value)} required />
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDays.map((day) => (
                <div key={day} className="grid grid-cols-[48px_1fr_1fr] items-center gap-2">
                  <span className="text-sm font-medium">{day}</span>
                  <Input type="time" value={schedule[day].startTime} onChange={(event) => updateSchedule(day, "startTime", event.target.value)} required />
                  <Input type="time" value={schedule[day].endTime} onChange={(event) => updateSchedule(day, "endTime", event.target.value)} required />
                </div>
              ))}
            </div>
          )}

          <select name="consultationType" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" defaultValue={doctor?.consultationType ?? "in_person"}>
            <option value="in_person">In person</option>
            <option value="online">Online</option>
            <option value="both">Both</option>
          </select>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving || !selectedDays.length}>
              <Plus className="h-4 w-4" />
              {doctor ? "Save doctor" : "Add doctor"}
            </Button>
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
