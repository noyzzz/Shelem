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
    <main className="fixed inset-0 h-screen h-[100dvh] w-screen overflow-hidden bg-radial-[ellipse_80%_60%_at_50%_0%] from-emerald-950/30 via-background to-background text-foreground select-none isolate">
      {hud}
      <section className="relative h-full w-full overflow-hidden pointer-events-none *:pointer-events-auto">
        {children}
      </section>
    </main>
  );
}
