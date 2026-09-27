import type { Card, Room } from "./types";

const blackSuits: Card["suit"][] = ["clubs", "spades"];
const redSuits: Card["suit"][] = ["diamonds", "hearts"];
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
  const presentSuits = new Set(cards.map((card) => card.suit));
  const black = blackSuits.filter((suit) => presentSuits.has(suit));
  const red = redSuits.filter((suit) => presentSuits.has(suit));
  const suitOrder: Card["suit"][] = [];
  let nextColor = black.length >= red.length ? "black" : "red";

  while (black.length > 0 || red.length > 0) {
    const preferred = nextColor === "black" ? black : red;
    const alternate = nextColor === "black" ? red : black;
    const suit = preferred.shift() ?? alternate.shift();
    if (suit) suitOrder.push(suit);
    nextColor = nextColor === "black" ? "red" : "black";
  }

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
