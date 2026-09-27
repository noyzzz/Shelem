import type { Player } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Track, type Participant, type VideoTrack } from "livekit-client";
import { createPortal } from "react-dom";
import { TrackVideo } from "./TrackVideo";

export function ParticipantVideo({
  participant,
  player,
  localCameraTrack,
  seatVideoRoot,
}: {
  participant: Participant;
  player?: Player;
  localCameraTrack?: VideoTrack | null;
  seatVideoRoot: HTMLElement | null;
}) {
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = participant.isLocal
    ? localCameraTrack
    : publication?.videoTrack;

  const name = player?.name || participant.name || "Player";
  const cameraOn = Boolean(
    videoTrack && (participant.isLocal || !publication?.isMuted),
  );
  const microphoneOn = participant.isMicrophoneEnabled;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-muted/40 p-2 shadow-xs">
      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-gradient-to-br from-emerald-950 to-card font-heading font-bold text-primary grid place-items-center text-xs">
        {cameraOn && !seatVideoRoot && (
          <TrackVideo isLocal={participant.isLocal} track={videoTrack} />
        )}
        {(!cameraOn || seatVideoRoot) && <span>{initials(name)}</span>}
      </div>
      <div className="min-w-0 grid gap-0.5">
        <strong className="truncate text-xs font-medium text-foreground">
          {name}
          {participant.isLocal ? " (you)" : ""}
        </strong>
        <small className="truncate text-[10px] text-muted-foreground">
          {player ? seatName(player.position) : "At the table"}
        </small>
      </div>
      {cameraOn &&
        seatVideoRoot &&
        createPortal(
          <TrackVideo
            className={cn(
              "h-full w-full object-cover",
              participant.isLocal && "-scale-x-100",
            )}
            isLocal={participant.isLocal}
            track={videoTrack}
          />,
          seatVideoRoot,
        )}
      {seatVideoRoot &&
        createPortal(
          <span
            aria-label={`${name}'s microphone is ${
              microphoneOn ? "on" : "muted"
            }`}
            className={cn(
              "absolute bottom-0 left-0 z-30 grid size-4.5 place-items-center rounded-full border border-background",
              microphoneOn
                ? "bg-emerald-500 text-emerald-950"
                : "bg-muted text-muted-foreground",
            )}
            title={microphoneOn ? "Microphone on" : "Microphone muted"}
          >
            <MicrophoneIcon muted={!microphoneOn} />
          </span>,
          seatVideoRoot,
        )}
    </div>
  );
}

function MicrophoneIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      className="size-2.5 stroke-2"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 5.4 1.8M15 9.4V6a3 3 0 0 0-5.8-1.1M17 10v1a5 5 0 0 1-.8 2.7M13.8 15.7A5 5 0 0 1 7 11v-1M12 16v4M9 20h6" />
      {muted && <path d="M4 4l16 16" />}
    </svg>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const seatName = (position: Player["position"]) =>
  `${position[0].toUpperCase()}${position.slice(1)} seat`;
