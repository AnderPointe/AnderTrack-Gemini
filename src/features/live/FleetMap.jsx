import {MapAppearanceToggle,useMapAppearance} from '../../../apps/driver/src/map/MapAppearance.jsx';
import { reconcileBeacons } from '../../lib/beacon-reconciler.js';
import { mapTextLabel } from '../../lib/map-label.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinned, ShieldAlert } from 'lucide-react';
import { validGpsPosition, freshGpsPosition } from '../../lib/operations.js';

// Keep all marker styling values hardcoded. Never interpolate untrusted GPS labels into HTML.
const STATUS_COLORS = {
  available: '#32d2c1',
  assigned: '#69b5ff',
  accepted: '#69b5ff',
  at_pickup: '#ff981b',
  picked_up: '#ff981b',
  in_transit: '#ff981b',
  loaded: '#ffba61',
  break: '#ff981b',
  offline: '#8292a5',
  alert: '#ff7979',
};
const DEFAULT_COLOR = '#32d2c1';

/**
 * Compatible with Phase 4 pilot usage (error/loading) and the current
 * Command Center usage (theme/onChoose/className).
 * Read-only map: GPS data must already be authorized by Supabase RLS.
 */
export default function FleetMap({
  locations = [],
  theme = 'dark',
  onChoose,
  className = '',
  error = '',
  loading = false,
  maxAgeMs = 300000,
  onRenderStats,
}) {
  const appearance=useMapAppearance();
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);
  const registryRef = useRef(new Map());
  const rendererRef = useRef(null);
  const denseRef = useRef(false);
  const statsRef = useRef(onRenderStats);
  statsRef.current = onRenderStats;
  const [clock,setClock] = useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState!=='hidden')setClock(Date.now());},5000);return()=>clearInterval(timer);},[]);
  const onChooseRef = useRef(onChoose);
  onChooseRef.current = onChoose;

  const points = useMemo(
    () => (Array.isArray(locations) ? locations : []).filter(validGpsPosition),
    [locations],
  );
  const stale = points.filter(point => !freshGpsPosition(point,Date.now(),maxAgeMs)).length;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return undefined;

    const map = L.map(hostRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      preferCanvas: true,
      zoomAnimation: false,
    }).setView([38.6, -96.6], 4);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      referrerPolicy: 'strict-origin',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 18,
      minZoom: 3,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    rendererRef.current = L.canvas({padding:0.3});
    const layer = L.featureGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
      : null;
    observer?.observe(hostRef.current);

    return () => {
      observer?.disconnect();
      registryRef.current.clear();
      layer.clearLayers();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return undefined;

    const started=performance.now();
    const dense=points.length>200;
    if(denseRef.current!==dense){for(const entry of registryRef.current.values())layer.removeLayer(entry.pin);registryRef.current.clear();denseRef.current=dense;}
    const colorFor=point=>STATUS_COLORS[point.status]||DEFAULT_COLOR;
    const iconFor=entry=>L.divIcon({className:'at-map-pin-wrap',html:'<span class="at-map-pin '+(entry.style.endsWith(':true')?'at-map-pin-live':'at-map-pin-idle')+'" style="--at-marker-color:'+colorFor(entry.point)+'"><span class="at-pin-core"></span></span>',iconSize:[35,35],iconAnchor:[17,17]});
    const popupFor=point=>{
      const popup=document.createElement('div');
      const heading=document.createElement('strong');
      heading.textContent = point.unit_number || point.vehicle_type || point.display_name || 'Vehicle';
      const details=document.createElement('div');
      const stamp=new Date(point.last_ping_at);
      details.textContent=String(point.status||'unknown').replaceAll('_',' ')+' · Last GPS update: '+(Number.isNaN(stamp.getTime())?'Unknown':stamp.toLocaleString());
      popup.append(heading,details);return popup;
    };
    const stats=reconcileBeacons(registryRef.current,points,{
      create(entry){
        const pin=dense?L.circleMarker([entry.latitude,entry.longitude],{renderer:rendererRef.current,radius:6,color:colorFor(entry.point),weight:2,fillColor:colorFor(entry.point),fillOpacity:entry.style.endsWith(':true')?0.9:0.3}):L.marker([entry.latitude,entry.longitude],{icon:iconFor(entry),keyboard:true});
        pin.bindPopup(()=>popupFor(entry.point));
        pin.bindTooltip(()=>mapTextLabel(popupFor(entry.point).textContent));
        pin.on('click',()=>onChooseRef.current?.(entry.point));pin.addTo(layer);return pin;
      },
      update(entry,flags){
        if(flags.moved)entry.pin.setLatLng([entry.latitude,entry.longitude]);
        if(flags.restyled){if(dense)entry.pin.setStyle({color:colorFor(entry.point),fillColor:colorFor(entry.point),fillOpacity:entry.style.endsWith(':true')?0.9:0.3});else entry.pin.setIcon(iconFor(entry));}
        if(flags.relabeled&&entry.pin.isPopupOpen())entry.pin.setPopupContent(()=>popupFor(entry.point));
      },
      remove(entry){layer.removeLayer(entry.pin);},
    },Date.now(),maxAgeMs);
    statsRef.current?.({...stats,count:registryRef.current.size,renderer:dense?'canvas':'DOM',milliseconds:performance.now()-started});

    // Auto-fit once; keep the dispatcher’s chosen zoom and position on each GPS update.
    if (!fittedRef.current && points.length) {
      if (points.length === 1) {
        map.setView([Number(points[0].latitude), Number(points[0].longitude)], 10);
      } else {
        map.fitBounds(layer.getBounds().pad(0.2), { maxZoom: 11 });
      }
      fittedRef.current = true;
    }
    return undefined;
  }, [points,clock,maxAgeMs]);

  return (
    <section data-map-mode={appearance.mode} className={'at-map-appearance at-fleet-map at-map-' + theme + (points.length>80?' at-map-dense':'') + ' ' + className}
      aria-label="Authorized fleet locations">
      <div ref={hostRef} className="at-fleet-map-canvas"
        role="region" aria-label="Interactive fleet map" />

      <MapAppearanceToggle mode={appearance.mode} onToggle={appearance.toggle}/>
      <button type="button" className="at-map-fit" onClick={()=>{const layer=layerRef.current;if(layer?.getLayers().length)mapRef.current.fitBounds(layer.getBounds().pad(.2),{maxZoom:11,animate:false});}}>Fit all beacons</button>
      <div className="at-map-coordinates">
        <span className="at-map-crosshair">+</span> NORTH AMERICA / LIVE TELEMETRY
      </div>

      <div className="at-map-summary" aria-live="polite">
        <MapPinned size={15} aria-hidden="true" />
        <span>{points.length} GPS {points.length === 1 ? 'position' : 'positions'}</span>
        <span className="at-map-summary-divider">·</span>
        <span>{stale} stale</span>
        {loading && <span className="at-map-summary-loading">Refreshing…</span>}
      </div>

      {error && <div className="at-map-error" role="alert">
        <ShieldAlert size={16} aria-hidden="true" />
        <span>{error}</span>
      </div>}

      {points.length === 0 && (
        <div className="at-map-empty">
          <span className="at-map-radar" aria-hidden="true" />
          <strong>Waiting for fleet location data</strong>
          <span>Authorized GPS pings will appear as vehicles report.</span>
        </div>
      )}
    </section>
  );
}
