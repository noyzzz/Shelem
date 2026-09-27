import { RotateCwIcon, SmartphoneIcon } from "lucide-react";
import { useMediaQuery } from "@/features/table/hooks/useMediaQuery";

export function PortraitOrientationPrompt() {
  const shouldRotate = useMediaQuery(
    "(max-width: 639px) and (orientation: portrait)",
  );

  if (!shouldRotate) return null;

  return (
    <aside
      aria-labelledby="portrait-orientation-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#03110c] px-8 text-center text-foreground"
      role="dialog"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(229,197,122,0.16),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(16,72,52,0.5),transparent_55%)]"
      />
      <div className="relative grid max-w-xs justify-items-center">
        <div className="relative mb-8 grid size-28 place-items-center rounded-full border border-primary/25 bg-[#0a2119]/90 shadow-[0_0_40px_rgba(229,197,122,0.14)]">
          <SmartphoneIcon
            aria-hidden="true"
            className="size-14 rotate-90 text-primary"
            strokeWidth={1.6}
          />
          <RotateCwIcon
            aria-hidden="true"
            className="absolute -right-1 -top-1 size-9 text-primary/80"
            strokeWidth={1.7}
          />
        </div>
        <h1
          className="font-heading text-2xl font-bold tracking-tight"
          id="portrait-orientation-title"
        >
          Rotate your phone
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Turn your phone sideways to see the full table and continue playing.
        </p>
        <div
          aria-hidden="true"
          className="mt-7 h-px w-24 bg-gradient-to-r from-transparent via-primary/70 to-transparent"
        />
      </div>
    </aside>
  );
}
