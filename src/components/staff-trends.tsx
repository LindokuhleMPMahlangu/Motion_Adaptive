import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/time";

interface CompletedEntry {
  id: string;
  checked_in_at: string;
  checked_out_at: string;
}

interface AlertLog {
  id: string;
  wait_minutes: number;
  cause: string;
  prevention: string | null;
  created_at: string;
}

const DAYS = 14;

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function StaffTrends({ facilityId, norm }: { facilityId: string; norm: number }) {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - DAYS);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const completedQ = useQuery({
    queryKey: ["trends-completed", facilityId, since],
    enabled: !!facilityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_entries")
        .select("id, checked_in_at, checked_out_at")
        .eq("facility_id", facilityId)
        .eq("status", "completed")
        .not("checked_in_at", "is", null)
        .not("checked_out_at", "is", null)
        .gte("checked_out_at", since)
        .order("checked_out_at", { ascending: true });
      if (error) throw error;
      return data as CompletedEntry[];
    },
  });

  const alertsQ = useQuery({
    queryKey: ["trends-alerts", facilityId, since],
    enabled: !!facilityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_logs")
        .select("id, wait_minutes, cause, prevention, created_at")
        .eq("facility_id", facilityId)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AlertLog[];
    },
  });

  const completed = completedQ.data ?? [];
  const alerts = alertsQ.data ?? [];

  // Build a continuous day series for the window.
  const series = useMemo(() => {
    const days: { key: string; date: string; waits: number[]; volume: number; overdue: number }[] =
      [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: dayKey(d.toISOString()),
        date: d.toDateString(),
        waits: [],
        volume: 0,
        overdue: 0,
      });
    }
    const byDate = new Map(days.map((d) => [d.date, d]));
    completed.forEach((e) => {
      const bucket = byDate.get(new Date(e.checked_out_at).toDateString());
      if (!bucket) return;
      const mins =
        (new Date(e.checked_out_at).getTime() - new Date(e.checked_in_at).getTime()) / 60000;
      bucket.waits.push(mins);
      bucket.volume += 1;
      if (mins >= norm) bucket.overdue += 1;
    });
    return days.map((d) => ({
      day: d.key,
      avgWait: d.waits.length ? Math.round(d.waits.reduce((a, b) => a + b, 0) / d.waits.length) : 0,
      volume: d.volume,
      overdue: d.overdue,
    }));
  }, [completed, norm]);

  const totals = useMemo(() => {
    const allWaits = completed.map(
      (e) => (new Date(e.checked_out_at).getTime() - new Date(e.checked_in_at).getTime()) / 60000,
    );
    const avg = allWaits.length ? allWaits.reduce((a, b) => a + b, 0) / allWaits.length : 0;
    const overdue = allWaits.filter((w) => w >= norm).length;
    // Compare first half vs second half of window for direction.
    const mid = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, mid).filter((s) => s.avgWait);
    const secondHalf = series.slice(mid).filter((s) => s.avgWait);
    const avgOf = (arr: typeof firstHalf) =>
      arr.length ? arr.reduce((a, b) => a + b.avgWait, 0) / arr.length : 0;
    const trend = avgOf(secondHalf) - avgOf(firstHalf);
    return {
      served: completed.length,
      avg: avg ? avg.toFixed(1) : "—",
      overdue,
      overduePct: completed.length ? Math.round((overdue / completed.length) * 100) : 0,
      trend,
    };
  }, [completed, norm, series]);

  // Aggregate recurring causes for "areas of improvement".
  const topCauses = useMemo(() => {
    const map = new Map<string, { count: number; sample: AlertLog }>();
    alerts.forEach((a) => {
      const norm = a.cause.trim().toLowerCase().slice(0, 60);
      const cur = map.get(norm);
      if (cur) cur.count += 1;
      else map.set(norm, { count: 1, sample: a });
    });
    return [...map.values()].sort((x, y) => y.count - x.count).slice(0, 6);
  }, [alerts]);

  if (completedQ.isLoading || alertsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Served (14d)" value={String(totals.served)} />
        <Stat label="Avg wait" value={String(totals.avg)} suffix=" min" />
        <Stat label="Over-norm" value={`${totals.overduePct}%`} alert={totals.overduePct > 0} />
        <Stat
          label="Trend vs prior"
          value={`${totals.trend > 0 ? "+" : ""}${totals.trend.toFixed(1)}`}
          suffix=" min"
          alert={totals.trend > 0}
          good={totals.trend < 0}
          icon={totals.trend > 0 ? "up" : "down"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Average wait time" subtitle={`14-day trend · norm ${norm} min`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="waitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="avgWait"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#waitFill)"
                name="Avg wait (min)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Daily volume & over-norm" subtitle="Patients served vs delayed">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="volume" fill="var(--primary)" radius={[3, 3, 0, 0]} name="Served" />
              <Bar dataKey="overdue" fill="var(--alert)" radius={[3, 3, 0, 0]} name="Over norm" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="bg-surface ring-1 ring-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="size-4 text-primary" />
          <h4 className="font-display font-extrabold">Areas of improvement</h4>
          <span className="text-xs text-muted-foreground">
            — recurring causes from logged delays
          </span>
        </div>
        {topCauses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No over-norm delays logged in the last {DAYS} days.
          </p>
        ) : (
          <ul className="space-y-3">
            {topCauses.map(({ count, sample }) => (
              <li
                key={sample.id}
                className="flex gap-3 p-3 rounded-lg bg-background ring-1 ring-border"
              >
                <span className="shrink-0 size-7 grid place-items-center rounded-md bg-alert/10 text-alert font-mono font-bold text-xs">
                  {count}×
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{sample.cause}</p>
                  {sample.prevention && (
                    <p className="text-xs text-success mt-0.5">
                      <span className="font-bold uppercase tracking-wide">Fix:</span>{" "}
                      {sample.prevention}
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    last logged {formatDateTime(sample.created_at)} · {sample.wait_minutes}m wait
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  alert,
  good,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  alert?: boolean;
  good?: boolean;
  icon?: "up" | "down";
}) {
  return (
    <div className={`bg-surface ring-1 p-4 rounded-xl ${alert ? "ring-alert/30" : "ring-border"}`}>
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <p
        className={`text-2xl font-display font-extrabold flex items-center gap-1 ${
          alert ? "text-alert" : good ? "text-success" : ""
        }`}
      >
        {icon === "up" && <TrendingUp className="size-4" />}
        {icon === "down" && <TrendingDown className="size-4" />}
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface ring-1 ring-border rounded-xl p-5">
      <h4 className="font-display font-extrabold">{title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      {children}
    </div>
  );
}
