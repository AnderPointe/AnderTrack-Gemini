import React,{useEffect,useState} from 'react';
import {serviceSummary,serviceDetailsText} from './service-request.js';
import ShipmentThread from './ShipmentThread.jsx';
export default function CustomerLoad({client,assignmentId,userId}){
 const [request,setRequest]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setRequest(null);setError('');client.from('at_customer_requests').select('id,service_id,service_details,pallets,payload_lbs,window_start,window_end,urgency,quote').eq('assignment_id',assignmentId).maybeSingle().then(({data,error:e})=>{if(active){if(e)setError(e.message);else setRequest(data);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[client,assignmentId,userId]);
 if(error)return <p role="alert" className="connected-error">Customer load details: {error}</p>;if(!request)return null;
 const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
 return <section style={{marginTop:20}}><div className="connected-location"><strong>Approved driver compensation · {money(request.quote.driver_cents)}</strong><p>{serviceSummary(request)} · {request.urgency}</p><small>{serviceDetailsText(request)}</small><small>Pickup {new Date(request.window_start).toLocaleString()} · deliver by {new Date(request.window_end).toLocaleString()}. Customer total {money(request.quote.total_cents)}; service fee {money(request.quote.service_fee_cents)}. No payout is processed in this pilot.</small><small>Customer map access is limited to this shipment while in transit. Delivery requires recipient confirmation and a private photo.</small></div><ShipmentThread key={request.id+userId} client={client} requestId={request.id} userId={userId}/></section>;
}
