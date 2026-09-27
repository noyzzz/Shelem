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
    <section className="home-menu relative z-10 flex w-full flex-col animate-in fade-in-0 slide-in-from-left-2 duration-500">
      <div className="flex items-center gap-[clamp(0.875rem,1.2vw,1.5rem)]">
        <span
          aria-hidden="true"
          className="home-brand-mark grid size-[clamp(3.25rem,4vw,5.5rem)] shrink-0 place-items-center rounded-xl font-heading text-[clamp(1.5rem,2vw,2.5rem)] font-bold"
        >
          ش
        </span>
        <h1 className="m-0 font-heading text-[clamp(2.25rem,3.2vw,4.5rem)] font-semibold leading-none tracking-tight text-foreground">
          PlayRook
        </h1>
      </div>

      <nav aria-label="PlayRook main menu" className="mt-[clamp(1.5rem,2.5vw,3rem)] flex flex-col gap-[clamp(0.75rem,1vw,1rem)]">
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
