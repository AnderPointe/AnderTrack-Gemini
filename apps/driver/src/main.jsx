import React, { lazy, Suspense } from 'react';
import {createRoot} from 'react-dom/client';
const App = lazy(() => import('./App.jsx'));
import './styles.css';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import './brand-rich.css';
const UniversalDriver = lazy(() => import('./universal/UniversalDriver.jsx'));

const driverPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isUniversal = driverPath !== '/legacy';
createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider><Suspense fallback={<p role="status">Loading AnderTrack…</p>}>{isUniversal ? <UniversalDriver/> : <App/>}</Suspense></ThemeProvider></React.StrictMode>);

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js').catch(()=>{/* install support is optional */});
  });
}
