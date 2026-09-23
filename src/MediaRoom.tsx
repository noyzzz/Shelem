import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import {
  ConnectionState,
  Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoTrack,
  VideoPresets,
} from "livekit-client";
import { gameClient, type Player } from "./gameClient";
import { cn } from "@/lib/utils";

type MediaRoomProps = {
  players: Player[];
};

const CAMERA_DEVICE_KEY = "shelem-camera-device-id";
const CAMERA_CAPTURE_DEFAULTS = {
  frameRate: 15,
  resolution: VideoPresets.h360.resolution,
};

const getRememberedCamera = () => {
  try {
    return window.localStorage.getItem(CAMERA_DEVICE_KEY) ?? "";
  } catch {
    return "";
  }
};

const rememberCamera = (deviceId: string) => {
  try {
    window.localStorage.setItem(CAMERA_DEVICE_KEY, deviceId);
  } catch {
    // The selection lasts for this call when persistent storage is unavailable.
  }
};

const preferredCamera = (
  cameras: MediaDeviceInfo[],
  rememberedDeviceId: string,
) => {
  const remembered = cameras.find(
    (camera) => camera.deviceId === rememberedDeviceId,
  );
  if (remembered) return remembered;

  const physicalCameras = cameras.filter(
    (camera) => !/virtual|obs|manycam|snap camera/i.test(camera.label),
  );
  return (
    physicalCameras.find((camera) =>
      /front|facetime|integrated|built-in|webcam/i.test(camera.label),
    ) ??
    physicalCameras[0] ??
    cameras[0]
  );
};

export function MediaRoom({ players }: MediaRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const audioRootRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const joinAttemptRef = useRef(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [state, setState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [localCameraTrack, setLocalCameraTrack] =
    useState<VideoTrack | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] =
    useState(getRememberedCamera);
  const [cameraPending, setCameraPending] = useState(false);
  const [error, setError] = useState("");

  const refreshCameras = async (requestPermissions = false) => {
    const availableCameras = await Room.getLocalDevices(
      "videoinput",
      requestPermissions,
    );
    if (!mountedRef.current) return { availableCameras, selected: undefined };
    setCameras(availableCameras);
    const selected = preferredCamera(
      availableCameras,
      selectedCameraId || getRememberedCamera(),
    );
    if (selected) {
      setSelectedCameraId(selected.deviceId);
      rememberCamera(selected.deviceId);
    }
    return { availableCameras, selected };
  };

  const syncRoom = (room: Room) => {
    const cameraPublication = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    const publishedCameraTrack =
      room.state === ConnectionState.Connected &&
      cameraPublication?.trackSid &&
      !cameraPublication.isMuted
        ? (cameraPublication.videoTrack ?? null)
        : null;
    setState(room.state);
    setParticipants([
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ]);
    setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setLocalCameraTrack(publishedCameraTrack);
  };

  const leaveMedia = async () => {
    joinAttemptRef.current += 1;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    setParticipants([]);
    setState(ConnectionState.Disconnected);
    setMicrophoneEnabled(false);
    setCameraEnabled(false);
    setLocalCameraTrack(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      joinAttemptRef.current += 1;
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const joinMedia = async () => {
    if (roomRef.current) return;
    const joinAttempt = ++joinAttemptRef.current;
    let connectingRoom: Room | null = null;
    setError("");
    setState(ConnectionState.Connecting);

    try {
      const credentials = await gameClient.requestMediaToken();
      if (!mountedRef.current || joinAttempt !== joinAttemptRef.current) return;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: CAMERA_CAPTURE_DEFAULTS,
      });
      connectingRoom = room;
      roomRef.current = room;

      const sync = () => syncRoom(room);
      room
        .on(RoomEvent.ConnectionStateChanged, sync)
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync)
        .on(RoomEvent.TrackPublished, sync)
        .on(RoomEvent.TrackUnpublished, sync)
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        .on(RoomEvent.TrackStreamStateChanged, sync)
        .on(RoomEvent.Reconnected, sync)
        .on(RoomEvent.MediaDevicesChanged, () => {
          void refreshCameras(false);
        })
        .on(RoomEvent.ActiveDeviceChanged, (kind, deviceId) => {
          if (kind === "videoinput") {
            setSelectedCameraId(deviceId);
            rememberCamera(deviceId);
          }
        })
        .on(RoomEvent.MediaDevicesError, (deviceError: Error) => {
          setError(mediaDeviceError(deviceError, "camera or microphone"));
          sync();
        })
        .on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio && audioRootRef.current) {
              audioRootRef.current.appendChild(track.attach());
            }
            sync();
          },
        )
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((element) => element.remove());
          sync();
        })
        .on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setParticipants([]);
          setState(ConnectionState.Disconnected);
          setMicrophoneEnabled(false);
          setCameraEnabled(false);
          setLocalCameraTrack(null);
        });

      await room.connect(credentials.url, credentials.token, {
        peerConnectionTimeout: 15_000,
      });
      if (!mountedRef.current || joinAttempt !== joinAttemptRef.current) {
        if (roomRef.current === room) roomRef.current = null;
        await room.disconnect();
        return;
      }
      await refreshCameras(false);
      if (!mountedRef.current || joinAttempt !== joinAttemptRef.current) {
        if (roomRef.current === room) roomRef.current = null;
        await room.disconnect();
        return;
      }
      syncRoom(room);
    } catch (caught) {
      if (connectingRoom && roomRef.current === connectingRoom) {
        roomRef.current = null;
        await connectingRoom.disconnect();
      }
      if (!mountedRef.current || joinAttempt !== joinAttemptRef.current) return;
      setParticipants([]);
      setState(ConnectionState.Disconnected);
      setMicrophoneEnabled(false);
      setCameraEnabled(false);
      setLocalCameraTrack(null);
      setError(mediaConnectionError(caught));
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room) return;
    setError("");
    try {
      await room.localParticipant.setMicrophoneEnabled(!microphoneEnabled);
      syncRoom(room);
    } catch (caught) {
      setError(mediaDeviceError(caught, "microphone"));
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room || cameraPending) return;
    setError("");
    setCameraPending(true);
    try {
      const enabling = !room.localParticipant.isCameraEnabled;
      if (enabling) {
        const { availableCameras, selected } = await refreshCameras(true);
        const camera =
          availableCameras.find(
            (candidate) => candidate.deviceId === selectedCameraId,
          ) ?? selected;
        if (camera) {
          await room.switchActiveDevice(
            "videoinput",
            camera.deviceId,
            true,
          );
          await room.localParticipant.setCameraEnabled(true, {
            ...CAMERA_CAPTURE_DEFAULTS,
            deviceId: { exact: camera.deviceId },
          });
        } else {
          await room.localParticipant.setCameraEnabled(true, {
            ...CAMERA_CAPTURE_DEFAULTS,
            facingMode: "user",
          });
        }
      } else {
        await room.localParticipant.setCameraEnabled(false);
      }
      syncRoom(room);
    } catch (caught) {
      setError(mediaDeviceError(caught, "camera"));
    } finally {
      setCameraPending(false);
    }
  };

  const changeCamera = async (deviceId: string) => {
    const room = roomRef.current;
    setSelectedCameraId(deviceId);
    rememberCamera(deviceId);
    if (!room || cameraPending) return;

    setError("");
    setCameraPending(true);
    try {
      await room.switchActiveDevice("videoinput", deviceId, true);
      syncRoom(room);
    } catch (caught) {
      setError(mediaDeviceError(caught, "camera"));
    } finally {
      setCameraPending(false);
    }
  };

  const connected = state === ConnectionState.Connected;

  return (
    <aside className="flex w-full flex-col gap-3" aria-label="Table voice and video">
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
                    <SelectTrigger aria-label="Camera" disabled={cameraPending} size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {cameras.map((camera, index) => (
                          <SelectItem key={camera.deviceId} value={camera.deviceId}>
                            {camera.label || `Camera ${index + 1}`}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Button onClick={leaveMedia} size="sm" type="button" variant="destructive">
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

function ParticipantVideo({
  participant,
  player,
  localCameraTrack,
}: {
  participant: Participant;
  player?: Player;
  localCameraTrack?: VideoTrack | null;
}) {
  const [seatVideoRoot, setSeatVideoRoot] = useState<HTMLElement | null>(null);
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = participant.isLocal
    ? localCameraTrack
    : publication?.videoTrack;

  useEffect(() => {
    const targetId = seatCameraTargetId(participant.identity);
    const syncSeatVideoRoot = () => {
      setSeatVideoRoot(document.getElementById(targetId));
    };

    // The mobile hand can remove and restore a target without a seat change.
    const observer = new MutationObserver(syncSeatVideoRoot);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id"],
    });
    syncSeatVideoRoot();

    return () => observer.disconnect();
  }, [participant.identity]);

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
        <small className="truncate text-[10px] text-muted-foreground">{player ? seatName(player.position) : "At the table"}</small>
      </div>
      {cameraOn &&
        seatVideoRoot &&
        createPortal(
          <TrackVideo
            className={cn("h-full w-full object-cover", participant.isLocal && "-scale-x-100")}
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
              microphoneOn ? "bg-emerald-500 text-emerald-950" : "bg-muted text-muted-foreground",
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
    <svg className="size-2.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 5.4 1.8M15 9.4V6a3 3 0 0 0-5.8-1.1M17 10v1a5 5 0 0 1-.8 2.7M13.8 15.7A5 5 0 0 1 7 11v-1M12 16v4M9 20h6" />
      {muted && <path d="M4 4l16 16" />}
    </svg>
  );
}

function TrackVideo({
  className,
  isLocal,
  track,
}: {
  className?: string;
  isLocal: boolean;
  track?: VideoTrack | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!track || !element) return;

    if (isLocal) {
      element.srcObject = new MediaStream([track.mediaStreamTrack]);
      void element.play().catch(() => {});
      return () => {
        element.srcObject = null;
      };
    }

    track.attach(element);
    void element.play().catch(() => {});
    return () => {
      track.detach(element);
    };
  }, [isLocal, track]);

  return (
    <video
      autoPlay
      className={className ?? "absolute inset-0 h-full w-full object-cover"}
      muted
      playsInline
      ref={videoRef}
    />
  );
}

const seatCameraTargetId = (playerId: string) => `seat-camera-${playerId}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const seatName = (position: Player["position"]) =>
  `${position[0].toUpperCase()}${position.slice(1)} seat`;

const mediaDeviceError = (error: unknown, device: string) =>
  error instanceof Error && error.name === "NotAllowedError"
    ? `Allow ${device} access in your browser, then try again.`
    : `Unable to start your ${device}. Check that it is available.`;

const mediaConnectionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (
    /pc connection|peer connection|timeout|websocket|signal/i.test(message)
  ) {
    return "Voice and video could not connect. The card game is still available.";
  }
  return message || "Unable to join voice and video.";
};
