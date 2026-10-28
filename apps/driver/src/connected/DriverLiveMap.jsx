import React,{useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './connected.css';
import {MapAppearanceToggle,useMapAppearance} from '../map/MapAppearance.jsx';

export default function DriverLiveMap({position,label="Your shared GPS location on the live map"}){
  const appearance=useMapAppearance();
  const host=useRef(null),map=useRef(null),marker=useRef(null);
  useEffect(()=>{
    if(!host.current)return;
    const instance=L.map(host.current,{zoomControl:false,scrollWheelZoom:false,zoomAnimation:false}).setView([32.75,-97.33],11);map.current=instance;L.control.zoom({position:'bottomright'}).addTo(instance);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{referrerPolicy:'strict-origin',updateWhenIdle:true,updateWhenZooming:false,maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(instance);
    return()=>{instance.remove();map.current=null;marker.current=null;};
  },[]);
  useEffect(()=>{if(!map.current||!position||!Number.isFinite(position.latitude)||!Number.isFinite(position.longitude))return;
    const point=[position.latitude,position.longitude];
    if(!marker.current){
      marker.current=L.circleMarker(point,{radius:9,color:'#fff',weight:3,fillColor:'#087d79',fillOpacity:1}).addTo(map.current);
      map.current.setView(point,14,{animate:false});
    }else{
      const previous=marker.current.getLatLng();
      if(previous.lat!==point[0]||previous.lng!==point[1])marker.current.setLatLng(point);
      if(!map.current.getBounds().pad(-.2).contains(point))map.current.setView(point,map.current.getZoom(),{animate:false});
    }
  },[position]);
  return <section className="at-driver-map-frame at-map-appearance" data-map-mode={appearance.mode} aria-label="Live map appearance"><div ref={host} className="connected-live-map" role="region" aria-label={label}/><MapAppearanceToggle mode={appearance.mode} onToggle={appearance.toggle}/></section>;
}
