// Preserve acknowledged sends if a refresh started before the send completed.
export function mergeMessages(current,incoming,limit=100){
  const byId=new Map(current.map(message=>[message.id,message]));
  for(const message of incoming)byId.set(message.id,message);
  return [...byId.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||String(a.id).localeCompare(String(b.id))).slice(-limit);
}
export function draftAfterSend(current,submitted){return current===submitted?'':current;}
export function connectionLabel({demo,ready,online,subscribed,failed}){
  if(demo)return 'Local demo';
  if(!ready)return 'Sign-in required';
  if(!online)return 'Offline · draft kept';
  if(failed)return 'Sync failed · retry available';
  return subscribed?'Live updates connected':'Checking every 5 seconds';
}
