export type User = {
  id: string;
  username: string;
  name: string;
};

export type MatchRecord = {
  team: "one" | "two";
  seat: string;
  name: string;
  isBot: boolean;
  winningTeam: "one" | "two";
  scoreOne: number;
  scoreTwo: number;
  createdAt: string;
};

export type Stats = {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  matches: MatchRecord[];
};

export type Config = {
  googleClientId: string | null;
};

type ApiError = {
  error?: string;
  message?: string;
};

const api = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options?.headers,
    },
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => ({}))) as ApiError;
  if (!response.ok) {
    throw new Error(body.message ?? "Something went wrong.");
  }
  return body as T;
};

export const fetchCurrentUser = () => api<{ user: User | null }>("/api/me");

export const register = (input: {
  name: string;
  username: string;
  password: string;
}) =>
  api<{ user: { id: string } }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const login = (input: { username: string; password: string }) =>
  api<{ user: { id: string } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const logout = () =>
  api<{ ok: true }>("/api/auth/logout", { method: "POST" });

export const fetchConfig = () => api<Config>("/api/config");

export const googleLogin = (credential: string) =>
  api<{ user: { id: string } }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

export const fetchStats = () => api<Stats>("/api/me/matches");

export const claimGuestGames = (playerId: string) =>
  api<{ claimed: number }>("/api/claim", {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
