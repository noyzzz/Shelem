import { useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoTrack,
} from "livekit-client";
import { gameClient, type Player } from "./gameClient";

type MediaRoomProps = {
  players: Player[];
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
  const [cameraPending, setCameraPending] = useState(false);
  const [error, setError] = useState("");

  const syncRoom = (room: Room) => {
    const cameraPublication = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    setState(room.state);
    setParticipants([
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ]);
    setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setLocalCameraTrack((currentTrack) =>
      cameraPublication?.videoTrack ??
      (room.localParticipant.isCameraEnabled ? currentTrack : null),
    );
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
        // Four small video feeds are inexpensive enough to keep subscribed.
        // This avoids mobile browsers pausing a tile before it becomes visible.
        adaptiveStream: false,
        // A Shelem room has at most four publishers. Keeping every camera
        // active makes local previews predictable while players join.
        dynacast: false,
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
      const publication =
        await room.localParticipant.setCameraEnabled(enabling);
      setLocalCameraTrack(
        enabling
          ? (publication?.videoTrack ??
              room.localParticipant.getTrackPublication(Track.Source.Camera)
                ?.videoTrack ??
              null)
          : null,
      );
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = participant.isLocal
    ? localCameraTrack
    : publication?.videoTrack;

  useEffect(() => {
    const element = videoRef.current;
    if (!videoTrack || !element) return;

    if (participant.isLocal) {
      // Use the captured camera stream directly for the local tile. The
      // published track can be healthy while publication bookkeeping is a
      // render behind, especially immediately after granting permission.
      element.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
      void element.play().catch(() => {});
      return () => {
        element.srcObject = null;
      };
    }

    videoTrack.attach(element);
    void element.play().catch(() => {
      // Muted inline video normally autoplays. A later browser gesture or
      // track event will retry if a platform temporarily blocks playback.
    });
    return () => {
      videoTrack.detach(element);
    };
  }, [participant.isLocal, videoTrack]);

  const name = player?.name || participant.name || "Player";
  const cameraOn = Boolean(
    videoTrack && (participant.isLocal || !publication?.isMuted),
  );

  return (
    <div className="media-participant">
      <div className={`media-video ${cameraOn ? "has-video" : ""}`}>
        {/* Audio tracks are attached separately, so every video element can
            stay muted and satisfy mobile autoplay policies. */}
        <video autoPlay muted playsInline ref={videoRef} />
        {!cameraOn && <span>{initials(name)}</span>}
      </div>
      <div>
        <strong>
          {name}
          {participant.isLocal ? " (you)" : ""}
        </strong>
        <small>{player ? seatName(player.position) : "At the table"}</small>
      </div>
    </div>
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
