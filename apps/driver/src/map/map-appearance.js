export const MAP_APPEARANCE_KEY='andertrack_map_appearance_v1';
export const MAP_APPEARANCE_EVENT='andertrack-map-appearance';
export function normalizeMapMode(value){return value==='blackout'?'blackout':'standard';}
export function readMapMode(storage){try{return normalizeMapMode(storage?.getItem(MAP_APPEARANCE_KEY));}catch{return 'standard';}}
export function saveMapMode(storage,value){const mode=normalizeMapMode(value);try{storage?.setItem(MAP_APPEARANCE_KEY,mode);}catch{/* A blocked preference store must not break tracking. */}return mode;}
