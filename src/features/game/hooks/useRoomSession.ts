import type { Room } from "@/domain/types";
import { useEffect, useState } from "react";
import { gameClient, type ConnectionStatus } from "../api/gameClient";

export function useRoomSession(inviteCode: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    gameClient.connect(inviteCode || undefined);
    const unsubscribeRoom = gameClient.subscribeToRoom((nextRoom) => {
      setRoom(nextRoom);
      setSessionError(
        nextRoom ? "" : "That room has expired. Create or join another table.",
      );
    });
    const unsubscribeStatus = gameClient.subscribeToStatus(setConnectionStatus);
    return () => {
      unsubscribeRoom();
      unsubscribeStatus();
    };
  }, [inviteCode]);

  const enterRoom = async (
    flow: "create" | "join",
    name: string,
    code: string,
  ) => {
    const nextRoom =
      flow === "join"
        ? await gameClient.joinRoom(code, name)
        : await gameClient.createRoom(name);
    if (nextRoom) {
      setRoom(nextRoom);
      setSessionError("");
    }
    return nextRoom;
  };

  const leaveRoom = async () => {
    try {
      await gameClient.leaveRoom();
    } catch {
      // The player can return home even when the connection is unavailable.
    }
    setRoom(null);
    setSessionError("");
  };

  return {
    room,
    connectionStatus,
    sessionError,
    enterRoom,
    leaveRoom,
    playerId: gameClient.playerId,
    rememberedName: gameClient.rememberedName,
    requestMediaCredentials,
  };
}

const requestMediaCredentials = () => gameClient.requestMediaToken();
