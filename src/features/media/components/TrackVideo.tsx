import type { VideoTrack } from "livekit-client";
import { useEffect, useRef } from "react";

export function TrackVideo({
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
