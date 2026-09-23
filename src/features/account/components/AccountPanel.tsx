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
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AccountState } from "../hooks/useAccount";

export function AccountPanel({
  blend = false,
  account,
}: {
  blend?: boolean;
  account: AccountState;
}) {
  const {
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
  } = account;
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          buttonVariants({
            size: "sm",
            variant: blend ? "ghost" : "outline",
          }),
          !blend && "bg-card/80 backdrop-blur-md",
          blend &&
            "border border-white/12 bg-black/40 text-foreground/90 shadow-sm backdrop-blur-md hover:border-primary/40 hover:bg-black/60 hover:text-foreground hover:shadow-[0_0_12px_rgba(229,197,122,0.1)]",
          "cursor-pointer transition-all",
        )}
      >
        {user ? user.name : "Sign in"}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(320px,calc(100vw-40px))] p-4 shadow-2xl bg-card border-border backdrop-blur-md"
        sideOffset={10}
      >
        <PopoverHeader className="flex flex-row items-center justify-between pb-2 mb-2 border-b border-border/50">
          <PopoverTitle className="text-sm font-semibold">
            {user ? user.name : "Accounts"}
          </PopoverTitle>
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
              Playing as{" "}
              <strong className="text-foreground">{user.username}</strong>
            </p>
            {stats && (
              <dl className="m-0 grid grid-cols-4 gap-1.5 text-center">
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">
                    Games
                  </dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">
                    {stats.games}
                  </dd>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">
                    Wins
                  </dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">
                    {stats.wins}
                  </dd>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">
                    Losses
                  </dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">
                    {stats.losses}
                  </dd>
                </div>
                <div className="rounded-md border border-border/50 bg-muted/50 p-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">
                    Win %
                  </dt>
                  <dd className="m-0 mt-0.5 font-heading text-sm font-semibold tabular-nums text-foreground">
                    {stats.winRate}%
                  </dd>
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
                    <div
                      ref={setGoogleHost}
                      className="flex min-h-10 items-center justify-center"
                    />
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
                      <FieldLabel htmlFor="account-display-name">
                        Display name
                      </FieldLabel>
                      <Input
                        id="account-display-name"
                        autoComplete="name"
                        maxLength={24}
                        onChange={(event) =>
                          setField("name")(event.target.value)
                        }
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
                        mode === "register"
                          ? "new-password"
                          : "current-password"
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
