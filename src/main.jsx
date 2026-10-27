import React from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root.jsx';
import { ThemeProvider } from '../apps/driver/src/theme/ThemeProvider.jsx';
import './styles.css';
import '../apps/driver/src/brand-rich.css';
import './website-brand.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider><Root /></ThemeProvider></React.StrictMode>);
