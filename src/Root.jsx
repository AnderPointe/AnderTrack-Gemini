import React, { lazy, Suspense, useState } from 'react';
import './live.css';
import './features/entry/entry-theme.css';

const DemoApp = lazy(() => import('./App.jsx'));
const LiveWorkspace = lazy(() => import('./features/live/LiveWorkspace.jsx'));
const PublicWebsite = lazy(() => import('./features/entry/PublicWebsite.jsx'));
const CommandConcept = lazy(() => import('./features/entry/CommandConcept.jsx'));

export default function Root() {
  const [mode, setMode] = useState('live');
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const surface = import.meta.env.VITE_APP_SURFACE;
  const website = path === '/website' || (path === '/' && surface === 'website');
  const driver = path === '/driver' || (path === '/' && surface === 'driver');
  return <Suspense fallback={<div className="at-entry-loading" role="status">Loading AnderTrack…</div>}>
    {path === '/concept' ? <CommandConcept/> : mode === 'demo'
    ? <DemoApp onReturn={() => setMode('live')} />
    : website
      ? <PublicWebsite onDemo={() => setMode('demo')} />
      : <LiveWorkspace driver={driver} onDemo={() => setMode('demo')} />}
  </Suspense>;
}
