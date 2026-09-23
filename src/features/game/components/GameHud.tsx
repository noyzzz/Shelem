import { Logo } from "@/components/Logo";
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
import { cn } from "@/lib/utils";
import { CopyIcon, MoreHorizontalIcon, VideoIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

export type HudPanel = "media" | null;

type GameHudProps = {
  fullscreenEnabled: boolean;
  isFullscreen: boolean;
  onCopyInvite: () => void;
  onLeave: () => void;
  onPanelChange: (panel: HudPanel) => void;
  onToggleFullscreen: () => void;
  openPanel: HudPanel;
  playerName: string;
  media: ReactNode;
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
  media,
  roomCode,
}: GameHudProps) {
  return (
    <header className="absolute top-0 left-0 z-40 flex min-h-14 w-full items-center justify-between px-4 py-3 sm:px-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center rounded-lg border border-white/10 bg-[#081f18]/85 px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md">
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
              "rounded-lg border-white/10 bg-[#081f18]/85 text-foreground/90 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-primary/40 hover:bg-[#0c281f] hover:text-foreground cursor-pointer transition-all",
            )}
          >
            <VideoIcon
              data-icon="inline-start"
              className="text-primary size-4"
            />
            <span className="hidden sm:inline font-semibold text-xs">
              Voice &amp; video
            </span>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(760px,calc(100vw-24px))] max-h-[80vh] overflow-y-auto p-4 bg-[#081f18]/95 border-white/12 shadow-[0_16px_48px_rgba(0,0,0,0.7)] backdrop-blur-md rounded-xl"
            keepMounted
            sideOffset={8}
          >
            <PopoverHeader className="flex flex-row items-center justify-between pb-3 mb-2 border-b border-white/10">
              <PopoverTitle className="text-sm font-semibold text-foreground">
                Table conversation
              </PopoverTitle>
              <Button
                aria-label="Close voice and video controls"
                onClick={() => onPanelChange(null)}
                size="icon-xs"
                type="button"
                variant="ghost"
                className="hover:bg-white/10 text-muted-foreground hover:text-foreground"
              >
                <XIcon />
              </Button>
            </PopoverHeader>
            {media}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open game menu"
            className={cn(
              buttonVariants({ size: "icon-sm", variant: "outline" }),
              "rounded-lg border-white/10 bg-[#081f18]/85 text-foreground/90 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-primary/40 hover:bg-[#0c281f] hover:text-foreground cursor-pointer transition-all",
            )}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-lg border-white/12 bg-[#081f18]/95 shadow-2xl backdrop-blur-md"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                Playing as{" "}
                <strong className="block text-sm font-medium text-foreground">
                  {playerName}
                </strong>
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
