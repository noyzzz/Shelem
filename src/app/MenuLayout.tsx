import { Logo } from "@/components/Logo";
import { MenuTableScene } from "@/features/table/components/MenuTableScene";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function MenuLayout({
  home,
  playerName,
  account,
  children,
}: {
  home: boolean;
  playerName: string;
  account: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="menu-screen relative min-h-[100svh] overflow-hidden bg-background">
      {!home && (
        <>
          <MenuTableScene playerName={playerName} />
          <div
            aria-hidden="true"
            className="menu-scene-scrim absolute inset-0"
          />
        </>
      )}
      {home ? (
        <div className="absolute top-3 right-3 z-30 sm:top-5 sm:right-6">
          {account}
        </div>
      ) : (
        <nav className="absolute top-0 left-0 z-30 flex min-h-[72px] w-full items-center justify-between px-6 sm:px-12">
          <Logo />
          {account}
        </nav>
      )}
      <div
        className={cn(
          "relative z-10",
          home
            ? "home-layout"
            : "mx-auto flex min-h-[100svh] w-full max-w-[1536px] items-center justify-center px-5 pt-24 pb-7 sm:px-8 sm:pb-10 lg:px-12",
        )}
      >
        {children}
        {home && (
          <div className="home-table">
            <MenuTableScene playerName={playerName} />
          </div>
        )}
      </div>
    </main>
  );
}
