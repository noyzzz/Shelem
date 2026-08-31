import { gameClient, type Position, type Room, type Team } from "../gameClient";

export const positionsClockwise: Position[] = ["south", "west", "north", "east"];

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

export function getViewerTeam(room: Room): Team | undefined {
  const viewer = room.players.find((player) => player.id === gameClient.playerId);
  return viewer ? teamForPosition(viewer.position) : undefined;
}

export function teamLabel(team: Team, viewerTeam?: Team) {
  if (!viewerTeam) return team === "one" ? "Team one" : "Team two";
  return team === viewerTeam ? "Your team" : "Opponents";
}

export function teamPlayerNames(room: Room, team: Team) {
  return room.players
    .filter((player) => teamForPosition(player.position) === team)
    .map((player) => player.name)
    .join(" & ");
}

export function formatScoreDelta(score: number) {
  return score > 0 ? `+${score}` : String(score);
}
