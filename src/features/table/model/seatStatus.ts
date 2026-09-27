import type { Room } from "@/domain/types";

export type TurnContext = {
  playerId: string;
  seatLabel: string;
};
export type BiddingStatus = {
  label: string;
  passed: boolean;
};
export type SeatReadiness = {
  label: string;
  ready: boolean;
};

export function getTurnContext(room: Room | null): TurnContext | null {
  const match = room?.match;
  if (!match) return null;

  if (match.phase === "bidding" && match.bidding.currentTurnPlayerId) {
    return {
      playerId: match.bidding.currentTurnPlayerId,
      seatLabel: "Bidding now",
    };
  }

  if (match.phase === "ground" && match.bidding.winnerId) {
    return {
      playerId: match.bidding.winnerId,
      seatLabel: "Discarding",
    };
  }

  if (match.phase === "playing" && match.play?.currentTurnPlayerId) {
    return {
      playerId: match.play.currentTurnPlayerId,
      seatLabel: "Playing now",
    };
  }

  return null;
}

export function getSeatReadiness(
  room: Room,
  playerId: string,
): SeatReadiness | undefined {
  if (!room.match) {
    const ready =
      room.players.find((player) => player.id === playerId)?.ready ?? false;
    return { label: ready ? "Ready" : "Not ready", ready };
  }

  if (room.match.phase === "hand-results") {
    const ready = room.match.nextHandReadyPlayerIds.includes(playerId);
    return {
      label: ready ? "Ready for next hand" : "Not ready for next hand",
      ready,
    };
  }

  return undefined;
}

export function getPlayerBiddingStatus(
  room: Room,
  playerId: string,
): BiddingStatus {
  const history = room.match?.bidding.history ?? [];
  const actions = history.filter((action) => action.playerId === playerId);
  const latestBid = [...actions]
    .reverse()
    .find(
      (action): action is { playerId: string; amount: number } =>
        "amount" in action,
    );
  const passed =
    room.match?.bidding.passedPlayerIds.includes(playerId) ?? false;

  if (passed) {
    return {
      label: latestBid ? `Passed · last bid ${latestBid.amount}` : "Passed",
      passed: true,
    };
  }

  return {
    label: latestBid ? `Bid ${latestBid.amount}` : "No bid yet",
    passed: false,
  };
}
