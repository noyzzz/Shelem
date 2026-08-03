import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    setParticipants([]);
    setState(ConnectionState.Disconnected);
    setMicrophoneEnabled(false);
    setCameraEnabled(false);
    setLocalCameraTrack(null);
  };

  useEffect(
    () => () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    },
    [],
  );

  const joinMedia = async () => {
    if (roomRef.current) return;
    setError("");
    setState(ConnectionState.Connecting);

    try {
      const credentials = await gameClient.requestMediaToken();
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: CAMERA_CAPTURE_DEFAULTS,
      });
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
      await refreshCameras(false);
      syncRoom(room);
    } catch (caught) {
      await leaveMedia();
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
    <aside className="media-room" aria-label="Table voice and video">
      <div className="media-room-heading">
        <div>
          <span className={`media-status ${connected ? "is-live" : ""}`} />
          <strong>{connected ? "Table conversation is live" : "Voice & video"}</strong>
          <small>
            {connected
              ? `${participants.length} ${
                  participants.length === 1 ? "person" : "people"
                } connected`
              : "Join when you are ready. Camera and microphone start off."}
          </small>
        </div>
        <div className="media-controls">
          {!connected ? (
            <button
              className="media-join"
              disabled={state === ConnectionState.Connecting}
              onClick={joinMedia}
              type="button"
            >
              {state === ConnectionState.Connecting
                ? "Joining…"
                : "Join conversation"}
            </button>
          ) : (
            <>
              <button
                aria-pressed={microphoneEnabled}
                className={microphoneEnabled ? "is-on" : ""}
                onClick={toggleMicrophone}
                type="button"
              >
                {microphoneEnabled ? "Mic on" : "Mic off"}
              </button>
              <button
                aria-pressed={cameraEnabled}
                className={cameraEnabled ? "is-on" : ""}
                disabled={cameraPending}
                onClick={toggleCamera}
                type="button"
              >
                {cameraPending
                  ? "Starting camera…"
                  : cameraEnabled
                    ? "Camera on"
                    : "Camera off"}
              </button>
              {cameras.length > 1 && (
                <label className="media-camera-picker">
                  <span>Camera</span>
                  <select
                    aria-label="Camera"
                    disabled={cameraPending}
                    onChange={(event) => {
                      void changeCamera(event.target.value);
                    }}
                    value={selectedCameraId}
                  >
                    {cameras.map((camera, index) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="media-leave" onClick={leaveMedia} type="button">
                Leave call
              </button>
            </>
          )}
        </div>
      </div>

      {connected && (
        <div className="media-participants">
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
      <div className="media-audio-root" ref={audioRootRef} />
      {error && (
        <p className="media-error" role="alert">
          {error}
        </p>
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
    setSeatVideoRoot(
      document.getElementById(seatCameraTargetId(participant.identity)),
    );
  }, [participant.identity, player?.position]);

  const name = player?.name || participant.name || "Player";
  const cameraOn = Boolean(
    videoTrack && (participant.isLocal || !publication?.isMuted),
  );
  const microphoneOn = participant.isMicrophoneEnabled;

  return (
    <div className="media-participant">
      <div
        className={`media-video ${
          cameraOn && !seatVideoRoot ? "has-video" : ""
        }`}
      >
        {/* Audio tracks are attached separately, so every video element can
            stay muted and satisfy mobile autoplay policies. */}
        {cameraOn && !seatVideoRoot && (
          <TrackVideo isLocal={participant.isLocal} track={videoTrack} />
        )}
        {(!cameraOn || seatVideoRoot) && <span>{initials(name)}</span>}
      </div>
      <div>
        <strong>
          {name}
          {participant.isLocal ? " (you)" : ""}
        </strong>
        <small>{player ? seatName(player.position) : "At the table"}</small>
      </div>
      {cameraOn &&
        seatVideoRoot &&
        createPortal(
          <TrackVideo
            className={`seat-camera-video ${
              participant.isLocal ? "is-local" : ""
            }`}
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
            className={`seat-mic-status ${
              microphoneOn ? "is-on" : "is-muted"
            }`}
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
    <svg viewBox="0 0 24 24" aria-hidden="true">
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
      // This track is supplied only after LiveKit has assigned a publication
      // SID and while the room remains connected, so the preview reflects
      // what has actually been published to the other players.
      element.srcObject = new MediaStream([track.mediaStreamTrack]);
      void element.play().catch(() => {});
      return () => {
        element.srcObject = null;
      };
    }

    track.attach(element);
    void element.play().catch(() => {
      // Muted inline video normally autoplays. A later browser gesture or
      // track event will retry if a platform temporarily blocks playback.
    });
    return () => {
      track.detach(element);
    };
  }, [isLocal, track]);

  return (
    <video
      autoPlay
      className={className}
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
