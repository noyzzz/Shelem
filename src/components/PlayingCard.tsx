import type { Card } from "@/domain/types";
import * as PlayingCardDeck from "@letele/playing-cards";
import type { ComponentType,SVGProps } from "react";

type PlayingCardComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;
const deck = PlayingCardDeck as unknown as Record<string, PlayingCardComponent>;
const suitPrefix: Record<Card["suit"], string> = {
  clubs: "C", diamonds: "D", hearts: "H", spades: "S",
};
const rankSuffix: Record<Card["rank"], string> = {
  A: "a", K: "k", Q: "q", J: "j", "10": "10", "9": "9", "8": "8",
  "7": "7", "6": "6", "5": "5", "4": "4", "3": "3", "2": "2",
};

export function CardFace({ card, className }: { card: Card; className?: string }) {
  const Face = deck[`${suitPrefix[card.suit]}${rankSuffix[card.rank]}`];
  return <Face aria-hidden="true" className={className} focusable="false" />;
}
export function CardBack({ className }: { className?: string }) {
  const Back = deck.B1;
  return <Back aria-hidden="true" className={className} focusable="false" />;
}
