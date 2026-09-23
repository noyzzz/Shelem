import type { Card, Room } from "./types";

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

export const SUIT_SYMBOL: Record<Card["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

export function sortCards(cards: Card[]) {
  return [...cards].sort(
    (left, right) =>
      suitOrder.indexOf(left.suit) - suitOrder.indexOf(right.suit) ||
      rankOrder.indexOf(left.rank) - rankOrder.indexOf(right.rank),
  );
}

export function suitLabel(suit: Card["suit"] | null) {
  const labels: Record<Card["suit"], string> = {
    clubs: "Clubs",
    diamonds: "Diamonds",
    hearts: "Hearts",
    spades: "Spades",
  };
  return suit ? labels[suit] : "No suit";
}

export const suitSymbol = (suit: Card["suit"]) => SUIT_SYMBOL[suit];

export function getPlayableCardIds(room: Room | null, playerId: string) {
  if (
    room?.match?.phase !== "playing" ||
    room.match.play?.currentTurnPlayerId !== playerId
  ) {
    return [];
  }

  const hand = room.match.yourHand;
  const currentTrick = room.match.play.currentTrick;
  if (currentTrick.length === 0) {
    return hand.map((card) => card.id);
  }

  const leadSuit = currentTrick[0].card.suit;
  const followingCards = hand.filter((card) => card.suit === leadSuit);
  return (followingCards.length > 0 ? followingCards : hand).map(
    (card) => card.id,
  );
}
