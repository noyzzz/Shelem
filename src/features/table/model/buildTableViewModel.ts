import { sortCards } from "@/domain/cards";
import {
  positionFromViewer,
  positionsClockwise,
  teamForPosition,
} from "@/domain/seats";
import type { Card, Position, Room } from "@/domain/types";
import type {
  TableCardView,
  TableSeatView,
  TableViewModel,
} from "@/features/table/model/tableTypes";
import {
  getPlayerBiddingStatus,
  getSeatReadiness,
  getTurnContext,
} from "./seatStatus";

const buildSeats = (room: Room, viewerPosition?: Position): TableSeatView[] =>
  positionsClockwise.map((sourcePosition) => {
    const player = room.players.find(
      (candidate) => candidate.position === sourcePosition,
    );
    const match = room.match;
    const currentTurn = getTurnContext(room);
    const turn =
      player && currentTurn?.playerId === player.id ? currentTurn : undefined;
    const readiness = player ? getSeatReadiness(room, player.id) : undefined;
    return {
      readiness,
      biddingStatus:
        player && match?.phase === "bidding"
          ? getPlayerBiddingStatus(room, player.id)
          : undefined,
      turn,
      bidAmount: match?.bidding.winningBid ?? null,
      bidWinner: Boolean(player && match?.bidding.winnerId === player.id),
      displayPosition: positionFromViewer(sourcePosition, viewerPosition),
      handCount: player && match ? (match.handCounts[player.id] ?? 0) : 0,
      player,
      ready: readiness?.ready ?? player?.ready ?? false,
      sourcePosition,
      team: teamForPosition(sourcePosition),
      trickWins:
        player && match?.play ? (match.play.trickWins[player.id] ?? 0) : 0,
      turnLabel: turn?.seatLabel.replace(/ now$/, ""),
    };
  });

const buildHand = (
  cards: Card[],
  enabledIds: string[] | undefined,
  selectedIds: string[],
  selectable: boolean,
): TableCardView[] =>
  sortCards(cards).map((card) => ({
    card,
    enabled:
      selectable && (enabledIds === undefined || enabledIds.includes(card.id)),
    selected: selectedIds.includes(card.id),
  }));

export function buildTableViewModel({
  enabledIds,
  room,
  selectable,
  selectedIds,
  viewerPosition,
}: {
  enabledIds: string[] | undefined;
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
    viewerTeam: viewerPosition ? teamForPosition(viewerPosition) : undefined,
    dealerPosition: match
      ? positionFromViewer(match.dealerPosition, viewerPosition)
      : undefined,
    groundCards: match?.groundCards ?? [],
    groundCount: match?.groundCount ?? 0,
    hand: buildHand(match?.yourHand ?? [], enabledIds, selectedIds, selectable),
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
