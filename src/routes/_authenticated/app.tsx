import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  Loader2,
  LogIn,
  QrCode,
  Siren,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { playAlertSound } from "@/lib/alert-sound";
import { formatDateTime, formatElapsed, formatTime, minutesSince } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "My Queue — Valence Health" }] }),
  component: PatientApp,
});

interface Facility {
  id: string;
  name: string;
  type: string;
  location: string;
  norm_wait_minutes: number;
  avg_service_minutes: number;
  services: string[];
}

interface QueueEntry {
  id: string;
  facility_id: string;
  service: string;
  status: "waiting" | "in_service" | "completed" | "cancelled";
  is_emergency: boolean;
  booked_for: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
}

interface LiveStatus {
  entry_id: string;
  facility_name: string;
  service: string;
  status: string;
  is_emergency: boolean;
  checked_in_at: string;
  queue_position: number;
  people_ahead: number;
  total_waiting: number;
  est_wait_minutes: number;
  norm_wait_minutes: number;
}

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function PatientApp() {
  const { user, fullName } = useAuth();
  const qc = useQueryClient();
  const [alarmFired, setAlarmFired] = useState(false);
  useTick(1000);

  const facilitiesQ = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return data as Facility[];
    },
  });

  const entriesQ = useQuery({
    queryKey: ["my-entries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QueueEntry[];
    },
  });

  const liveQ = useQuery({
    queryKey: ["my-live", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_queue_status");
      if (error) throw error;
      return (data?.[0] as LiveStatus | undefined) ?? null;
    },
    refetchInterval: 20000,
  });

  // Realtime: any change to my queue rows refreshes everything.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("patient-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => {
        qc.invalidateQueries({ queryKey: ["my-entries", user.id] });
        qc.invalidateQueries({ queryKey: ["my-live", user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const live = liveQ.data;
  const elapsedMin = live ? minutesSince(live.checked_in_at) : 0;
  const overNorm = !!live && elapsedMin >= live.norm_wait_minutes;

  // Fire the audible + visual alarm once when the wait crosses the norm.
  useEffect(() => {
    if (overNorm && !alarmFired) {
      playAlertSound();
      setAlarmFired(true);
    }
    if (!overNorm && alarmFired) setAlarmFired(false);
  }, [overNorm, alarmFired]);

  const entries = entriesQ.data ?? [];
  const bookings = entries.filter(
    (e) => e.status === "waiting" && !e.checked_in_at && e.booked_for,
  );
  const history = entries
    .filter((e) => e.status === "completed" || e.status === "cancelled")
    .slice(0, 6);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-entries", user?.id] });
    qc.invalidateQueries({ queryKey: ["my-live", user?.id] });
  };

  const checkIn = async (entryId: string) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ checked_in_at: new Date().toISOString(), status: "waiting" })
      .eq("id", entryId);
    if (error) return toast.error(error.message);
    toast.success("Scanned in — you're in the live queue.");
    refresh();
  };

  const checkOut = async (entryId: string) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ checked_out_at: new Date().toISOString(), status: "completed" })
      .eq("id", entryId);
    if (error) return toast.error(error.message);
    toast.success("Checked out. Take care!");
    refresh();
  };

  const cancel = async (entryId: string) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "cancelled" })
      .eq("id", entryId);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled.");
    refresh();
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-12 gap-8 items-start">
      <section className="lg:col-span-5 space-y-6">
        {/* Live status / active queue */}
        <div className="bg-surface ring-1 ring-border rounded-3xl p-6 shadow-sm animate-entrance">
          <header className="mb-6 flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">
                Live status
              </p>
              <h2 className="text-2xl font-display font-extrabold">
                Welcome, {fullName?.split(" ")[0] || "there"}
              </h2>
            </div>
            {live ? (
              <span className="bg-success/10 text-success text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                Checked in
              </span>
            ) : (
              <span className="bg-muted text-muted-foreground text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                Not in queue
              </span>
            )}
          </header>

          {live ? (
            <>
              <div
                className={`rounded-2xl p-6 mb-5 text-primary-foreground ${
                  overNorm ? "bg-alert animate-alert-throb" : "bg-primary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono opacity-80 uppercase tracking-widest">
                    {live.facility_name}
                  </p>
                  {live.is_emergency && (
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold uppercase">
                      Emergency
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono opacity-80 uppercase tracking-widest mt-3 mb-1">
                  Current position
                </p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-7xl font-display font-extrabold tracking-tighter">
                    {String(live.queue_position).padStart(2, "0")}
                  </span>
                  <span className="text-xl opacity-60">/ {live.total_waiting}</span>
                </div>
                <div className="flex justify-between items-end border-t border-white/15 pt-4">
                  <div>
                    <p className="text-[10px] uppercase opacity-70 mb-1">Elapsed wait</p>
                    <p className="text-2xl font-mono font-medium animate-pulse-subtle">
                      {formatElapsed(live.checked_in_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase opacity-70 mb-1">Est. remaining</p>
                    <p className="text-2xl font-mono font-medium">~{live.est_wait_minutes}m</p>
                  </div>
                </div>
              </div>

              {overNorm && (
                <div className="mb-5 rounded-xl border border-alert/30 bg-alert/5 p-4 flex gap-3 items-start">
                  <Siren className="size-5 text-alert shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-alert">Your wait is over the norm</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You've waited {elapsedMin}m (norm is {live.norm_wait_minutes}m). Staff have
                      been alerted to attend to you as soon as possible.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => checkOut(live.entry_id)}
                  className="flex items-center justify-center gap-2 p-4 bg-background border border-border rounded-xl hover:bg-accent transition-colors font-bold text-sm"
                >
                  <QrCode className="size-4 text-primary" /> Scan out
                </button>
                <button
                  onClick={() => cancel(live.entry_id)}
                  className="flex items-center justify-center gap-2 p-4 bg-background border border-border rounded-xl hover:bg-accent transition-colors font-bold text-sm"
                >
                  <X className="size-4" /> Leave queue
                </button>
              </div>
            </>
          ) : (
            <JoinPanel
              facilities={facilitiesQ.data ?? []}
              onDone={refresh}
              userName={fullName}
              userId={user?.id}
            />
          )}
        </div>

        {!live && (
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-3">
            <div className="size-2 bg-primary rounded-full mt-1.5 shrink-0" />
            <p className="text-xs text-primary/80 leading-relaxed font-medium">
              Booked ahead? Tap “Scan in” on your booking below when you arrive to join the live
              queue and start your timer.
            </p>
          </div>
        )}
      </section>

      <section className="lg:col-span-7 space-y-6">
        {/* Upcoming bookings */}
        <div className="bg-surface ring-1 ring-border rounded-2xl p-6 shadow-sm animate-entrance [animation-delay:150ms]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="size-4 text-primary" />
            <h3 className="font-display font-bold text-lg">Upcoming bookings</h3>
          </div>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No advance bookings yet.</p>
          ) : (
            <ul className="space-y-2">
              {bookings.map((b) => {
                const f = (facilitiesQ.data ?? []).find((x) => x.id === b.facility_id);
                return (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border p-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">{f?.name ?? "Facility"}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.service} • {formatDateTime(b.booked_for)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => checkIn(b.id)}
                        disabled={!!live}
                        title={live ? "You're already in a live queue" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <LogIn className="size-3.5" /> Scan in
                      </button>
                      <button
                        onClick={() => cancel(b.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent visits */}
        <div className="bg-surface ring-1 ring-border rounded-2xl p-6 shadow-sm animate-entrance [animation-delay:250ms]">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="size-4 text-success" />
            <h3 className="font-display font-bold text-lg">Recent visits</h3>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your completed visits will appear here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => {
                const f = (facilitiesQ.data ?? []).find((x) => x.id === h.facility_id);
                const waited =
                  h.checked_in_at && h.checked_out_at
                    ? Math.round(
                        (new Date(h.checked_out_at).getTime() -
                          new Date(h.checked_in_at).getTime()) /
                          60000,
                      )
                    : null;
                return (
                  <li key={h.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold text-sm">{f?.name ?? "Facility"}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.service} • in {formatTime(h.checked_in_at)} → out{" "}
                        {formatTime(h.checked_out_at)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                        h.status === "completed"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {h.status === "completed"
                        ? waited !== null
                          ? `${waited} min`
                          : "Done"
                        : "Cancelled"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function JoinPanel({
  facilities,
  onDone,
  userName,
  userId,
}: {
  facilities: Facility[];
  onDone: () => void;
  userName: string;
  userId?: string;
}) {
  const [facilityId, setFacilityId] = useState("");
  const [service, setService] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  const facility = useMemo(
    () => facilities.find((f) => f.id === facilityId),
    [facilities, facilityId],
  );

  useEffect(() => {
    if (facilities.length && !facilityId) setFacilityId(facilities[0].id);
  }, [facilities, facilityId]);
  useEffect(() => {
    if (facility && !facility.services.includes(service)) setService(facility.services[0] ?? "");
  }, [facility, service]);

  const create = async (opts: { emergency?: boolean; advance?: boolean }) => {
    if (!facilityId || !userId) return;
    if (opts.advance && !when) {
      toast.error("Pick a date and time for your booking.");
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("queue_entries").insert({
      facility_id: facilityId,
      patient_id: userId,
      patient_name: userName || "Patient",
      service: service || "General consultation",
      is_emergency: !!opts.emergency,
      booked_for: opts.advance ? new Date(when).toISOString() : null,
      checked_in_at: opts.advance ? null : now,
      status: "waiting",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (opts.advance) toast.success("Booked! Scan in when you arrive.");
    else toast.success(opts.emergency ? "Emergency check-in recorded." : "You're in the queue.");
    setWhen("");
    onDone();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Facility
        </label>
        <select
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.type})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Service
        </label>
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {(facility?.services ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => create({})}
        disabled={busy}
        className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-3.5 hover:bg-primary/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
        Scan in now (walk-in)
      </button>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-primary" /> Book in advance
        </div>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => create({ advance: true })}
          disabled={busy}
          className="w-full rounded-xl bg-background border border-border font-bold py-2.5 text-sm hover:bg-accent transition-colors disabled:opacity-60"
        >
          Reserve a slot
        </button>
      </div>

      <button
        onClick={() => create({ emergency: true })}
        disabled={busy}
        className="w-full py-3.5 bg-alert text-alert-foreground rounded-xl font-display font-extrabold uppercase tracking-widest text-sm hover:brightness-110 transition-all shadow-lg shadow-alert/20 inline-flex items-center justify-center gap-2"
      >
        <AlarmClock className="size-4" /> Emergency scan-in
      </button>
    </div>
  );
}
