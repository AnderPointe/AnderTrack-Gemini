// Positions are assigned before filtering; a filtered view must never renumber FIFO.
export function filterQueue(queue,query='',service='all'){
  const term=query.trim().toLocaleLowerCase();
  return queue.map((row,index)=>({...row,queue_position:row.queue_position||row.position||index+1})).filter(row=>(service==='all'||row.service_id===service)&&(!term||[row.display_name,row.queue_number].some(value=>String(value||'').toLocaleLowerCase().includes(term))));
}
export function requestedService(service){return service==='all'?'otr':service;}
