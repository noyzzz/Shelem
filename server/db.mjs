import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scryptAsync = promisify(scrypt);

const connectionString = process.env.DATABASE_URL ?? null;
export const dbEnabled = Boolean(connectionString);

const pool = dbEnabled ? new Pool({ connectionString }) : null;

export const SESSION_COOKIE = "shelem_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const scryptOptions = { N: 16384, r: 8, p: 1 };

export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const initDb = async () => {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      winning_team TEXT NOT NULL,
      score_one INT NOT NULL,
      score_two INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS match_players (
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      position TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      guest_id TEXT,
      player_name TEXT NOT NULL,
      team TEXT NOT NULL,
      is_bot BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (match_id, position)
    );
  `);
  return true;
};

const tokenHashOf = (token) =>
  createHash("sha256").update(token).digest("hex");

const scryptNode = (value, salt, length) =>
  scryptAsync(value, salt, length, scryptOptions);

const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const derived = await scryptNode(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
};

const verifyPassword = async (password, stored) => {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptNode(password, salt, expected.length);
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
};

const cleanUsername = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 32);

export const publicUser = ({ id, username, name }) => ({
  id,
  username,
  name,
});

export const createSessionToken = () => randomBytes(32).toString("base64url");

export const registerUser = async ({ name, username, password }) => {
  if (!pool) throw new AuthError("no-database", "Accounts are not enabled.");
  const clean = cleanUsername(username);
  const displayName = String(name ?? "").trim().slice(0, 24);
  if (!clean || !displayName || clean.length < 3) {
    throw new AuthError("invalid-username", "Choose a username of 3+ characters.");
  }
  if (!password || password.length < 8) {
    throw new AuthError(
      "invalid-password",
      "Password must be at least 8 characters.",
    );
  }
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await pool.query(
      `INSERT INTO users (id, username, name, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [id, clean, displayName, passwordHash],
    );
  } catch (error) {
    if (error.code === "23505") {
      throw new AuthError("username-taken", "That username is already taken.");
    }
    throw error;
  }
  return createSessionForUser(id);
};

export const loginUser = async ({ username, password }) => {
  if (!pool) throw new AuthError("no-db", "Accounts are unavailable.");
  const clean = cleanUsername(username);
  const { rows } = await pool.query(
    `SELECT id, username, name, password_hash FROM users
     WHERE username = $1`,
    [clean],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new AuthError("invalid-credentials", "Incorrect username or password.");
  }
  return createSessionForUser(user.id);
};

const createSessionForUser = async (userId) => {
  const token = createSessionToken();
  const tokenHash = tokenHashOf(token);
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)`,
    [tokenHash, userId, String(SESSION_TTL_MS)],
  );
  return { token, userId };
};

export const userFromToken = async (token) => {
  if (!pool || !token) return null;
  const tokenHash = tokenHashOf(token);
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ? publicUser(rows[0]) : null;
};

export const destroySession = async (token) => {
  if (!pool || !token) return;
  const tokenHash = tokenHashOf(token);
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
};

export const persistMatch = async (room) => {
  if (!pool || room.matchPersisted) return;
  const { match, matchWinnerTeam, code, players } = room;
  if (!matchWinnerTeam) return;
  room.matchPersisted = true;

  const matchId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO matches (id, room_code, winning_team, score_one, score_two)
       VALUES ($1, $2, $3, $4, $5)`,
      [matchId, code, matchWinnerTeam, room.score.one, room.score.two],
    );
    for (const player of players.values()) {
      const team = teamForSeat(player.position);
      await client.query(
        `INSERT INTO match_players
           (match_id, position, user_id, guest_id, player_name, team, is_bot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          matchId,
          player.position,
          player.userId ?? null,
          player.userId ? null : player.id,
          player.name,
          team,
          Boolean(player.isBot),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to persist match:", error);
  } finally {
    client.release();
  }
};

export const claimGuestMatches = async (userId, playerId) => {
  if (!pool) return 0;
  const result = await pool.query(
    `UPDATE match_players SET user_id = $1, guest_id = NULL
     WHERE guest_id = $2 AND user_id IS NULL`,
    [userId, playerId],
  );
  return result.rowCount;
};

export const listUserMatches = async (userId) => {
  if (!pool) return { games: 0, wins: 0, scores: [] };
  const { rows } = await pool.query(
    `SELECT mp.team, mp.position, mp.player_name, mp.is_bot,
            m.winning_team, m.score_one, m.score_two, m.created_at
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = $1
     ORDER BY m.created_at DESC`,
    [userId],
  );
  const games = rows.length;
  const wins = rows.filter((row) => row.team === row.winning_team).length;
  return {
    games,
    wins,
    losses: games - wins,
    winRate: games ? Math.round((wins / games) * 100) : 0,
    matches: rows.map((row) => ({
      team: row.team,
      seat: row.position,
      name: row.player_name,
      isBot: row.is_bot,
      winningTeam: row.winning_team,
      scoreOne: row.score_one,
      scoreTwo: row.score_two,
      createdAt: row.created_at,
    })),
  };
};

const teamForSeat = (seat) =>
  seat === "north" || seat === "south" ? "one" : "two";