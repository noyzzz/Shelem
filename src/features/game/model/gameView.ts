import { suitLabel } from "@/domain/cards";
import { teamForPosition } from "@/domain/seats";
import type { Room, Team } from "@/domain/types";

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

export function getTableStatus(
  room: Room,
  viewerTeam: Team | undefined,
  isGroundWinner: boolean,
) {
  const match = room.match;
  if (!match) {
    const remaining = 4 - room.players.length;
    return {
      status:
        remaining === 0
          ? "All players have joined"
          : `Waiting for ${remaining} ${remaining === 1 ? "player" : "players"}`,
      detail: `Invite friends using code ${room.code}`,
    };
  }

  if (match.phase === "match-complete") {
    const winner = match.forfeit?.winningTeam ?? room.matchWinnerTeam ?? "one";
    return {
      status: `${teamLabel(winner, viewerTeam)} wins`,
      detail: match.forfeit
        ? "The match ended by forfeit"
        : "The match is complete",
    };
  }
  if (match.phase === "hand-results") {
    return {
      status: `${teamLabel("one", viewerTeam)} ${
        match.result?.rawPoints.one ?? 0
      } · ${teamLabel("two", viewerTeam)} ${match.result?.rawPoints.two ?? 0}`,
      detail: `Bid ${match.result?.bid ?? "—"} · ${suitLabel(
        match.trump,
      )} was trump`,
    };
  }
  if (match.phase === "playing") {
    const resolvingPlayer = room.players.find(
      (player) => player.id === match.play?.resolvingTrickWinnerId,
    );
    return resolvingPlayer
      ? {
          status: `${resolvingPlayer.name} wins the trick`,
          detail: "Reviewing all four cards",
        }
      : {
          status: `Trick ${(match.play?.completedTrickCount ?? 0) + 1} of 12`,
          detail: match.trump
            ? `${suitLabel(match.trump)} is trump`
            : "The opening card establishes trump",
        };
  }
  if (match.phase === "ground-reveal") {
    return {
      status: isGroundWinner ? "Your zamin is revealed" : "The zamin is hidden",
      detail: isGroundWinner
        ? "These cards will enter your hand"
        : "Waiting for the bidder",
    };
  }
  if (match.phase === "ground") {
    const bidder = room.players.find(
      (player) => player.id === match.bidding.winnerId,
    );
    return {
      status: `${bidder?.name ?? "The bidder"} won with ${
        match.bidding.winningBid ?? "—"
      }`,
      detail: isGroundWinner
        ? "Select four cards to discard"
        : "Waiting for the bidder to discard",
    };
  }
  return {
    status:
      match.bidding.currentBid === null
        ? "Opening bid: 100 minimum"
        : `Current bid: ${match.bidding.currentBid}`,
    detail: `${match.groundCount} cards are face down in the zamin`,
  };
}
