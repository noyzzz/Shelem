import { useEffect, useState } from "react";
import type { HudPanel } from "../components/GameHud";

export function useGameDisplay(
  immersive: boolean,
  onError: (message: string) => void,
) {
  const [hudPanel, setHudPanel] = useState<HudPanel>(null);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("game-is-immersive", immersive);
    document.body.classList.toggle("game-is-immersive", immersive);
    if (!immersive && document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    return () => {
      document.documentElement.classList.remove("game-is-immersive");
      document.body.classList.remove("game-is-immersive");
    };
  }, [immersive]);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!hudPanel) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement)
        setHudPanel(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [hudPanel]);

  useEffect(
    () => () => {
      if (document.fullscreenElement)
        void document.exitFullscreen().catch(() => {});
    },
    [],
  );

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setHudPanel(null);
    } catch {
      onError("Fullscreen is not available in this browser.");
    }
  };

  return { hudPanel, setHudPanel, isFullscreen, toggleFullscreen };
}
