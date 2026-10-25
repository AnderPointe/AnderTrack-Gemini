import {REQUEST_SERVICES} from '../connected/service-request.js';
export const FIELD_LABELS={service:'Service',pickup:'Pickup address',dropoff:'Destination address',description:'Instructions',miles:'Estimated miles',pallets:'Pallets',payload:'Total weight',urgency:'Urgency',start:'Pickup time',end:'Completion deadline'};
export function fieldLabel(field,service){return FIELD_LABELS[field]||REQUEST_SERVICES[service]?.fields.find(f=>'details.'+f.key===field)?.label||field;}
export function readField(fields,key){return key.startsWith('details.')?fields.details?.[key.slice(8)]:fields[key];}
export function serviceDefaults(fields,service){const config=REQUEST_SERVICES[service];return {...fields,service,details:{...config.defaults},pallets:config.palletCount||'',payload:config.payload||'',miles:config.miles,pickup:'',dropoff:'',description:''};}
export function sanitizeSuggestions(suggestions,fields){
 if(!Array.isArray(suggestions))return [];
 const serviceSuggestion=suggestions.find(p=>p?.field==='service'&&REQUEST_SERVICES[p.value]);const service=serviceSuggestion?.value||fields.service,config=REQUEST_SERVICES[service];if(!config)return [];
 const accepted=new Map();for(const raw of suggestions.slice(0,25)){
  if(!raw||typeof raw.field!=='string'||typeof raw.value!=='string')continue;const field=raw.field,value=raw.value.trim();if(!value||value.length>1000)continue;
  let valid=false;
  if(field==='service')valid=Boolean(REQUEST_SERVICES[value]);
  else if(['pickup','dropoff'].includes(field))valid=value.length>=3&&value.length<=300;
  else if(field==='description')valid=value.length>=2;
  else if(field==='urgency')valid=['standard','priority','express'].includes(value);
  else if(['start','end'].includes(field))valid=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)&&Number.isFinite(Date.parse(value));
  else if(field==='miles')valid=Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=10000;
  else if(field==='pallets')valid=config.pallets&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=26;
  else if(field==='payload')valid=config.weight&&Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=100000;
  else{const detail=config.fields.find(f=>'details.'+f.key===field);if(detail){if(detail.type==='number')valid=Number.isInteger(Number(value))&&Number(value)>=detail.min&&Number(value)<=detail.max;else if(detail.type==='select')valid=detail.options.some(([key])=>key===value);else valid=value.length>=detail.min&&value.length<=detail.max;}}
  if(valid)accepted.set(field,{field,value,reason:typeof raw.reason==='string'?raw.reason.slice(0,160):'From your conversation'});
 }
 return [...accepted.values()].sort((a,b)=>a.field==='service'?-1:b.field==='service'?1:0);
}
export function guidedRequest(messages,fields){
 let service=fields.service,startAt=0;const recent=messages.slice(-8);
 const infer=text=>/\b(food delivery|restaurant|meals?|food items?)\b/i.test(text)?'food':/\b(rideshare|passengers?|taxi|ride for)\b/i.test(text)?'rideshare':/\b(trash|waste|junk|debris)\b/i.test(text)?'waste':/\b(otr|long haul)\b/i.test(text)?'otr':/\b(pallets?|freight)\b/i.test(text)?'freight':/\b(courier|parcels?|packages?)\b/i.test(text)?'courier':null;
 recent.forEach((message,index)=>{const next=infer(message.text);if(next&&next!==service){service=next;startAt=index;}});
 const text=recent.slice(startAt).map(m=>m.text).join('\n').slice(-6000),patch=[];const add=(field,value,reason='Taken from your message')=>{if(value!==undefined&&value!==null)patch.push({field,value:String(value).replace(/,/g,''),reason});};
 if(service!==fields.service)add('service',service,'Service suggested by the work described');
 const number=(pattern)=>{const matches=[...text.matchAll(pattern)];return matches.at(-1)?.[1];};
 add('miles',number(/\b([\d,]+(?:\.\d+)?)\s*(?:miles?|mi)\b/gi));
 if(REQUEST_SERVICES[service].weight)add('payload',number(/\b([\d,]+)\s*(?:lb|lbs|pounds?)\b/gi));
 if(REQUEST_SERVICES[service].pallets)add('pallets',number(/\b(\d+)\s*pallets?\b/gi));
 if(service==='food'){add('details.meal_count',number(/\b(\d+)\s*(?:(?:hot|cold|mixed)\s+)?(?:meals?|food items?)\b/gi));if(/\bhot and cold\b/i.test(text))add('details.food_handling','mixed');else if(/\bcold\b/i.test(text))add('details.food_handling','cold');else if(/\bhot\b/i.test(text))add('details.food_handling','hot');}
 if(service==='courier'){add('details.package_count',number(/\b(\d+)\s*(?:packages?|parcels?)\b/gi));if(/\bfragile\b/i.test(text))add('details.package_type','fragile');else if(/\bdocuments\b/i.test(text))add('details.package_type','documents');}
 if(service==='rideshare'){add('details.passenger_count',number(/\b(\d+)\s*(?:passengers?|people)\b/gi));add('details.luggage_count',number(/\b(\d+)\s*(?:bags?|luggage items?)\b/gi));}
 if(service==='waste'){add('details.item_count',number(/\b(\d+)\s*items?\b/gi));add('details.volume_cuyd',number(/\b(\d+)\s*(?:cubic yards?|cu yd)\b/gi));for(const [key,term] of [['yard','yard waste'],['construction','construction debris'],['household','household waste'],['bulky','bulky']])if(text.toLowerCase().includes(term))add('details.waste_category',key);}
 if(['freight','otr'].includes(service))for(const [key,pattern] of [['box_truck',/box truck/i],['dry_van',/dry van/i],['flatbed',/flatbed/i],['reefer',/refrigerated|reefer/i]])if(pattern.test(text))add('details.equipment',key);
 if(/\b(express|asap)\b/i.test(text))add('urgency','express','Express changes the urgency fee; review the price before submitting');else if(/\b(priority|urgent)\b/i.test(text))add('urgency','priority','Priority changes the urgency fee; review the price before submitting');else if(/\bstandard\b/i.test(text))add('urgency','standard');
 // Labeled facts avoid guessing locations, order identities or ambiguous dates.
 for(const line of text.split(/\n|;/)){const match=line.trim().match(/^(pickup|from|destination|dropoff|to|restaurant|order|instructions|pickup time|deadline)\s*:\s*(.+)$/i);if(!match)continue;const key=match[1].toLowerCase(),value=match[2].trim();const field={pickup:'pickup',from:'pickup',destination:'dropoff',dropoff:'dropoff',to:'dropoff',restaurant:'details.restaurant_name',order:'details.order_reference',instructions:'description','pickup time':'start',deadline:'end'}[key];patch.push({field,value,reason:'Explicitly provided in your message'});}
 const suggestions=sanitizeSuggestions(patch,fields);
 const question=service==='food'?'What restaurant and order reference should I use? You can write “Restaurant: Example Cafe; Order: ORDER-31”.':service==='rideshare'?'What are the passenger pickup and destination addresses?':service==='waste'?'What waste type, item count and volume need collecting?':'What are the pickup and destination addresses, and the pickup/deadline times?';
 return {source:'guided',reply:suggestions.length?'I found details you can review below. '+question:'Tell me the service and details you know. '+question,suggestions};
}
export function applySuggestions(fields,suggestions,baseline,{replaceExisting=false}={}){
 const safe=sanitizeSuggestions(suggestions,fields),serviceChange=safe.find(s=>s.field==='service'&&s.value!==fields.service);const applied=[],skipped=[];let next={...fields,details:{...fields.details}};
 if(serviceChange){if(JSON.stringify(fields)!==JSON.stringify(baseline)){return{fields,applied:[],skipped:safe.map(s=>s.field),stale:true};}if(fields.service!==baseline.service||!replaceExisting){return{fields,applied:[],skipped:safe.map(s=>s.field),needsServiceReview:true};}next=serviceDefaults(fields,serviceChange.value);applied.push('service');}
 for(const p of safe){if(p.field==='service')continue;const current=readField(fields,p.field),before=readField(baseline,p.field);if(!serviceChange&&String(current??'')!==String(before??'')){skipped.push(p.field);continue;}if(!serviceChange&&!replaceExisting&&current!==undefined&&current!==null&&String(current)!==''&&String(current)!==p.value){skipped.push(p.field);continue;}
  if(p.field.startsWith('details.'))next.details[p.field.slice(8)]=p.value;else next[p.field]=p.value;applied.push(p.field);
 }
 return{fields:next,applied,skipped};
}
export function driverGuidance(text){if(/deliver|photo|proof/i.test(text))return 'Open the assigned job while it is in transit. Use Secure proof of delivery to add the recipient and a delivery photo, then confirm. Only the verified assigned driver can complete it; package scans must be finished where required.';if(/location|track|online/i.test(text))return 'On Home, review location sharing and tap Share location & go online. The browser app must stay visible. Dispatch can view your GPS; the customer sees it only for the assigned shipment during transit. Offline, hidden or stale sessions stop customer visibility.';if(/queue|accept|job/i.test(text))return 'Join the queue for an approved service while online with fresh GPS. Dispatch offers a task after license, service and equipment checks. Open Jobs to review the offer and accept or decline. I cannot accept or change assignments for you.';return 'I can explain jobs, the driver queue, location sharing and photo proof of delivery. Ask about one of those workflows. For account-specific changes, message dispatch.';}
