import { Logo } from "@/components/Logo";
import { MenuTableScene } from "@/features/table/components/MenuTableScene";
import type { ReactNode } from "react";
import { HomeRoomBackdrop } from "./HomeRoomBackdrop";

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
    <main className="menu-screen menu-theme relative min-h-[100svh] overflow-hidden bg-background">
      <HomeRoomBackdrop />
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
      <div className="home-layout relative z-10">
        <div className="home-menu">{children}</div>
        <div className="home-table">
          <MenuTableScene playerName={playerName} />
        </div>
      </div>
    </main>
  );
}
