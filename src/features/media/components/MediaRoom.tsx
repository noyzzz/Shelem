import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Player } from "@/domain/types";
import { cn } from "@/lib/utils";
import { ConnectionState } from "livekit-client";
import { useMediaRoom } from "../hooks/useMediaRoom";
import type { RequestMediaCredentials, SeatVideoTargets } from "../types";
import { ParticipantVideo } from "./ParticipantVideo";

export function MediaRoom({
  players,
  requestCredentials,
  seatVideoTargets,
}: {
  players: Player[];
  requestCredentials: RequestMediaCredentials;
  seatVideoTargets: SeatVideoTargets;
}) {
  const {
    audioRootRef,
    participants,
    state,
    microphoneEnabled,
    cameraEnabled,
    localCameraTrack,
    cameras,
    selectedCameraId,
    cameraPending,
    error,
    connected,
    joinMedia,
    leaveMedia,
    toggleMicrophone,
    toggleCamera,
    changeCamera,
  } = useMediaRoom(requestCredentials);
  return (
    <aside
      className="flex w-full flex-col gap-3"
      aria-label="Table voice and video"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              connected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                : "bg-muted-foreground/60",
            )}
          />
          <div>
            <strong className="block font-heading text-xs font-semibold text-foreground">
              {connected ? "Table conversation is live" : "Voice & video"}
            </strong>
            <small className="text-[11px] text-muted-foreground">
              {connected
                ? `${participants.length} ${
                    participants.length === 1 ? "person" : "people"
                  } connected`
                : "Join when you are ready. Camera and microphone start off."}
            </small>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!connected ? (
            <Button
              disabled={state === ConnectionState.Connecting}
              onClick={joinMedia}
              size="sm"
              type="button"
            >
              {state === ConnectionState.Connecting
                ? "Joining…"
                : "Join conversation"}
            </Button>
          ) : (
            <>
              <Button
                aria-pressed={microphoneEnabled}
                onClick={toggleMicrophone}
                size="sm"
                type="button"
                variant={microphoneEnabled ? "secondary" : "outline"}
              >
                {microphoneEnabled ? "Mic on" : "Mic off"}
              </Button>
              <Button
                aria-pressed={cameraEnabled}
                disabled={cameraPending}
                onClick={toggleCamera}
                size="sm"
                type="button"
                variant={cameraEnabled ? "secondary" : "outline"}
              >
                {cameraPending
                  ? "Starting camera…"
                  : cameraEnabled
                    ? "Camera on"
                    : "Camera off"}
              </Button>
              {cameras.length > 1 && (
                <Field className="w-36">
                  <FieldLabel>Camera</FieldLabel>
                  <Select
                    items={cameras.map((camera, index) => ({
                      label: camera.label || `Camera ${index + 1}`,
                      value: camera.deviceId,
                    }))}
                    onValueChange={(value) => {
                      if (value) void changeCamera(value);
                    }}
                    value={selectedCameraId}
                  >
                    <SelectTrigger
                      aria-label="Camera"
                      disabled={cameraPending}
                      size="sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {cameras.map((camera, index) => (
                          <SelectItem
                            key={camera.deviceId}
                            value={camera.deviceId}
                          >
                            {camera.label || `Camera ${index + 1}`}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Button
                onClick={leaveMedia}
                size="sm"
                type="button"
                variant="destructive"
              >
                Leave call
              </Button>
            </>
          )}
        </div>
      </div>

      {connected && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {participants.map((participant) => (
            <ParticipantVideo
              key={participant.identity}
              participant={participant}
              seatVideoRoot={seatVideoTargets[participant.identity] ?? null}
              player={players.find(
                (candidate) => candidate.id === participant.identity,
              )}
              localCameraTrack={
                participant.isLocal ? localCameraTrack : undefined
              }
            />
          ))}
        </div>
      )}
      <div className="hidden" ref={audioRootRef} />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </aside>
  );
}
