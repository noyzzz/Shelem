import type { SeatVideoTargetRef } from "@/components/SeatVideoTarget";
import { useCallback, useState } from "react";
import type { SeatVideoTargets } from "../types";

export function useSeatVideoTargets() {
  const [targets, setTargets] = useState<SeatVideoTargets>({});
  const register = useCallback<SeatVideoTargetRef>((playerId, target) => {
    setTargets((previous) => {
      if ((previous[playerId] ?? null) === target) return previous;
      const next = { ...previous };
      if (target) next[playerId] = target;
      else delete next[playerId];
      return next;
    });
  }, []);

  return { targets, register };
}
