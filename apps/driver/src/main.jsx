import React, { lazy, Suspense } from 'react';
import {createRoot} from 'react-dom/client';
const App = lazy(() => import('./App.jsx'));
import './styles.css';
import './brand-rich.css';
const UniversalDriver = lazy(() => import('./universal/UniversalDriver.jsx'));

const isUniversal = window.location.pathname.replace(/\/+$/, '') === '/universal';
createRoot(document.getElementById('root')).render(<React.StrictMode><Suspense fallback={<p role="status">Loading AnderTrack…</p>}>{isUniversal ? <UniversalDriver/> : <App/>}</Suspense></React.StrictMode>);

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js').catch(()=>{/* install support is optional */});
  });
}
