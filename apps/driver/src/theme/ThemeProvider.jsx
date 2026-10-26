import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'andertrack_ui_theme';
function readTheme() {
  try { return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
// Run before the first render so saved light mode does not flash a dark canvas.
document.documentElement.dataset.theme = readTheme();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Private browsing can block storage. */ }
  }, [theme]);
  useEffect(() => {
    const sync = event => { if (event.key === STORAGE_KEY || event.key === null) setTheme(readTheme()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>
    {children}
    <button className="brand-theme-toggle" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  </ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  return context;
}
