import { useEffect, useState, type FormEvent } from "react";
import {
  claimGuestGames,
  fetchCurrentUser,
  fetchStats,
  login,
  logout,
  register,
  type Stats,
  type User,
} from "./authClient";
import { gameClient } from "./gameClient";

type Mode = "menu" | "login" | "register";

export function AccountPanel({
  onUserChange,
}: {
  onUserChange: (user: User | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formError, setFormError] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
  });

  const refreshUser = async () => {
    try {
      const { user: nextUser } = await fetchCurrentUser();
      setUser(nextUser);
      onUserChange(nextUser);
      if (nextUser) {
        setMode("menu");
        const nextStats = await fetchStats();
        setStats(nextStats);
        setClaimed(false);
      } else {
        setStats(null);
      }
    } catch {
      setUser(null);
      onUserChange(null);
    }
  };

  useEffect(() => {
    void refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (field: string) => (value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    try {
      if (mode === "register") {
        await register(form);
      } else {
        await login(form);
      }
      await refreshUser();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to continue.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      onUserChange(null);
      setStats(null);
      setMode("menu");
      setClaimed(false);
    }
  };

  const handleClaim = async () => {
    try {
      const { claimed: count } = await claimGuestGames(gameClient.playerId);
      setClaimed(true);
      const nextStats = await fetchStats();
      setStats(nextStats);
      if (count === 0) setClaimed(false);
    } catch {
      setFormError("Nothing to claim right now.");
    }
  };

  if (!open) {
    return (
      <button
        className="account-button"
        onClick={() => setOpen(true)}
        type="button"
      >
        {user ? user.name : "Sign in"}
      </button>
    );
  }

  return (
    <div className="account-popover">
      <div className="account-popover-header">
        <strong>{user ? user.name : "Accounts"}</strong>
        <button
          className="account-close"
          onClick={() => setOpen(false)}
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {user ? (
        <div className="account-profile">
          <p className="account-subline">
            Playing as <strong>{user.username}</strong>
          </p>
          {stats && (
            <dl className="account-stats">
              <div>
                <dt>Games</dt>
                <dd>{stats.games}</dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd>{stats.wins}</dd>
              </div>
              <div>
                <dt>Losses</dt>
                <dd>{stats.losses}</dd>
              </div>
              <div>
                <dt>Win rate</dt>
                <dd>{stats.winRate}%</dd>
              </div>
            </dl>
          )}
          <button className="secondary account-claim" onClick={handleClaim} type="button">
            {claimed ? "Games linked" : "Claim games from this device"}
          </button>
          <button className="pass-button account-logout" onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      ) : (
        <>
          {mode === "menu" && (
            <div className="account-mode-buttons">
              <button
                className="primary"
                onClick={() => setMode("login")}
                type="button"
              >
                Sign in
              </button>
              <button
                className="secondary"
                onClick={() => setMode("register")}
                type="button"
              >
                Create an account
              </button>
            </div>
          )}

          {(mode === "login" || mode === "register") && (
            <form className="account-form" onSubmit={handleSubmit}>
              {mode === "register" && (
                <label>
                  Display name
                  <input
                    maxLength={24}
                    onChange={(event) => setField("name")(event.target.value)}
                    placeholder="How friends know you"
                    value={form.name}
                  />
                </label>
              )}
              <label>
                Username
                <input
                  autoComplete="username"
                  maxLength={32}
                  onChange={(event) => setField("username")(event.target.value)}
                  placeholder="yourname"
                  value={form.username}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={8}
                  onChange={(event) => setField("password")(event.target.value)}
                  placeholder="At least 8 characters"
                  type="password"
                  value={form.password}
                />
              </label>
              <button className="primary form-submit" type="submit">
                {mode === "register" ? "Create account" : "Sign in"}
              </button>
              <button
                className="account-switch"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setFormError("");
                }}
                type="button"
              >
                {mode === "login"
                  ? "Need an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </form>
          )}

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
        </>
      )}
    </div>
  );
}