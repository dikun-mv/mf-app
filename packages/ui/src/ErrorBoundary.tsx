import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryFallbackProps {
  error: unknown;
  /** Clears the error so the children render again. */
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (props: ErrorBoundaryFallbackProps) => ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
  readonly error: unknown;
}

const ok: ErrorBoundaryState = { failed: false, error: null };

/**
 * Catches render and lifecycle errors below it and shows `fallback` in their place. It keeps no
 * React context, so copies at different versions on one page can't interfere (plan §3, Shared UI).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state = ok;

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly reset = (): void => {
    this.setState(ok);
  };

  override render(): ReactNode {
    return this.state.failed
      ? this.props.fallback({ error: this.state.error, reset: this.reset })
      : this.props.children;
  }
}
