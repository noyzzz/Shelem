import { ArrowRightIcon, LockIcon, UsersIcon, VideoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function HomeScreen({ onBegin }: { onBegin: (flow: "create" | "join") => void }) {
  return (
    <section className="relative z-10 flex w-full max-w-xl flex-col items-center justify-center text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="mx-auto mb-5 flex w-32 items-center justify-between text-lg opacity-90" aria-hidden="true">
        <span className="text-primary">♣</span>
        <span className="text-destructive">♦</span>
        <span className="text-destructive">♥</span>
        <span className="text-primary">♠</span>
      </div>
      <h1 className="m-0 font-heading text-4xl sm:text-6xl font-semibold tracking-tight leading-tight text-foreground">
        Play Shelem together.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base sm:text-lg leading-relaxed text-muted-foreground">
        Private online tables for four players.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => onBegin("create")} size="lg" type="button">
          Create a table <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button
          onClick={() => onBegin("join")}
          size="lg"
          type="button"
          variant="outline"
        >
          Join with a code
        </Button>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Badge variant="outline" className="gap-1.5 py-1">
          <VideoIcon /> Live video
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1">
          <LockIcon /> Private rooms
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1">
          <UsersIcon /> Four players
        </Badge>
      </div>
    </section>
  );
}
