import type { ReactNode } from "react";

type GameRoomScreenProps = {
  children: ReactNode;
  hud: ReactNode;
};

export function GameRoomScreen({
  children,
  hud,
}: GameRoomScreenProps) {
  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-background text-foreground select-none isolate">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_42%,rgba(16,72,52,0.35),transparent_75%),radial-gradient(ellipse_95%_95%_at_50%_50%,transparent_45%,rgba(3,10,7,0.85)_100%)]"
      />
      {hud}
      <section className="relative h-full w-full overflow-hidden pointer-events-none *:pointer-events-auto">
        {children}
      </section>
    </main>
  );
}
