import {
  ArrowRightIcon,
  KeyRoundIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeScreen({
  onBegin,
}: {
  onBegin: (flow: "create" | "join") => void;
}) {
  return (
    <section className="relative z-10 flex w-full max-w-md flex-col animate-in fade-in-0 slide-in-from-left-2 duration-500">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-13 shrink-0 place-items-center rounded-xl border border-[#edd493]/60 bg-gradient-to-b from-[#f3dfa7] via-primary to-[#caa353] font-heading text-2xl font-bold text-primary-foreground shadow-[0_4px_16px_rgba(229,197,122,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] sm:size-15 sm:text-3xl"
        >
          ش
        </span>
        <h1 className="m-0 font-heading text-4xl font-semibold leading-none tracking-tight text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
          PlayRook
        </h1>
      </div>

      <nav aria-label="PlayRook main menu" className="mt-8 flex flex-col gap-3">
        <Button
          className="w-full justify-between"
          onClick={() => onBegin("create")}
          size="menu"
          type="button"
          variant="menu"
        >
          <span className="flex items-center gap-3">
            <PlusIcon data-icon="inline-start" />
            Create table
          </span>
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button
          className="w-full justify-between"
          onClick={() => onBegin("join")}
          size="menu"
          type="button"
          variant="menu-outline"
        >
          <span className="flex items-center gap-3">
            <KeyRoundIcon data-icon="inline-start" />
            Join with code
          </span>
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </nav>
    </section>
  );
}
