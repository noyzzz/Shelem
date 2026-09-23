import { teamForPosition } from "@/domain/seats";
import type { Position, Room } from "@/domain/types";
import { useEffect, useRef, useState } from "react";
import { gameClient } from "../api/gameClient";

export function useGameActions(room: Room, playerId: string) {
  const [actionError, setActionError] = useState("");
  const [bidAmount, setBidAmount] = useState(100);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [selectedPlayCardId, setSelectedPlayCardId] = useState<string | null>(
    null,
  );
  const [playPending, setPlayPending] = useState(false);
  const [seatChangePending, setSeatChangePending] = useState<Position | null>(
    null,
  );
  const acknowledgedTrickReviewIds = useRef(new Set<string>());
  const currentPlayer = room.players.find((player) => player.id === playerId);
  const ready = currentPlayer?.ready ?? false;
  const viewerTeam = currentPlayer
    ? teamForPosition(currentPlayer.position)
    : undefined;
  const hasBots = room.players.some((player) => player.isBot);
  const isGroundWinner = room.match?.bidding.winnerId === playerId;
  const selectedDiscardCards =
    room.match?.yourHand.filter((card) =>
      selectedDiscardIds.includes(card.id),
    ) ?? [];

  useEffect(() => {
    const currentBid = room?.match?.bidding.currentBid;
    const minimumBid =
      currentBid === null || currentBid === undefined ? 100 : currentBid + 5;
    setBidAmount(Math.min(minimumBid, 165));
  }, [room?.match?.bidding.currentBid]);

  useEffect(() => {
    if (room?.match?.phase !== "ground") {
      setSelectedDiscardIds([]);
    }
  }, [room?.match?.phase]);

  useEffect(() => {
    if (!selectedPlayCardId) return;
    const canKeepSelection =
      room?.match?.phase === "playing" &&
      room.match.play?.currentTurnPlayerId === playerId &&
      room.match.yourHand.some((card) => card.id === selectedPlayCardId);
    if (!canKeepSelection) setSelectedPlayCardId(null);
  }, [
    room?.match?.phase,
    room?.match?.play?.currentTurnPlayerId,
    room?.match?.yourHand,
    selectedPlayCardId,
  ]);

  useEffect(() => {
    const reviewId = room?.match?.play?.trickReviewId;
    if (
      room?.match?.phase !== "playing" ||
      room.match.play?.currentTrick.length !== 4 ||
      !reviewId ||
      acknowledgedTrickReviewIds.current.has(reviewId)
    ) {
      return;
    }

    acknowledgedTrickReviewIds.current.add(reviewId);
    void gameClient.acknowledgeTrickReview(reviewId).catch(() => {
      acknowledgedTrickReviewIds.current.delete(reviewId);
    });
  }, [
    room?.match?.phase,
    room?.match?.play?.currentTrick.length,
    room?.match?.play?.trickReviewId,
  ]);

  const toggleReady = async () => {
    if (!room) return;
    try {
      await gameClient.setReady(!ready);
    } catch {
      // The connection indicator communicates transient server failures.
    }
  };

  const changeSeat = async (position: Position) => {
    if (!room || room.match || seatChangePending) return;
    setSeatChangePending(position);
    setActionError("");
    try {
      await gameClient.changeSeat(position);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to change seats.",
      );
    } finally {
      setSeatChangePending(null);
    }
  };

  const toggleBots = async () => {
    try {
      if (hasBots) {
        await gameClient.removeBots();
      } else {
        await gameClient.fillWithBots();
      }
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to manage bots.",
      );
    }
  };

  const placeBid = async () => {
    try {
      await gameClient.placeBid(bidAmount);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to place that bid.",
      );
    }
  };

  const passBid = async () => {
    try {
      await gameClient.passBid();
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to pass.",
      );
    }
  };

  const toggleDiscard = (cardId: string) => {
    setSelectedDiscardIds((selected) =>
      selected.includes(cardId)
        ? selected.filter((id) => id !== cardId)
        : selected.length < 4
          ? [...selected, cardId]
          : selected,
    );
    setActionError("");
  };

  const completeGround = async () => {
    try {
      await gameClient.completeGround(selectedDiscardIds);
      setSelectedDiscardIds([]);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to complete the ground phase.",
      );
    }
  };

  const selectOrPlayCard = async (cardId: string) => {
    if (playPending) return;
    if (selectedPlayCardId !== cardId) {
      setSelectedPlayCardId(cardId);
      setActionError("");
      return;
    }

    setPlayPending(true);
    try {
      await gameClient.playCard(cardId);
      setSelectedPlayCardId(null);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to play that card.",
      );
    } finally {
      setPlayPending(false);
    }
  };

  const toggleNextHandReady = async () => {
    if (!room?.match) return;
    const isReady = room.match.nextHandReadyPlayerIds.includes(playerId);
    try {
      await gameClient.setNextHandReady(!isReady);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update your readiness.",
      );
    }
  };

  return {
    actionError,
    setActionError,
    bidAmount,
    setBidAmount,
    selectedDiscardIds,
    selectedPlayCardId,
    seatChangePending,
    ready,
    currentPlayer,
    viewerTeam,
    hasBots,
    isGroundWinner,
    selectedDiscardCards,
    toggleReady,
    changeSeat,
    toggleBots,
    placeBid,
    passBid,
    toggleDiscard,
    completeGround,
    selectOrPlayCard,
    toggleNextHandReady,
  };
}
