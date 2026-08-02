import { FormEvent, useState } from "react";

type Flow = "create" | "join";
type Screen = "home" | "setup" | "lobby";

const createRoomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
};

function Logo() {
  return (
    <div className="logo" aria-label="Shelem">
      <span>ش</span>
      <strong>SHELEM</strong>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [flow, setFlow] = useState<Flow>("create");
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const begin = (nextFlow: Flow) => {
    setFlow(nextFlow);
    setScreen("setup");
  };

  const enterLobby = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanCode = roomInput.trim().toUpperCase();

    if (!cleanName || (flow === "join" && cleanCode.length !== 6)) return;

    setName(cleanName);
    setRoomCode(flow === "create" ? createRoomCode() : cleanCode);
    setScreen("lobby");
  };

  const copyInvite = async () => {
    const invite = `${window.location.origin}?room=${roomCode}`;
    await navigator.clipboard?.writeText(invite);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (screen === "lobby") {
    return (
      <main className="lobby-shell">
        <header className="lobby-header">
          <Logo />
          <div className="room-actions">
            <span className="room-label">Private room</span>
            <button className="code-button" onClick={copyInvite} type="button">
              <span>{roomCode}</span>
              <CopyIcon />
            </button>
            <button
              className="leave-button"
              onClick={() => setScreen("home")}
              type="button"
            >
              Leave
            </button>
          </div>
        </header>

        <section className="lobby-content">
          <div className="lobby-title">
            <p className="eyebrow">Your private table</p>
            <h1>Gather your players</h1>
            <p>Share the room code. The game begins when all four are ready.</p>
          </div>

          <div className="table-wrap">
            <span className="team-tag team-one">Team One</span>
            <span className="team-tag team-two">Team Two</span>

            <Seat position="north" team="one" />
            <Seat position="west" team="two" />
            <Seat position="east" team="two" />
            <Seat position="south" team="one" name={name} ready={ready} />

            <div className="card-table">
              <div className="table-line" />
              <div className="deck" aria-hidden="true">
                <span />
                <span />
                <span>ش</span>
              </div>
              <strong>Waiting for 3 players</strong>
              <small>Invite friends using code {roomCode}</small>
            </div>
          </div>

          <div className="lobby-footer">
            <div className="connection-note">
              <span className="status-dot" />
              Camera and microphone connect when the game starts
            </div>
            <button
              className={`ready-button ${ready ? "is-ready" : ""}`}
              onClick={() => setReady((value) => !value)}
              type="button"
            >
              {ready ? "Ready ✓" : "I’m ready"}
            </button>
          </div>
        </section>

        {copied && <div className="toast">Invite link copied</div>}
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="home-nav">
        <Logo />
        <span>Private games with friends</span>
      </nav>

      {screen === "home" ? (
        <section className="welcome">
          <div className="suit-row" aria-hidden="true">
            <span>♣</span>
            <span>♦</span>
            <span>♥</span>
            <span>♠</span>
          </div>
          <p className="eyebrow">The table is waiting</p>
          <h1>Shelem, together again.</h1>
          <p className="intro">
            A private table for four friends—with the cards, conversation, and
            friendly competition all in one place.
          </p>

          <div className="actions">
            <button
              className="primary"
              onClick={() => begin("create")}
              type="button"
            >
              Create a table
              <ArrowIcon />
            </button>
            <button
              className="secondary"
              onClick={() => begin("join")}
              type="button"
            >
              Join with a code
            </button>
          </div>

          <div className="features">
            <span>
              <VideoIcon /> Live video
            </span>
            <span>
              <LockIcon /> Private rooms
            </span>
            <span>
              <UsersIcon /> Four players
            </span>
          </div>
        </section>
      ) : (
        <section className="setup-card">
          <button
            className="back-button"
            onClick={() => setScreen("home")}
            type="button"
            aria-label="Back"
          >
            ←
          </button>
          <p className="eyebrow">
            {flow === "create" ? "Create a private table" : "Join your friends"}
          </p>
          <h1>{flow === "create" ? "Take your seat." : "Welcome to the table."}</h1>
          <p className="setup-copy">
            {flow === "create"
              ? "We’ll create a room code for you to share."
              : "Enter the six-character code shared by the host."}
          </p>

          <form onSubmit={enterLobby}>
            <label>
              Your name
              <input
                autoFocus
                maxLength={24}
                onChange={(event) => setName(event.target.value)}
                placeholder="How friends know you"
                value={name}
              />
            </label>

            {flow === "join" && (
              <label>
                Room code
                <input
                  className="room-input"
                  maxLength={6}
                  onChange={(event) =>
                    setRoomInput(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  placeholder="ABC123"
                  value={roomInput}
                />
              </label>
            )}

            <button
              className="primary form-submit"
              disabled={
                !name.trim() ||
                (flow === "join" && roomInput.trim().length !== 6)
              }
              type="submit"
            >
              {flow === "create" ? "Create table" : "Join table"}
              <ArrowIcon />
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function Seat({
  position,
  team,
  name,
  ready,
}: {
  position: "north" | "south" | "east" | "west";
  team: "one" | "two";
  name?: string;
  ready?: boolean;
}) {
  return (
    <div className={`seat seat-${position}`}>
      <div className={`avatar team-${team}`}>
        {name ? name.slice(0, 1).toUpperCase() : <UsersIcon />}
        {ready && <span className="ready-check">✓</span>}
      </div>
      <strong>{name || "Open seat"}</strong>
      <small>{name ? (ready ? "Ready" : "Not ready") : "Waiting…"}</small>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
