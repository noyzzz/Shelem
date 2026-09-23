export type Position = "north" | "south" | "east" | "west";
export type Team = "one" | "two";

export type Player = {
  id: string;
  name: string;
  position: Position;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
};

export type Card = {
  id: string;
  suit: "clubs" | "diamonds" | "hearts" | "spades";
  rank:
    | "A"
    | "K"
    | "Q"
    | "J"
    | "10"
    | "9"
    | "8"
    | "7"
    | "6"
    | "5"
    | "4"
    | "3"
    | "2";
};

export type Match = {
  phase:
    | "bidding"
    | "ground-reveal"
    | "ground"
    | "playing"
    | "hand-results"
    | "match-complete";
  handNumber: number;
  dealerPosition: Position;
  firstBidderPosition: Position;
  groundCount: number;
  groundCards: Card[];
  discardCount: number;
  trump: Card["suit"] | null;
  nextHandReadyPlayerIds: string[];
  handCounts: Record<string, number>;
  yourHand: Card[];
  bidding: {
    currentBid: number | null;
    highBidderId: string | null;
    currentTurnPlayerId: string | null;
    passedPlayerIds: string[];
    history: Array<
      { playerId: string; amount: number } | { playerId: string; pass: true }
    >;
    winningBid: number | null;
    winnerId: string | null;
  };
  play: {
    currentTurnPlayerId: string | null;
    currentTrick: Array<{ playerId: string; card: Card }>;
    completedTrickCount: number;
    lastTrickWinnerId: string | null;
    resolvingTrickWinnerId: string | null;
    trickReviewId: string | null;
    trickReviewEndsAt: number | null;
    trickWins: Record<string, number>;
  } | null;
  result?: {
    bid: number;
    biddingTeam: Team;
    defendingTeam: Team;
    rawPoints: Record<Team, number>;
    scoreDelta: Record<Team, number>;
    madeBid: boolean;
    shelem: boolean;
    matchScore: Record<Team, number>;
    matchWinnerTeam: Team | null;
  };
  forfeit?: {
    losingPlayerId: string;
    losingPlayerName: string;
    losingTeam: Team;
    winningTeam: Team;
    reason: "left" | "disconnected";
  };
};

export type Room = {
  code: string;
  hostPlayerId: string;
  players: Player[];
  score: Record<Team, number>;
  matchWinnerTeam: Team | null;
  match?: Match;
};
