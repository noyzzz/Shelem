import type { SeatVideoTargetRef } from "@/components/SeatVideoTarget";
import type { Position } from "@/domain/types";
import type { TableViewModel } from "../model/tableTypes";

export type TableProps = {
  model: TableViewModel;
  status: string;
  detail: string;
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
  onSeatSelect?: (position: Position) => void;
  onSeatVideoTarget: SeatVideoTargetRef;
};
