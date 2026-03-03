import { Component, type ReactNode } from "react";

export const OPEN_SETUP_WIZARD_EVENT = "opta:open-setup-wizard";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. Receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary that prevents uncaught render errors from
 * white-screening the entire app. Shows a recoverable error UI with a
 * "Try again" button that resets React's error state.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;

    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return (
        <div className="error-boundary">
          <div className="error-boundary__panel">
            <h2 className="error-boundary__title">
              Opta encountered a runtime error
            </h2>
            <p className="error-boundary__message">
              The UI crashed while rendering. If daemon state changed underneath
              the app, reopening setup usually restores a clean state.
            </p>
            <p className="error-boundary__detail">{error.message}</p>
            <div className="error-boundary__actions">
              <button className="error-boundary__reset" onClick={this.reset}>
                Try again
              </button>
              <button
                className="error-boundary__secondary"
                onClick={() => {
                  window.dispatchEvent(new Event(OPEN_SETUP_WIZARD_EVENT));
                  this.reset();
                }}
              >
                Open setup wizard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
