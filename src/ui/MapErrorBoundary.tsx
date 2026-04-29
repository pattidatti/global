import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MapErrorBoundary] Kart krasjet:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const label = this.props.label ?? 'Kartet';
    const message = this.state.error.message || 'Ukjent feil';

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-bg/95 p-6">
        <div className="parchment border border-panelEdge/70 rounded-paper shadow-paperLg p-6 max-w-md text-center">
          <h2 className="font-serif text-ink text-xl mb-2">{label} kunne ikke lastes</h2>
          <p className="text-sm text-textLo mb-4 font-mono break-words">{message}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 rounded-paper border border-panelEdge/70 bg-panel text-textHi hover:bg-accent/20 transition-colors"
          >
            Last siden på nytt
          </button>
        </div>
      </div>
    );
  }
}
