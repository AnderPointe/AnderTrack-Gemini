import {csvCell} from './command-intelligence.js';
export const INVENTORY_UNITS=['each','case','pallet','kg','lb'];
export function inventoryRows({items=[],locations=[],balances=[]}){
 const byLocation=new Map(locations.map(l=>[l.id,l])),byItem=new Map();
 for(const b of balances){const group=byItem.get(b.item_id)||[];group.push(b);byItem.set(b.item_id,group);}
 return items.map(item=>{const stored=(byItem.get(item.id)||[]).map(b=>({...b,location:byLocation.get(b.location_id)?.code||'Unknown location',quantity:Number(b.quantity)}));const quantity=stored.reduce((n,b)=>n+b.quantity,0);return {...item,quantity,stored,low:quantity<=Number(item.reorder_point)};});
}
export function inventoryCsv(snapshot){return [['SKU','Item','Unit','On hand','Reorder point','Stock status','Storage locations'],...inventoryRows(snapshot).map(r=>[r.sku,r.name,r.unit,r.quantity,r.reorder_point,r.low?'Reorder':'In stock',r.stored.map(b=>`${b.location}: ${b.quantity}`).join('; ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function movementInput({item,location,toLocation,operation,quantity,note}){
 const q=Number(quantity),reason=String(note||'').trim();
 if(!item||!location||!['receive','issue','transfer'].includes(operation)||!Number.isFinite(q)||q<=0||q>1e9||Math.abs(q*1000-Math.round(q*1000))>0.00001||reason.length<6||reason.length>500)throw Error('Choose an item/location and enter a positive quantity (up to 3 decimals) and a 6–500 character reason.');
 if(operation==='transfer'&&(!toLocation||toLocation===location))throw Error('Select a different destination location.');
 return {p_item_id:item,p_location_id:location,p_to_location_id:operation==='transfer'?toLocation:null,p_operation:operation,p_quantity:q,p_note:reason};
}
export function simulateMovement(snapshot,input){
 const {p_item_id:item,p_location_id:loc,p_to_location_id:to,p_operation:op,p_quantity:q,p_note:note}=input;
 if(!snapshot.items.some(i=>i.id===item)||!snapshot.locations.some(l=>l.id===loc)||(to&&!snapshot.locations.some(l=>l.id===to)))throw Error('Choose a visible item and location.');
 const balances=snapshot.balances.map(b=>({...b}));
 const balance=id=>{let b=balances.find(b=>b.item_id===item&&b.location_id===id);if(!b){b={item_id:item,location_id:id,quantity:0};balances.push(b);}return b;};
 const source=balance(loc),before=Number(source.quantity),after=Math.round((before+(op==='receive'?q:-q))*1000)/1000;
 if(after<0||after>1e9)throw Error('Movement exceeds available stock or storage limit.');
 if(op==='transfer'){const dest=balance(to);if(Number(dest.quantity)+q>1e9)throw Error('Destination storage limit exceeded.');dest.quantity=Math.round((Number(dest.quantity)+q)*1000)/1000;}
 source.quantity=after;
 return {...snapshot,balances,movements:[{id:crypto.randomUUID(),item_id:item,location_id:loc,to_location_id:to,operation:op,quantity:q,before_quantity:before,after_quantity:after,note,occurred_at:new Date().toISOString()},...snapshot.movements].slice(0,100)};
}
export function inventoryDemo(){return {items:[{id:'sample-item',sku:'DEMO-CASES',name:'Sample packing cases',unit:'case',reorder_point:8}],locations:[{id:'sample-bay',code:'BAY-A',name:'Sample receiving bay'},{id:'sample-rack',code:'RACK-B',name:'Sample storage rack'}],balances:[{item_id:'sample-item',location_id:'sample-bay',quantity:10}],movements:[]};}
