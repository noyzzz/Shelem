import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { XIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
} from "./authClient";
import { gameClient } from "./gameClient";
import { cn } from "@/lib/utils";

type Mode = "menu" | "login" | "register";

const googleScriptLoader = (() => {
  let promise: Promise<void> | null = null;
  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const element = document.createElement("script");
        element.src = "https://accounts.google.com/gsi/client";
        element.async = true;
        element.onload = () => resolve();
        element.onerror = () => reject(new Error("Unable to load Google sign-in."));
        document.head.appendChild(element);
      });
    }
    return promise;
  };
})();

export function AccountPanel({
  onUserChange,
}: {
  onUserChange: (user: User | null) => void;
}) {
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
    open &&
    !user &&
    mode === "menu" &&
    Boolean(googleClientId) &&
    hostReady;

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

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          "bg-card/80 backdrop-blur-md cursor-pointer",
        )}
      >
        {user ? user.name : "Sign in"}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(320px,calc(100vw-40px))] p-4 shadow-2xl bg-card border-border backdrop-blur-md" sideOffset={10}>
        <PopoverHeader className="flex flex-row items-center justify-between pb-2 mb-2 border-b border-border/50">
          <PopoverTitle className="text-sm font-semibold">{user ? user.name : "Accounts"}</PopoverTitle>
          <Button
            aria-label="Close account panel"
            onClick={() => setOpen(false)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </PopoverHeader>

        {user ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-left text-xs text-muted-foreground">
              Playing as <strong className="text-foreground">{user.username}</strong>
            </p>
            {stats && (
              <dl className="m-0 grid grid-cols-4 gap-1.5 text-center">
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">Games</dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">{stats.games}</dd>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">Wins</dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">{stats.wins}</dd>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">Losses</dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">{stats.losses}</dd>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">Win %</dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">{stats.winRate}%</dd>
                </div>
              </dl>
            )}
            <Button
              className="w-full"
              onClick={handleClaim}
              size="sm"
              type="button"
              variant="outline"
            >
              {claimed ? "Games linked" : "Claim games from this device"}
            </Button>
            <Button
              className="w-full"
              onClick={handleLogout}
              size="sm"
              type="button"
              variant="destructive"
            >
              Sign out
            </Button>
          </div>
        ) : (
          <>
            {mode === "menu" && (
              <div className="flex flex-col gap-2">
                {googleClientId && (
                  <div className="flex flex-col gap-2.5">
                    <div ref={setGoogleHost} className="flex min-h-10 items-center justify-center" />
                    <FieldSeparator>or</FieldSeparator>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => setMode("login")}
                  type="button"
                >
                  Sign in
                </Button>
                <Button
                  className="w-full"
                  onClick={() => setMode("register")}
                  type="button"
                  variant="outline"
                >
                  Create an account
                </Button>
              </div>
            )}

            {(mode === "login" || mode === "register") && (
              <form className="w-full" onSubmit={handleSubmit}>
                <FieldGroup>
                  {mode === "register" && (
                    <Field>
                      <FieldLabel htmlFor="account-display-name">Display name</FieldLabel>
                      <Input
                        id="account-display-name"
                        autoComplete="name"
                        maxLength={24}
                        onChange={(event) => setField("name")(event.target.value)}
                        placeholder="How friends know you"
                        value={form.name}
                      />
                    </Field>
                  )}
                  <Field>
                    <FieldLabel htmlFor="account-username">Username</FieldLabel>
                    <Input
                      id="account-username"
                      autoComplete="username"
                      maxLength={32}
                      onChange={(event) =>
                        setField("username")(event.target.value)
                      }
                      placeholder="yourname"
                      value={form.username}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-password">Password</FieldLabel>
                    <Input
                      id="account-password"
                      autoComplete={
                        mode === "register" ? "new-password" : "current-password"
                      }
                      minLength={8}
                      onChange={(event) =>
                        setField("password")(event.target.value)
                      }
                      placeholder="At least 8 characters"
                      type="password"
                      value={form.password}
                    />
                  </Field>
                  <Button className="w-full" type="submit">
                    {mode === "register" ? "Create account" : "Sign in"}
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setMode(mode === "login" ? "register" : "login");
                      setFormError("");
                    }}
                    type="button"
                    variant="link"
                  >
                    {mode === "login"
                      ? "Need an account? Create one"
                      : "Already have an account? Sign in"}
                  </Button>
                </FieldGroup>
              </form>
            )}

            {formError && (
              <Alert className="mt-2" variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
