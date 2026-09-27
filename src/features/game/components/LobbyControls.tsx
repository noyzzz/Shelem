import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "../api/gameClient";

export function LobbyControls({
  connectionStatus,
  inLobby,
  isHost,
  hasBots,
  ready,
  onToggleBots,
  onToggleReady,
  onTrickDisplayMsChange,
  trickDisplayMs,
}: {
  connectionStatus: ConnectionStatus;
  inLobby: boolean;
  isHost: boolean;
  hasBots: boolean;
  ready: boolean;
  onToggleBots: () => void;
  onToggleReady: () => void;
  onTrickDisplayMsChange: (milliseconds: number) => void;
  trickDisplayMs: number;
}) {
  if (!inLobby && connectionStatus === "connected") return null;
  return (
    <div className="absolute bottom-3.5 left-3.5 z-30 flex max-w-[calc(100%-1.75rem)] flex-wrap items-center gap-2.5 rounded-xl border border-white/10 bg-[#081f18]/90 px-3.5 py-2 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            connectionStatus === "connected"
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "bg-destructive animate-pulse",
          )}
        />
        <span className="text-xs font-medium text-foreground/80">
          {connectionStatus === "connected" ? "Connected" : "Reconnecting…"}
        </span>
      </div>
      {inLobby && (
        <div className="flex items-center gap-2 border-l border-white/10 pl-3">
          {isHost && (
            <>
              <label className="flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-card/80 px-2 text-[10px] font-semibold text-muted-foreground">
                Card pause
                <select
                  aria-label="Played-card pause"
                  className="bg-transparent font-bold text-foreground outline-none"
                  onChange={(event) =>
                    onTrickDisplayMsChange(Number(event.target.value))
                  }
                  value={trickDisplayMs}
                >
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                  <option value={5000}>5s</option>
                  <option value={7000}>7s</option>
                </select>
              </label>
              <Button
                onClick={onToggleBots}
                size="sm"
                type="button"
                variant="outline"
                className="rounded-lg border-white/15 bg-card/80 text-xs font-semibold hover:border-primary/40"
              >
                {hasBots ? "Remove bots" : "Fill bots"}
              </Button>
            </>
          )}
          <Button
            onClick={onToggleReady}
            size="sm"
            type="button"
            variant={ready ? "secondary" : "default"}
            className={cn(
              "rounded-lg text-xs font-bold transition-all",
              !ready &&
                "bg-gradient-to-r from-primary via-[#edd493] to-primary text-primary-foreground shadow-[0_2px_12px_rgba(229,197,122,0.3)]",
            )}
          >
            {ready ? "Ready ✓" : "I’m ready"}
          </Button>
        </div>
      )}
    </div>
  );
}
