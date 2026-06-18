import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, AlarmClock, CalendarClock, QrCode, ShieldCheck, Stethoscope } from "lucide-react";
import { Logo } from "@/components/brand";
import heroImage from "@/assets/hero-waiting.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Valence Health — Beat the Queue at Hospitals, Clinics & Pharmacies" },
      { name: "description", content: "Book ahead, scan yourself in for emergencies, track your live queue position, and trigger instant alerts when waiting time runs long. Valence Health tackles long healthcare queues." },
      { property: "og:title", content: "Valence Health — Beat the Queue" },
      { property: "og:description", content: "Live queue tracking and waiting-time alerts for hospitals, clinics and pharmacies." },
      { property: "og:image", content: heroImage },
      { name: "twitter:image", content: heroImage },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: QrCode,
    title: "Scan in, scan out",
    body: "Every visit starts with an entry scan and ends with an exit scan — your in and out times are recorded automatically.",
  },
  {
    icon: CalendarClock,
    title: "Book in advance",
    body: "Reserve a slot at any facility before you leave home, or walk in and join the live queue on the spot.",
  },
  {
    icon: AlarmClock,
    title: "Emergency fast-path",
    body: "Skip the booking flow. Scan yourself straight into triage when it can't wait.",
  },
  {
    icon: ShieldCheck,
    title: "Over-norm alerts",
    body: "When a wait exceeds the facility norm, an alarm sounds and staff log the root cause so it doesn't happen again.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="max-w-7xl mx-auto flex justify-between items-center px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-accent transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 pt-10 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-entrance">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground mb-6">
            <Activity className="size-3.5" /> Tackling the long-queue problem
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-balance">
            Put the waiting room in your patients' hands.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl text-pretty">
            Valence Health turns long, uncertain queues into a live, transparent flow.
            Patients book ahead or scan in, watch their position move in real time, and
            staff are alerted the moment a wait runs too long.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Join a queue now
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup", role: "staff" }}
              className="px-6 py-3 rounded-xl bg-surface border border-border font-semibold hover:bg-accent transition-colors inline-flex items-center gap-2"
            >
              <Stethoscope className="size-4" /> I'm staff
            </Link>
          </div>
        </div>

        <div className="animate-entrance [animation-delay:150ms]">
          <img
            src={heroImage}
            alt="A calm hospital waiting area with a live digital queue-status board on a blue wall"
            width={1280}
            height={832}
            className="rounded-3xl ring-1 ring-border shadow-xl w-full h-auto"
          />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface ring-1 ring-border rounded-2xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display font-bold text-lg mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Built to combat long healthcare queues — one transparent wait at a time.
          </p>
        </div>
      </footer>
    </main>
  );
}
