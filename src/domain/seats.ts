import type { Position, Room, Team } from "./types";

export const positionsClockwise: Position[] = [
  "south",
  "west",
  "north",
  "east",
];

export function positionFromViewer(
  position: Position,
  viewerPosition?: Position,
): Position {
  if (!viewerPosition) return position;
  const relativeIndex =
    (positionsClockwise.indexOf(position) -
      positionsClockwise.indexOf(viewerPosition) +
      positionsClockwise.length) %
    positionsClockwise.length;
  return positionsClockwise[relativeIndex];
}

export function teamForPosition(position: Position): Team {
  return position === "north" || position === "south" ? "one" : "two";
}

export function otherTeam(team: Team): Team {
  return team === "one" ? "two" : "one";
}

export function getViewerTeam(room: Room, playerId: string): Team | undefined {
  const viewer = room.players.find((player) => player.id === playerId);
  return viewer ? teamForPosition(viewer.position) : undefined;
}
