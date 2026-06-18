import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, LayoutList, Loader2, PhoneCall, Siren, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { playAlertSound } from "@/lib/alert-sound";
import { formatElapsed, formatTime, minutesSince } from "@/lib/time";
import { StaffTrends } from "@/components/staff-trends";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff Console — Valence Health" }] }),
  component: StaffConsole,
});

interface Facility {
  id: string;
  name: string;
  type: string;
  norm_wait_minutes: number;
  avg_service_minutes: number;
}

interface Entry {
  id: string;
  facility_id: string;
  patient_name: string;
  service: string;
  status: "waiting" | "in_service" | "completed" | "cancelled";
  is_emergency: boolean;
  checked_in_at: string | null;
  checked_out_at: string | null;
  alerted: boolean;
  created_at: string;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

function StaffConsole() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [facilityId, setFacilityId] = useState("");
  const [tab, setTab] = useState<"live" | "trends">("live");
  const [logFor, setLogFor] = useState<Entry | null>(null);
  const [alarmedIds, setAlarmedIds] = useState<Set<string>>(new Set());
  useTick();

  useEffect(() => {
    if (!loading && role && role !== "staff" && role !== "admin") {
      navigate({ to: "/app", replace: true });
    }
  }, [loading, role, navigate]);

  const facilitiesQ = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return data as Facility[];
    },
  });

  useEffect(() => {
    if (facilitiesQ.data?.length && !facilityId) setFacilityId(facilitiesQ.data[0].id);
  }, [facilitiesQ.data, facilityId]);

  const entriesQ = useQuery({
    queryKey: ["staff-entries", facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("facility_id", facilityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Entry[];
    },
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (!facilityId) return;
    const channel = supabase
      .channel("staff-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => {
        qc.invalidateQueries({ queryKey: ["staff-entries", facilityId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [facilityId, qc]);

  const facility = facilitiesQ.data?.find((f) => f.id === facilityId);
  const norm = facility?.norm_wait_minutes ?? 30;

  const all = entriesQ.data ?? [];
  const live = useMemo(() => {
    return all
      .filter((e) => (e.status === "waiting" || e.status === "in_service") && e.checked_in_at)
      .sort((a, b) => {
        if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
        return (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? "");
      });
  }, [all]);

  const overdue = live.filter((e) => minutesSince(e.checked_in_at) >= norm);

  // Audible alarm the first time a patient crosses the norm.
  useEffect(() => {
    const fresh = overdue.filter((e) => !alarmedIds.has(e.id));
    if (fresh.length > 0) {
      playAlertSound();
      setAlarmedIds((prev) => {
        const next = new Set(prev);
        fresh.forEach((e) => next.add(e.id));
        return next;
      });
    }
  }, [overdue, alarmedIds]);

  const completedToday = all.filter(
    (e) =>
      e.status === "completed" &&
      e.checked_in_at &&
      e.checked_out_at &&
      new Date(e.checked_out_at).toDateString() === new Date().toDateString(),
  );
  const avgThroughput =
    completedToday.length > 0
      ? (
          completedToday.reduce(
            (sum, e) =>
              sum +
              (new Date(e.checked_out_at!).getTime() - new Date(e.checked_in_at!).getTime()) / 60000,
            0,
          ) / completedToday.length
        ).toFixed(1)
      : "—";

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-entries", facilityId] });

  const callNext = async (id: string) => {
    const { error } = await supabase.from("queue_entries").update({ status: "in_service" }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };
  const complete = async (id: string) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "completed", checked_out_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Patient checked out.");
    refresh();
  };

  if (loading || (role && role !== "staff" && role !== "admin")) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
            Facility dashboard
          </h3>
          <p className="text-2xl font-display font-extrabold">Queue Management Console</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="rounded-lg border border-input bg-surface px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
          >
            {(facilitiesQ.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <div
            className={`px-3 py-2 rounded-md flex items-center gap-2 border ${
              overdue.length
                ? "bg-alert/5 text-alert border-alert/20"
                : "bg-success/5 text-success border-success/20"
            }`}
          >
            <span
              className={`size-2 rounded-full ${overdue.length ? "bg-alert animate-pulse" : "bg-success"}`}
            />
            <span className="text-xs font-bold font-mono">
              {overdue.length ? `${overdue.length} CRITICAL` : "ALL ON TIME"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-background ring-1 ring-border rounded-lg w-fit">
        <button
          onClick={() => setTab("live")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
            tab === "live" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutList className="size-4" /> Live queue
        </button>
        <button
          onClick={() => setTab("trends")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
            tab === "trends" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="size-4" /> Stats &amp; trends
        </button>
      </div>

      {tab === "trends" ? (
        <StaffTrends facilityId={facilityId} norm={norm} />
      ) : (
        <>
      {/* KPI widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="In live queue" value={String(live.length)} />
        <Kpi label="Over norm" value={String(overdue.length)} alert={overdue.length > 0} />
        <Kpi label="Avg throughput" value={avgThroughput} suffix=" min/p" />
        <Kpi label="Norm wait" value={String(norm)} suffix=" min" />
      </div>

      <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden shadow-sm">
        {overdue.length > 0 && (
          <div className="bg-alert p-4 flex flex-wrap justify-between items-center gap-3 text-alert-foreground animate-alert-throb">
            <div className="flex items-center gap-3">
              <Siren className="size-5" />
              <p className="text-sm font-medium">
                {overdue[0].patient_name} has waited {minutesSince(overdue[0].checked_in_at)}m —
                over the {norm}m threshold. Immediate attention required.
              </p>
            </div>
            <button
              onClick={() => setLogFor(overdue[0])}
              className="px-4 py-1.5 bg-white text-alert rounded font-bold text-xs uppercase tracking-tight"
            >
              Log cause
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                <th className="px-5 py-4 font-medium">Pos</th>
                <th className="px-5 py-4 font-medium">Patient</th>
                <th className="px-5 py-4 font-medium">Checked in</th>
                <th className="px-5 py-4 font-medium">Elapsed</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {live.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No patients in the live queue.
                  </td>
                </tr>
              )}
              {live.map((e, i) => {
                const mins = minutesSince(e.checked_in_at);
                const over = mins >= norm;
                return (
                  <tr key={e.id} className={over ? "bg-alert/5 animate-alert-throb" : "hover:bg-background/50 transition-colors"}>
                    <td className={`px-5 py-4 font-mono font-bold ${over ? "text-alert" : ""}`}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold">{e.patient_name || "Patient"}</span>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {e.service}
                        {e.is_emergency && (
                          <span className="text-alert font-bold uppercase">• emergency</span>
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {formatTime(e.checked_in_at)}
                    </td>
                    <td className={`px-5 py-4 font-mono text-sm ${over ? "text-alert font-bold" : ""}`}>
                      {formatElapsed(e.checked_in_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded ${
                          over
                            ? "bg-alert text-alert-foreground"
                            : e.status === "in_service"
                              ? "bg-success/10 text-success"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        {over ? "Overdue" : e.status === "in_service" ? "In service" : "Waiting"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        {e.status === "waiting" && (
                          <button
                            onClick={() => callNext(e.id)}
                            className="inline-flex items-center gap-1 text-primary text-xs font-bold hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                          >
                            <PhoneCall className="size-3.5" /> Call
                          </button>
                        )}
                        <button
                          onClick={() => complete(e.id)}
                          className="text-xs font-bold hover:bg-accent px-2 py-1 rounded transition-colors"
                        >
                          Done
                        </button>
                        {over && (
                          <button
                            onClick={() => setLogFor(e)}
                            className="inline-flex items-center gap-1 text-alert text-xs font-bold hover:bg-alert/10 px-2 py-1 rounded transition-colors"
                          >
                            <AlertTriangle className="size-3.5" /> Log
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}



      {logFor && (
        <LogCauseModal
          entry={logFor}
          facilityId={facilityId}
          loggedBy={user?.id}
          waitMinutes={minutesSince(logFor.checked_in_at)}
          onClose={() => setLogFor(null)}
          onSaved={refresh}
        />
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  suffix,
  alert,
}: {
  label: string;
  value: string;
  suffix?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-surface ring-1 p-4 rounded-xl ${
        alert ? "ring-alert/30" : "ring-border"
      }`}
    >
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-display font-extrabold ${alert ? "text-alert" : ""}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function LogCauseModal({
  entry,
  facilityId,
  loggedBy,
  waitMinutes,
  onClose,
  onSaved,
}: {
  entry: Entry;
  facilityId: string;
  loggedBy?: string;
  waitMinutes: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cause, setCause] = useState("");
  const [prevention, setPrevention] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!cause.trim()) {
      toast.error("Describe what caused the delay.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("alert_logs").insert({
      queue_entry_id: entry.id,
      facility_id: facilityId,
      wait_minutes: waitMinutes,
      cause: cause.trim().slice(0, 1000),
      prevention: prevention.trim().slice(0, 1000),
      logged_by: loggedBy ?? null,
    });
    if (!error) {
      await supabase.from("queue_entries").update({ alerted: true }).eq("id", entry.id);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Root cause logged.");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface rounded-2xl shadow-xl p-6 animate-entrance"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-extrabold text-lg">Log over-norm cause</h3>
            <p className="text-sm text-muted-foreground">
              {entry.patient_name} • waited {waitMinutes} min
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What caused the delay?
            </label>
            <textarea
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Doctor delayed by an emergency in another room."
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How will we prevent it next time?
            </label>
            <textarea
              value={prevention}
              onChange={(e) => setPrevention(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Add a float clinician during peak hours."
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-3 hover:bg-primary/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save & resolve alert
          </button>
        </div>
      </div>
    </div>
  );
}
