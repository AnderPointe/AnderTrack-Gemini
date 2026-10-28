const cities=[['Fort Worth',32.75,-97.33],['Orlando',28.54,-81.38],['Seattle',47.61,-122.33],['Los Angeles',34.05,-118.24],['Chicago',41.88,-87.63],['New York',40.71,-74.01]];
export function seedBeacons(count,now=Date.now()){
 return Array.from({length:count},(_,i)=>{const [city,lat,lng]=cities[i%6];const metro=count===20;return{id:'lab-'+i,unit_number:`TEST-${i+1} · ${metro?'Fort Worth metro':i<6?city:'US-region grid'}`,latitude:metro?32.69+Math.floor(i/5)*.025:i<6?lat:25+(i*37%2400)/100,longitude:metro?-97.42+(i%5)*.025:i<6?lng:-124+(i*71%5700)/100,status:'in_transit',last_ping_at:new Date(now).toISOString()};});
}
export function moveBeacons(points,now=Date.now()){
 return points.map((p,i)=>points.length<=20||i%10===0?{...p,latitude:p.latitude+.0001,longitude:p.longitude+.0001,last_ping_at:new Date(now).toISOString()}:p);
}
export function syncSummary(samples){if(!samples.length)return null;const ordered=[...samples].sort((a,b)=>a-b);return{count:samples.length,p95:ordered[Math.ceil(samples.length*.95)-1],max:ordered.at(-1)};}
