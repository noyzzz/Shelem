export type Flow = "create" | "join";
export type Screen = "home" | "setup" | "lobby";

export const isVirtualTableRequested = () =>
  new URLSearchParams(window.location.search).get("renderer") !== "dom";

export const cleanRoomCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

export const getInviteCode = () => {
  const pathMatch = window.location.pathname.match(
    /\/join\/([A-Z0-9]{6})(?:\/|$)/i,
  );
  if (pathMatch) return cleanRoomCode(pathMatch[1]);

  return cleanRoomCode(
    new URLSearchParams(window.location.search).get("room") ?? "",
  );
};

export const invitePath = (roomCode: string) => `/join/${roomCode}`;

export function setRoomPath(roomCode?: string) {
  const url = new URL(window.location.href);
  url.pathname = roomCode ? invitePath(roomCode) : "/";
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url.pathname + url.search);
}
