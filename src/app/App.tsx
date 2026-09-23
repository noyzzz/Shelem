import { AccountPanel } from "@/features/account/components/AccountPanel";
import { useAccount } from "@/features/account/hooks/useAccount";
import { useRoomSession } from "@/features/game/hooks/useRoomSession";
import { GameRoomScreen } from "@/screens/GameRoomScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { SetupScreen } from "@/screens/SetupScreen";
import { useEffect, useState, type FormEvent } from "react";
import { MenuLayout } from "./MenuLayout";
import {
  cleanRoomCode,
  getInviteCode,
  setRoomPath,
  type Flow,
  type Screen,
} from "./navigation";

export function App() {
  const [inviteCode] = useState(getInviteCode);
  const session = useRoomSession(inviteCode);
  const account = useAccount(session.playerId);
  const [screen, setScreen] = useState<Screen>(
    inviteCode.length === 6 ? "setup" : "home",
  );
  const [flow, setFlow] = useState<Flow>(
    inviteCode.length === 6 ? "join" : "create",
  );
  const [name, setName] = useState(session.rememberedName);
  const [roomInput, setRoomInput] = useState(inviteCode);
  const [formError, setFormError] = useState("");
  const { room, playerId, sessionError } = session;
  const { setOpen: setAccountOpen } = account;

  useEffect(() => {
    setAccountOpen(false);
  }, [screen, setAccountOpen]);

  useEffect(() => {
    const accountName = account.user?.name;
    if (accountName)
      setName((current) => (current.trim() ? current : accountName));
  }, [account.user]);

  useEffect(() => {
    if (room?.players.some((player) => player.id === playerId)) {
      setRoomPath(room.code);
      setScreen("lobby");
    }
  }, [room, playerId]);

  useEffect(() => {
    if (!sessionError) return;
    setFormError(sessionError);
    setScreen("setup");
  }, [sessionError]);

  const begin = (nextFlow: Flow) => {
    setFlow(nextFlow);
    setFormError("");
    setScreen("setup");
  };

  const enterLobby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const code = cleanRoomCode(roomInput);
    if (!cleanName || (flow === "join" && code.length !== 6)) return;
    try {
      const nextRoom = await session.enterRoom(flow, cleanName, code);
      if (!nextRoom) return;
      setName(cleanName);
      setFormError("");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to join the room.",
      );
    }
  };

  const leaveRoom = async () => {
    await session.leaveRoom();
    setRoomPath();
    setScreen("home");
  };

  if (screen === "lobby" && room) {
    return (
      <GameRoomScreen
        key={room.code}
        room={room}
        playerId={playerId}
        playerName={name}
        connectionStatus={session.connectionStatus}
        onLeave={leaveRoom}
        requestMediaCredentials={session.requestMediaCredentials}
      />
    );
  }

  return (
    <MenuLayout
      home={screen === "home"}
      playerName={account.user?.name || name || "Guest"}
      account={<AccountPanel blend account={account} />}
    >
      {screen === "home" ? (
        <HomeScreen onBegin={begin} />
      ) : (
        <SetupScreen
          connectionStatus={session.connectionStatus}
          error={formError}
          flow={flow}
          name={name}
          onBack={() => {
            setFormError("");
            setRoomPath();
            setScreen("home");
          }}
          onNameChange={(nextName) => {
            setName(nextName);
            setFormError("");
          }}
          onRoomCodeChange={(code) => {
            setRoomInput(cleanRoomCode(code));
            setFormError("");
          }}
          onSubmit={enterLobby}
          roomCode={roomInput}
        />
      )}
    </MenuLayout>
  );
}
