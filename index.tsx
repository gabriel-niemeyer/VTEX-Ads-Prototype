
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          maxWidth: 900,
          backgroundColor: '#fff5f5',
          border: '2px solid #c00',
          margin: 16,
          borderRadius: 8,
        }}>
          <h2 style={{ color: '#c00', marginBottom: 16 }}>Erro ao renderizar</h2>
          <pre style={{ color: '#333', marginBottom: 12 }}>{this.state.error.message}</pre>
          <pre style={{ fontSize: 11, color: '#666', overflow: 'auto' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
