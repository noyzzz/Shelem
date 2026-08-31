import type { FormEvent } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type SetupScreenProps = {
  connectionStatus: string;
  error: string;
  flow: "create" | "join";
  name: string;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onRoomCodeChange: (code: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  roomCode: string;
};

export function SetupScreen({
  connectionStatus,
  error,
  flow,
  name,
  onBack,
  onNameChange,
  onRoomCodeChange,
  onSubmit,
  roomCode,
}: SetupScreenProps) {
  return (
    <Card className="relative z-10 w-full max-w-lg shadow-2xl border-border bg-card animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <CardTitle>{flow === "create" ? "Take your seat." : "Join a table."}</CardTitle>
        <CardDescription>
          {flow === "create"
            ? "We’ll create a room code for you to share."
            : "Enter the six-character code shared by the host."}
        </CardDescription>
        <CardAction>
          <Button aria-label="Back" onClick={onBack} size="icon" type="button" variant="ghost">
            <ArrowLeftIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form id="setup-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="player-name">Your name</FieldLabel>
              <Input
                id="player-name"
                autoComplete="name"
                autoFocus
                maxLength={24}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="How friends know you"
                value={name}
              />
            </Field>
            {flow === "join" && (
              <Field>
                <FieldLabel htmlFor="room-code">Room code</FieldLabel>
                <Input
                  id="room-code"
                  autoCapitalize="characters"
                  maxLength={6}
                  onChange={(event) => onRoomCodeChange(event.target.value)}
                  placeholder="ABC123"
                  value={roomCode}
                />
              </Field>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          disabled={
            connectionStatus !== "connected" ||
            !name.trim() ||
            (flow === "join" && roomCode.trim().length !== 6)
          }
          form="setup-form"
          size="lg"
          type="submit"
        >
          {flow === "create" ? "Create table" : "Join table"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
