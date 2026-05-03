import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles/globals.css';
import { setEntityIdGetter } from './lib/api';
import { useEntityStore } from './lib/entityStore';

// Wire entity scope into API client for X-Entity-Id header
setEntityIdGetter(() => useEntityStore.getState().selectedEntityId || null);

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
