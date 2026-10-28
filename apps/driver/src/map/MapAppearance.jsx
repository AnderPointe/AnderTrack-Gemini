import React,{useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {MAP_APPEARANCE_KEY,MAP_APPEARANCE_EVENT,normalizeMapMode,readMapMode,saveMapMode} from './map-appearance.js';
import './map-appearance.css';
function storage(){try{return window.localStorage;}catch{return null;}}
export function useMapAppearance(){
 const [mode,setMode]=useState(()=>readMapMode(storage()));
 useEffect(()=>{const local=event=>setMode(normalizeMapMode(event.detail));const remote=event=>{if(event.key===MAP_APPEARANCE_KEY||event.key===null)setMode(readMapMode(storage()));};window.addEventListener(MAP_APPEARANCE_EVENT,local);window.addEventListener('storage',remote);return()=>{window.removeEventListener(MAP_APPEARANCE_EVENT,local);window.removeEventListener('storage',remote);};},[]);
 function toggle(){const next=mode==='blackout'?'standard':'blackout';saveMapMode(storage(),next);setMode(next);window.dispatchEvent(new CustomEvent(MAP_APPEARANCE_EVENT,{detail:next}));}
 return {mode,toggle};
}
export function MapAppearanceToggle({mode,onToggle}){return <button type="button" className="at-map-appearance-toggle" aria-label="Blackout map mode" aria-pressed={mode==='blackout'} onClick={onToggle} title={mode==='blackout'?'Show standard map colors':'Darken the map only'}>{mode==='blackout'?<Sun size={15} aria-hidden="true"/>:<Moon size={15} aria-hidden="true"/>}<span>Blackout <b>{mode==='blackout'?'On':'Off'}</b></span></button>;}
