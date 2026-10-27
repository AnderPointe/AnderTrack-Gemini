import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArrowLeft, ArrowRight, Box, Check, Clock3, MapPinned, MessageSquare, RotateCcw, Send, Truck, UserRound } from 'lucide-react';
import './command-concept.css';

const SAMPLE_LOADS = [
  { id: 'LD-4172', beacon: 'BCN-8818', status: 'in_transit', cargo: 'Electronics · 20 pallets', origin: 'Chicago, IL', destination: 'Dallas, TX', facility: 'Dallas Distribution Center', driver: 'Mike Rodriguez', truck: 'TRK-018', model: 'Volvo VNL 760', utilization: 87, payload: '40,124 lb', distance: 380, fuel: 67, hos: '06h 42m', eta: 'Tomorrow, 2:30 PM', optimized: false },
  { id: 'LD-4185', beacon: 'BCN-8824', status: 'accepted', cargo: 'Retail parcels · 6 packages', origin: 'Fort Worth, TX', destination: 'Burleson, TX', facility: 'Local delivery hub', driver: 'Alex Rivera', truck: 'VAN-071', model: 'Ford Transit 350', utilization: 62, payload: '860 lb', distance: 19, fuel: 82, hos: null, eta: 'Today, 3:45 PM', optimized: false },
];
const human = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

function RouteScene({ vehicleIndex, optimized }) {
  const mount = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setUnavailable(true); return; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080808');
    scene.fog = new THREE.FogExp2('#080808', .012);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 180);
    camera.position.set(32, 32, 40);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 15; controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight('#ffffff', 1.8));
    const light = new THREE.DirectionalLight('#bdf7ef', 3);
    light.position.set(20, 40, 25); scene.add(light);
    scene.add(new THREE.GridHelper(100, 40, '#292929', '#151515'));
    const box = new THREE.BoxGeometry(1, 1, 1);
    const buildingMaterial = new THREE.MeshStandardMaterial({ color: '#202323', roughness: .7 });
    for (let x = -32; x <= 32; x += 6) {
      for (let z = -32; z <= 32; z += 6) {
        if (Math.abs(x + z * .45) < 6 || Math.abs(x - 5) < 4) continue;
        const h = 2 + Math.abs(Math.sin(x * 13 + z * 7)) * 7;
        const building = new THREE.Mesh(box, buildingMaterial);
        building.scale.set(3, h, 3); building.position.set(x, h / 2, z); scene.add(building);
      }
    }
    const offset = vehicleIndex * 3;
    const points = optimized
      ? [[-18, 22], [-9, 8], [4, -4], [14, -22]]
      : [[-18, 22], [-8, 12], [-3, 3], [2, -9], [14, -22]];
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x + offset, .35, z)));
    const route = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, .22, 8, false), new THREE.MeshBasicMaterial({ color: '#087d79' })); scene.add(route);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a18' });
    for (const position of [curve.getPointAt(0), curve.getPointAt(1)]) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.6, 12, 10), markerMaterial); marker.position.copy(position); scene.add(marker);
    }
    const vehicle = new THREE.Group();
    const trailer = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#ffffff' })); trailer.scale.set(1.5, 1.5, 3); trailer.position.y = 1; vehicle.add(trailer);
    const cab = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#ff8a18' })); cab.scale.set(1.4, 1.3, 1.2); cab.position.set(0, .9, 2); vehicle.add(cab); scene.add(vehicle);
    const resize = () => { const {width, height} = container.getBoundingClientRect(); if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let frame;
    const animate = () => {
      const progress = reducedMotion ? .42 : .15 + (clock.getElapsedTime() * .015) % .7;
      vehicle.position.copy(curve.getPointAt(progress));
      vehicle.lookAt(curve.getPointAt(Math.min(.999, progress + .005)));
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) for (const material of [object.material].flat()) materials.add(material); });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [vehicleIndex, optimized]);
  return <div className="at-concept-scene" ref={mount} role="img" aria-label="Illustrative 3D city route with an animated sample vehicle. Drag to orbit; scroll to zoom. Not a geographic map.">{unavailable && <div className="at-concept-webgl-fallback"><MapPinned size={36}/><p>3D rendering is unavailable on this device.</p><span>The sample assignment details remain available.</span></div>}</div>;
}

function RouteChat({ messages, onSend, sender }) {
  const [text, setText] = useState('');
  return <section className="at-concept-card at-concept-chat" aria-label="Sample route chat">
    <h2><MessageSquare size={17}/> Route chat <small>LOCAL DEMO</small></h2>
    <div className="at-concept-messages" aria-live="polite" aria-relevant="additions">{messages.map(message => <div key={message.id}><strong>{message.sender}</strong><p>{message.text}</p></div>)}</div>
    <form onSubmit={event => { event.preventDefault(); if (!text.trim()) return; onSend(sender, text.trim()); setText(''); }}>
      <label className="at-concept-sr-only" htmlFor="concept-message">Message {sender === 'Dispatch' ? 'driver' : 'dispatch'}</label>
      <input id="concept-message" maxLength={1000} value={text} onChange={event => setText(event.target.value)} placeholder={sender === 'Dispatch' ? 'Message driver…' : 'Message dispatch…'}/>
      <button type="submit" disabled={!text.trim()} aria-label="Send sample message"><Send size={17}/></button>
    </form>
  </section>;
}

export default function CommandConcept() {
  const [loads, setLoads] = useState(() => SAMPLE_LOADS.map(load => ({...load})));
  const [selectedId, setSelectedId] = useState(SAMPLE_LOADS[0].id);
  const [view, setView] = useState('dispatch');
  const [messages, setMessages] = useState({});
  const [notice, setNotice] = useState('');
  const active = loads.find(load => load.id === selectedId) || loads[0];
  const update = patch => setLoads(previous => previous.map(load => load.id === active.id ? {...load, ...patch} : load));
  const send = (sender, text) => setMessages(previous => ({...previous, [active.id]: [...(previous[active.id] || []), {id: crypto.randomUUID(), sender, text}]}));
  const optimize = () => { update({optimized: true}); setNotice(`Alternate sample route selected for ${active.id}. No route was sent to a device.`); send('System · simulation', 'An alternate sample route was selected. This is a local visualization only.'); };
  const reset = () => { setLoads(SAMPLE_LOADS.map(load => ({...load}))); setMessages({}); setSelectedId(SAMPLE_LOADS[0].id); setNotice('Sample data reset.'); };
  return <div className="at-command-concept">
    <header className="at-concept-nav"><a href="/website" aria-label="Return to AnderTrack website"><ArrowLeft size={16}/> ANDER<span>TRACK</span></a><nav aria-label="Concept views"><button onClick={() => setView('dispatch')} aria-pressed={view === 'dispatch'}><Truck size={16}/> Command center</button><button onClick={() => setView('driver')} aria-pressed={view === 'driver'}><UserRound size={16}/> Driver companion</button></nav><button className="at-concept-reset" onClick={reset}><RotateCcw size={15}/> Reset demo</button></header>
    <div className="at-concept-banner"><span>INTERACTIVE DESIGN CONCEPT</span> Fictional assignments · Simulated motion · Changes stay in this tab</div>
    <main>
      <div className="at-concept-heading"><div><p className="at-site-eyebrow">{view === 'dispatch' ? 'DISPATCH WORKSPACE' : 'DRIVER WORKSPACE'}</p><h1>{view === 'dispatch' ? 'Every move, in view.' : `Your assignment. Your next move.`}</h1></div><span className="at-concept-demo-badge">Sample data</span></div>
      {notice && <p className="at-concept-notice" role="status">{notice}</p>}
      <div className={view === 'dispatch' ? 'at-concept-grid' : 'at-concept-driver-grid'}>
        <section className="at-concept-card at-concept-queue"><h2>Dispatch queue <small>{loads.length} SAMPLE LOADS</small></h2>{loads.map(load => <button key={load.id} className={'at-concept-load ' + (load.id === active.id ? 'selected' : '')} onClick={() => {setSelectedId(load.id); setNotice('');}} aria-pressed={load.id === active.id}><div><strong>{load.id}</strong><span>{human(load.status)}</span></div><p>{load.cargo}</p><p>{load.origin} <ArrowRight size={12}/> {load.destination}</p><footer><UserRound size={13}/>{load.driver}<span>{load.truck}</span></footer></button>)}<p className="at-concept-queue-note">Select a load to inspect its vehicle, route and conversation.</p></section>
        {view === 'dispatch' ? <section className="at-concept-map-card" aria-label="3D route concept"><RouteScene vehicleIndex={loads.indexOf(active)} optimized={active.optimized}/><div className="at-concept-map-label"><span/> 3D route simulation<small>Illustrative city · {active.truck}</small></div><div className="at-concept-map-hint">Drag to orbit · Scroll to zoom</div>{!active.optimized && <div className="at-concept-route-option"><strong>Explore an alternate route</strong><p>Preview a different path in this fictional scene.</p><button onClick={optimize}>Preview alternate route <ArrowRight size={15}/></button></div>}</section> : <section className="at-concept-card at-concept-manifest"><h2><Box size={18}/> Active assignment</h2><h3>{active.id}</h3><p>{active.cargo}</p><div className="at-concept-trip"><strong>{active.origin}</strong><ArrowRight/><strong>{active.destination}</strong></div><p>{active.facility}</p><dl><div><dt>Sample ETA</dt><dd>{active.eta}</dd></div><div><dt>Distance remaining</dt><dd>{active.distance} mi</dd></div><div><dt>Sample beacon</dt><dd>{active.beacon}</dd></div><div><dt>Status</dt><dd>{human(active.status)}</dd></div>{active.hos && <div><dt>Illustrative HOS</dt><dd>{active.hos}</dd></div>}</dl><p className="at-concept-queue-note">Status buttons simulate the sequence. No delivery receipt or ELD entry is created.</p><div className="at-concept-status-actions">{[['accepted','in_transit','Start trip'],['in_transit','arrived','At dock'],['arrived','delivered','Mark delivered']].map(([from,to,label]) => <button key={to} disabled={active.status !== from} onClick={() => { update({status:to}); setNotice(`Sample ${active.id} status updated to ${human(to)}.`); }}>{label}</button>)}</div>{active.status === 'delivered' && <p className="at-concept-complete"><Check size={16}/> Sample workflow complete</p>}</section>}
        <aside className="at-concept-detail-stack"><section className="at-concept-card at-concept-vehicle"><h2>Vehicle information <Truck size={17}/></h2><h3>{active.truck}</h3><p>{active.model}</p><dl><div><dt>Utilization</dt><dd>{active.utilization}%</dd></div><div><dt>Payload</dt><dd>{active.payload}</dd></div><div><dt>Distance left</dt><dd>{active.distance} mi</dd></div><div><dt>Fuel level</dt><dd>{active.fuel}%</dd></div></dl><div className="at-concept-driver"><span><UserRound/></span><div><strong>{active.driver}</strong><small>{active.beacon} · Sample beacon</small></div></div><button className="at-concept-view-switch" onClick={() => setView(view === 'driver' ? 'dispatch' : 'driver')}>{view === 'driver' ? 'Open command center' : 'Open driver companion'} <ArrowRight size={15}/></button></section><RouteChat messages={messages[active.id] || []} sender={view === 'driver' ? active.driver : 'Dispatch'} onSend={send}/></aside>
      </div>
    </main>
    <footer className="at-concept-footer"><Clock3 size={14}/> Design preview only. Geographic routing, real telemetry, HOS and cross-device chat require verified backend integrations.</footer>
  </div>;
}
