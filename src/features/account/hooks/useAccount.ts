import {
  claimGuestGames,
  fetchConfig,
  fetchCurrentUser,
  fetchStats,
  googleLogin,
  login,
  logout,
  register,
  type Stats,
  type User,
} from "@/features/account/api/authClient";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { googleScriptLoader } from "../api/googleIdentity";

type Mode = "menu" | "login" | "register";

export function useAccount(playerId: string) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [formError, setFormError] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const googleHostRef = useRef<HTMLDivElement | null>(null);
  const [hostReady, setHostReady] = useState(false);
  const setGoogleHost = useCallback((node: HTMLDivElement | null) => {
    googleHostRef.current = node;
    setHostReady(Boolean(node));
  }, []);
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
  });

  const refreshUser = useCallback(async () => {
    try {
      const { user: nextUser } = await fetchCurrentUser();
      setUser(nextUser);
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
    }
  }, []);

  const handleGoogleResponse = async (credential: string) => {
    setFormError("");
    try {
      await googleLogin(credential);
      await refreshUser();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
    }
  };

  const onCredentialRef = useRef(handleGoogleResponse);
  onCredentialRef.current = handleGoogleResponse;

  const showGoogle =
    open && !user && mode === "menu" && Boolean(googleClientId) && hostReady;

  useEffect(() => {
    if (!showGoogle || !googleClientId) return;
    let disposed = false;
    googleScriptLoader()
      .then(() => {
        if (disposed || !window.google || !googleHostRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) =>
            void onCredentialRef.current(response.credential),
        });
        googleHostRef.current.replaceChildren();
        window.google.accounts.id.renderButton(googleHostRef.current, {
          theme: "outline",
          size: "medium",
          shape: "rectangular",
          width: 280,
          text: "continue_with",
        });
      })
      .catch(() => {
        // Google sign-in is unavailable; the panel still works without it.
      });
    return () => {
      disposed = true;
    };
  }, [showGoogle, googleClientId]);

  useEffect(() => {
    if (showGoogle) return;
    window.google?.accounts?.id?.cancel?.();
    googleHostRef.current?.replaceChildren();
  }, [showGoogle]);

  useEffect(() => {
    void refreshUser();
    void fetchConfig()
      .then(({ googleClientId: clientId }) => setGoogleClientId(clientId))
      .catch(() => setGoogleClientId(null));
  }, [refreshUser]);

  useEffect(() => {
    if (open) void refreshUser();
  }, [open, refreshUser]);

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
      setFormError(
        error instanceof Error ? error.message : "Unable to continue.",
      );
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setStats(null);
      setMode("menu");
      setClaimed(false);
    }
  };

  const handleClaim = async () => {
    try {
      const { claimed: count } = await claimGuestGames(playerId);
      setClaimed(true);
      const nextStats = await fetchStats();
      setStats(nextStats);
      if (count === 0) setClaimed(false);
    } catch {
      setFormError("Nothing to claim right now.");
    }
  };

  return {
    open,
    setOpen,
    mode,
    setMode,
    user,
    stats,
    formError,
    setFormError,
    claimed,
    googleClientId,
    setGoogleHost,
    form,
    setField,
    handleSubmit,
    handleLogout,
    handleClaim,
  };
}

export type AccountState = ReturnType<typeof useAccount>;
