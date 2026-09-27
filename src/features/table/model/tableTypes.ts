import type { Card, Match, Player, Position, Team } from "@/domain/types";
import type { BiddingStatus, SeatReadiness, TurnContext } from "./seatStatus";

export type RelativePosition = Position;

export type TableSeatView = {
  readiness?: SeatReadiness;
  biddingStatus?: BiddingStatus;
  turn?: TurnContext;
  bidAmount: number | null;
  bidWinner: boolean;
  displayPosition: RelativePosition;
  handCount: number;
  player?: Player;
  ready: boolean;
  sourcePosition: Position;
  team: Team;
  trickWins: number;
  turnLabel?: string;
};

export type TableCardView = {
  card: Card;
  enabled: boolean;
  selected: boolean;
};

export type TableTrickCardView = {
  card: Card;
  displayPosition: RelativePosition;
  playerId: string;
};

export type TableViewModel = {
  viewerTeam?: Team;
  dealerPosition?: RelativePosition;
  groundCards: Card[];
  groundCount: number;
  hand: TableCardView[];
  handNumber?: number;
  phase: Match["phase"] | "lobby";
  resolvingTrickWinnerPosition?: RelativePosition;
  seats: TableSeatView[];
  trick: TableTrickCardView[];
  trump: Card["suit"] | null;
};
