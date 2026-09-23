import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Component, type ReactNode } from "react";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Application crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
          <Card className="w-full max-w-xl shadow-2xl">
            <CardHeader>
              <CardTitle>Something went wrong.</CardTitle>
              <CardDescription>
                Reload the page to continue. If this keeps happening, tell the
                host what you clicked just before it appeared.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details className="rounded-lg border border-border bg-muted/40 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Show details
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {String(this.state.error?.stack ?? this.state.error)}
                </pre>
              </details>
            </CardContent>
            <CardFooter>
              <Button onClick={() => window.location.reload()} type="button">
                Reload page
              </Button>
            </CardFooter>
          </Card>
        </main>
      );
    }
    return this.props.children;
  }
}
