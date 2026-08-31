import type { Card, Position, Room } from "../gameClient";
import {
  positionsClockwise,
  positionFromViewer,
  teamForPosition,
} from "../game/gameView";
import type {
  RelativePosition,
  TableCardView,
  TableSeatView,
  TableViewModel,
} from "./tableTypes";

const suitOrder: Card["suit"][] = ["clubs", "diamonds", "spades", "hearts"];
const rankOrder: Card["rank"][] = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
];

const turnLabel = (room: Room, playerId: string) => {
  const match = room.match;
  if (!match) return undefined;
  if (
    match.phase === "bidding" &&
    match.bidding.currentTurnPlayerId === playerId
  ) {
    return "Bidding";
  }
  if (match.phase === "ground" && match.bidding.winnerId === playerId) {
    return "Discarding";
  }
  if (
    match.phase === "playing" &&
    match.play?.currentTurnPlayerId === playerId
  ) {
    return "Playing";
  }
  return undefined;
};

const buildSeats = (
  room: Room,
  viewerPosition?: Position,
): TableSeatView[] =>
  positionsClockwise.map((sourcePosition) => {
    const player = room.players.find(
      (candidate) => candidate.position === sourcePosition,
    );
    const match = room.match;
    return {
      bidAmount: match?.bidding.winningBid ?? null,
      bidWinner: Boolean(player && match?.bidding.winnerId === player.id),
      displayPosition: positionFromViewer(sourcePosition, viewerPosition),
      handCount: player && match ? match.handCounts[player.id] ?? 0 : 0,
      player,
      ready: player
        ? match?.phase === "hand-results"
          ? match.nextHandReadyPlayerIds.includes(player.id)
          : player.ready
        : false,
      sourcePosition,
      team: teamForPosition(sourcePosition),
      trickWins:
        player && match?.play ? match.play.trickWins[player.id] ?? 0 : 0,
      turnLabel: player ? turnLabel(room, player.id) : undefined,
    };
  });

const buildHand = (
  cards: Card[],
  enabledIds: string[],
  selectedIds: string[],
  selectable: boolean,
): TableCardView[] =>
  [...cards]
    .sort(
      (left, right) =>
        suitOrder.indexOf(left.suit) - suitOrder.indexOf(right.suit) ||
        rankOrder.indexOf(left.rank) - rankOrder.indexOf(right.rank),
    )
    .map((card) => ({
      card,
      enabled:
        selectable &&
        (enabledIds.length === 0 || enabledIds.includes(card.id)),
      selected: selectedIds.includes(card.id),
    }));

export function buildTableViewModel({
  enabledIds,
  room,
  selectable,
  selectedIds,
  viewerPosition,
}: {
  enabledIds: string[];
  room: Room;
  selectable: boolean;
  selectedIds: string[];
  viewerPosition?: Position;
}): TableViewModel {
  const match = room.match;
  const resolvingWinner =
    match?.play?.resolvingTrickWinnerId ?? match?.play?.lastTrickWinnerId;
  const resolvingPlayer = room.players.find(
    (player) => player.id === resolvingWinner,
  );

  return {
    dealerPosition: match
      ? positionFromViewer(match.dealerPosition, viewerPosition)
      : undefined,
    groundCards: match?.groundCards ?? [],
    groundCount: match?.groundCount ?? 0,
    hand: buildHand(
      match?.yourHand ?? [],
      enabledIds,
      selectedIds,
      selectable,
    ),
    handNumber: match?.handNumber,
    phase: match?.phase ?? "lobby",
    resolvingTrickWinnerPosition: resolvingPlayer
      ? positionFromViewer(resolvingPlayer.position, viewerPosition)
      : undefined,
    seats: buildSeats(room, match ? viewerPosition : undefined),
    trick:
      match?.play?.currentTrick.map((played) => {
        const player = room.players.find(
          (candidate) => candidate.id === played.playerId,
        );
        return {
          card: played.card,
          displayPosition: positionFromViewer(
            player?.position ?? "south",
            viewerPosition,
          ),
          playerId: played.playerId,
        };
      }) ?? [],
    trump: match?.trump ?? null,
  };
}
