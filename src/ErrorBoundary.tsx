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
        <main className="shell">
          <div className="welcome">
            <h1>Something went wrong.</h1>
            <p className="intro">
              Reload the page to continue. If this keeps happening, tell the
              host what you clicked just before it appeared.
            </p>
            <details className="crash-details">
              <summary>Show details</summary>
              <pre>{String(this.state.error?.stack ?? this.state.error)}</pre>
            </details>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}