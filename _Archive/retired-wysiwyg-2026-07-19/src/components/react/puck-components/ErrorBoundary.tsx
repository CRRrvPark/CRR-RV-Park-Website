/**
 * ErrorBoundary — wraps each Puck section component render.
 *
 * If a section throws during render (bad JSON, missing prop, etc.) the
 * user sees a friendly admin-styled message with a Retry button instead
 * of a white screen that takes out the whole builder.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[Builder] Error in ${this.props.componentName || 'component'}:`,
      error,
      info.componentStack,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2rem',
            margin: '1rem',
            background: 'var(--c-danger-bg, #fef2f2)',
            border: '1px solid var(--c-danger, #dc2626)',
            borderRadius: 'var(--r-md, 6px)',
            textAlign: 'center',
            fontFamily: 'var(--sans, system-ui, sans-serif)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--fs-sm, 0.875rem)',
              color: 'var(--c-danger, #dc2626)',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            This section encountered an error
          </div>
          {this.props.componentName && (
            <div
              style={{
                fontSize: 'var(--fs-xs, 0.75rem)',
                color: 'var(--c-muted, #888)',
                marginBottom: '0.75rem',
              }}
            >
              Component: {this.props.componentName}
            </div>
          )}
          {this.state.error && (
            <pre
              style={{
                fontSize: 'var(--fs-xs, 0.75rem)',
                color: 'var(--c-muted, #888)',
                background: 'rgba(0,0,0,.04)',
                padding: '0.5rem',
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 80,
                textAlign: 'left',
                marginBottom: '0.75rem',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleRetry}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 'var(--fs-xs, 0.75rem)' }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
