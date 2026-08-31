import { lazy, Suspense } from "react";
import { CopyIcon, MoreHorizontalIcon, VideoIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Player } from "../gameClient";
import { Logo } from "../ui/Logo";
import { cn } from "@/lib/utils";

const MediaRoom = lazy(() =>
  import("../MediaRoom").then(({ MediaRoom }) => ({ default: MediaRoom })),
);

export type HudPanel = "media" | "menu" | null;

type GameHudProps = {
  fullscreenEnabled: boolean;
  isFullscreen: boolean;
  onCopyInvite: () => void;
  onLeave: () => void;
  onPanelChange: (panel: HudPanel) => void;
  onToggleFullscreen: () => void;
  openPanel: HudPanel;
  playerName: string;
  players: Player[];
  roomCode: string;
};

export function GameHud({
  fullscreenEnabled,
  isFullscreen,
  onCopyInvite,
  onLeave,
  onPanelChange,
  onToggleFullscreen,
  openPanel,
  playerName,
  players,
  roomCode,
}: GameHudProps) {
  return (
    <header className="absolute top-0 left-0 z-40 flex min-h-14 w-full items-center justify-between px-4 py-3 sm:px-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 shadow-sm backdrop-blur-md">
        <Logo />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <Popover
          onOpenChange={(open) => onPanelChange(open ? "media" : null)}
          open={openPanel === "media"}
        >
          <PopoverTrigger
            aria-label="Voice & video"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "bg-card/80 backdrop-blur-md cursor-pointer",
            )}
          >
            <VideoIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Voice &amp; video</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(760px,calc(100vw-24px))] max-h-[80vh] overflow-y-auto p-4 bg-card/95 border-border shadow-2xl backdrop-blur-md" keepMounted sideOffset={8}>
            <PopoverHeader className="flex flex-row items-center justify-between pb-3 mb-2 border-b border-border/50">
              <PopoverTitle className="text-sm font-semibold">Table conversation</PopoverTitle>
              <Button
                aria-label="Close voice and video controls"
                onClick={() => onPanelChange(null)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </PopoverHeader>
            <Suspense fallback={<div className="py-6 text-center text-xs text-muted-foreground">Loading conversation…</div>}>
              <MediaRoom players={players} />
            </Suspense>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open game menu"
            className={cn(
              buttonVariants({ size: "icon-sm", variant: "outline" }),
              "bg-card/80 backdrop-blur-md cursor-pointer",
            )}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                Playing as <strong className="block text-sm font-medium text-foreground">{playerName}</strong>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCopyInvite}>
                <span>Private room {roomCode}</span>
                <CopyIcon className="ml-auto" />
              </DropdownMenuItem>
              {fullscreenEnabled && (
                <DropdownMenuItem onClick={onToggleFullscreen}>
                  {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLeave} variant="destructive">
                Leave table
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
