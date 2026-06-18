import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`}>
      <div className="size-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-display font-extrabold">
        V
      </div>
      <span className="font-display text-xl font-extrabold tracking-tight uppercase">
        Valence Health
      </span>
    </Link>
  );
}
