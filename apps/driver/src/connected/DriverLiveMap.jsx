import React,{useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './connected.css';

export default function DriverLiveMap({position}){
  const host=useRef(null),map=useRef(null),marker=useRef(null);
  useEffect(()=>{
    if(!host.current)return;
    const instance=L.map(host.current,{zoomControl:true,scrollWheelZoom:false}).setView([32.75,-97.33],11);map.current=instance;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(instance);
    return()=>{instance.remove();map.current=null;marker.current=null;};
  },[]);
  useEffect(()=>{if(!map.current||!position||!Number.isFinite(position.latitude)||!Number.isFinite(position.longitude))return;
    const point=[position.latitude,position.longitude];
    if(!marker.current)marker.current=L.circleMarker(point,{radius:9,color:'#fff',weight:3,fillColor:'#087d79',fillOpacity:1}).addTo(map.current);
    else marker.current.setLatLng(point);map.current.setView(point,14,{animate:false});
  },[position]);
  return <div ref={host} className="connected-live-map" role="img" aria-label="Your shared GPS location on the live map"/>;
}
