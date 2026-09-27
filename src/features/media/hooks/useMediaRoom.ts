import {
  ConnectionState,
  Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoTrack,
} from "livekit-client";
import { useEffect, useRef, useState } from "react";
import {
  CAMERA_CAPTURE_DEFAULTS,
  getRememberedCamera,
  mediaConnectionError,
  mediaDeviceError,
  preferredCamera,
  rememberCamera,
} from "../devices";
import type { RequestMediaCredentials } from "../types";

export function useMediaRoom(requestCredentials: RequestMediaCredentials) {
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
  const [localCameraTrack, setLocalCameraTrack] = useState<VideoTrack | null>(
    null,
  );
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(getRememberedCamera);
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
      const credentials = await requestCredentials();
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
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio && audioRootRef.current) {
            audioRootRef.current.appendChild(track.attach());
          }
          sync();
        })
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
          await room.switchActiveDevice("videoinput", camera.deviceId, true);
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

  return {
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
  };
}
