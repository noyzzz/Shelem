import { VideoPresets } from "livekit-client";

const CAMERA_DEVICE_KEY = "shelem-camera-device-id";
export const CAMERA_CAPTURE_DEFAULTS = {
  frameRate: 15,
  resolution: VideoPresets.h360.resolution,
};

export const getRememberedCamera = () => {
  try {
    return window.localStorage.getItem(CAMERA_DEVICE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const rememberCamera = (deviceId: string) => {
  try {
    window.localStorage.setItem(CAMERA_DEVICE_KEY, deviceId);
  } catch {
    // The selection lasts for this call when persistent storage is unavailable.
  }
};

export const preferredCamera = (
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

export const mediaDeviceError = (error: unknown, device: string) =>
  error instanceof Error && error.name === "NotAllowedError"
    ? `Allow ${device} access in your browser, then try again.`
    : `Unable to start your ${device}. Check that it is available.`;

export const mediaConnectionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (/pc connection|peer connection|timeout|websocket|signal/i.test(message)) {
    return "Voice and video could not connect. The card game is still available.";
  }
  return message || "Unable to join voice and video.";
};
