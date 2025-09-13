// utils/underglow-section.tsx
import { cn } from "@/lib/utils";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  className?: string;
  insetClassName?: string;  // how far the glow extends past the box
  color?: "violet" | "indigo" | "emerald" | "amber";
}>;

export function UnderGlowSection({
  children,
  className,
  insetClassName = "-inset-8 md:-inset-14 lg:-inset-20",
  color = "violet",
}: Props) {
  const palette = {
    violet:
      "bg-[radial-gradient(65%_80%_at_10%_10%,rgba(139,92,246,0.25),transparent_60%),radial-gradient(70%_70%_at_90%_90%,rgba(236,72,153,0.20),transparent_60%)]",
    indigo:
      "bg-[radial-gradient(65%_80%_at_10%_10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(70%_70%_at_90%_90%,rgba(56,189,248,0.20),transparent_60%)]",
    emerald:
      "bg-[radial-gradient(65%_80%_at_10%_10%,rgba(16,185,129,0.25),transparent_60%),radial-gradient(70%_70%_at_90%_90%,rgba(34,197,94,0.20),transparent_60%)]",
    amber:
      "bg-[radial-gradient(65%_80%_at_10%_10%,rgba(245,158,11,0.28),transparent_60%),radial-gradient(70%_70%_at_90%_90%,rgba(251,191,36,0.22),transparent_60%)]",
  }[color];

  return (
    // isolate => creates a new stacking context so the -z glow can't drop behind the page
    <section className={cn("relative isolate z-0", className)}>
      {/* Glow layer sits behind the content but inside this section */}
      <div
        className={cn(
          "pointer-events-none absolute rounded-3xl blur-2xl opacity-80",
          palette,
          insetClassName,
          "-z-10" // behind the content (z-10 below), not the whole page thanks to isolate
        )}
      />
      {/* Content stays above the glow */}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
