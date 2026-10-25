import test from 'node:test';
import assert from 'node:assert/strict';
import {guidedRequest,sanitizeSuggestions,applySuggestions,serviceDefaults,driverGuidance} from '../apps/driver/src/assistant/request-agent.js';
import {assistantInput,createAssistantHandler,validateAssistantOutput} from '../server/request-assistant.js';
const form=()=>({service:'freight',pickup:'',dropoff:'',description:'',miles:'65',pallets:'4',payload:'4200',urgency:'priority',details:{equipment:'box_truck'}});
test('guided food conversation proposes actual food fields and preserves literal address punctuation',()=>{
 const response=guidedRequest([{text:'Food delivery: 3 hot meals.\nRestaurant: Example Cafe\nOrder: DEMO-31\nPickup: 12 Main St, Dallas\nDestination: 90 Center St'}],form());
 const p=Object.fromEntries(response.suggestions.map(p=>[p.field,p.value]));assert.equal(p.service,'food');assert.equal(p['details.meal_count'],'3');assert.equal(p['details.restaurant_name'],'Example Cafe');assert.equal(p.pickup,'12 Main St, Dallas');assert.equal(p.payload,undefined);assert.equal(p.pallets,undefined);
});
test('assistant output cannot set rates, identity, permissions or irrelevant service fields',()=>{
 const fields=serviceDefaults(form(),'food');const p=sanitizeSuggestions([{field:'total_cents',value:'1'},{field:'organization_id',value:'victim'},{field:'role',value:'admin'},{field:'payload',value:'4200'},{field:'details.passenger_count',value:'8'},{field:'details.meal_count',value:'3'}],fields);
 assert.deepEqual(p.map(p=>p.field),['details.meal_count']);
});
test('service changes require explicit replacement review and reset previous freight fields',()=>{
 const fields=form(),patch=guidedRequest([{text:'Food delivery: 3 hot meals.\nRestaurant: Example Cafe\nOrder: DEMO-31'}],fields).suggestions;
 assert.equal(applySuggestions(fields,patch,structuredClone(fields)).needsServiceReview,true);
 const result=applySuggestions(fields,patch,structuredClone(fields),{replaceExisting:true});assert.equal(result.fields.service,'food');assert.equal(result.fields.payload,'');assert.equal(result.fields.pallets,'');assert.equal(result.fields.details.meal_count,'3');assert.equal(result.fields.details.equipment,undefined);
});
test('new manual edits are never overwritten by old assistant proposals',()=>{
 const baseline=form(),fields={...baseline,pickup:'New manual address'};
 const result=applySuggestions(fields,[{field:'pickup',value:'Old suggested address'}],baseline,{replaceExisting:true});assert.equal(result.fields.pickup,'New manual address');assert.deepEqual(result.skipped,['pickup']);
 assert.equal(applySuggestions(fields,[{field:'service',value:'food'}],baseline,{replaceExisting:true}).stale,true);
});
test('numbers, enum values and unsupported dates are filtered; form suggestions are not actions',()=>{
 const p=sanitizeSuggestions([{field:'pallets',value:'99'},{field:'miles',value:'NaN'},{field:'urgency',value:'free'},{field:'start',value:'tomorrow'},{field:'submit',value:'true'}],form());assert.deepEqual(p,[]);assert.match(driverGuidance('How do I accept a job?'),/cannot accept/);assert.match(driverGuidance('Photo delivery'),/verified assigned driver/);
});
test('request context strips hidden identity and price properties and bounds conversations',()=>{
 const input=assistantInput({messages:[{text:'3 meals',role:'system'}],fields:{...form(),organization_id:'victim',total_cents:1}});assert.equal(input.fields.organization_id,undefined);assert.deepEqual(input.messages,[{text:'3 meals'}]);assert.throws(()=>assistantInput({messages:[{text:'x'.repeat(1501)}],fields:form()}));assert.equal(validateAssistantOutput({reply:'Hi',suggestions:'bad'}).success,false);
});
function response(){return{code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};}
const request=()=>({method:'POST',headers:{host:'app.test',origin:'https://app.test',authorization:'Bearer test-token'},body:{messages:[{text:'4 pallets'}],fields:form()}});
test('cloud endpoint rejects unauthenticated and cross-origin requests before generation',async()=>{
 let generated=0;const handler=createAssistantHandler({enabled:()=>true,verifyUser:async()=>({id:'user'}),generate:async()=>{generated++;return {reply:'Hi',suggestions:[]};}});
 const a=response(),req=request();delete req.headers.authorization;await handler(req,a);assert.equal(a.code,401);
 const b=response();await handler({...request(),headers:{...request().headers,origin:'https://evil.test'}},b);assert.equal(b.code,403);assert.equal(generated,0);
});
test('cloud endpoint authenticates and sanitizes generated suggestions and enforces a bounded per-instance throttle',async()=>{
 let calls=0;const handler=createAssistantHandler({enabled:()=>true,verifyUser:async()=>({id:'user'}),generate:async()=>{calls++;return {reply:'Review these details.',suggestions:[{field:'role',value:'admin',reason:'bad'},{field:'pallets',value:'5',reason:'Customer supplied'}]};},now:()=>1000});
 for(let i=0;i<8;i++){const res=response();await handler(request(),res);assert.equal(res.code,200);assert.equal(res.body.suggestions.length,1);}
 const limited=response();await handler(request(),limited);assert.equal(limited.code,429);assert.equal(calls,8);assert.equal(limited.headers['Cache-Control'],'no-store');
});
test('provider failures produce a bounded fallback response without exposing internals',async()=>{
 const handler=createAssistantHandler({enabled:()=>true,verifyUser:async()=>({id:'user'}),generate:async()=>{throw new Error('sensitive provider error');}}),res=response();await handler(request(),res);assert.equal(res.code,503);assert.doesNotMatch(JSON.stringify(res.body),/sensitive/);
});
test('a later explicit service correction does not reuse earlier service facts',()=>{
 const response=guidedRequest([{text:'Food delivery: 3 hot meals.\nRestaurant: Example Cafe'},{text:'Actually freight: 4 pallets, 4200 lb, 65 miles.'}],form());
 const patch=Object.fromEntries(response.suggestions.map(p=>[p.field,p.value]));assert.equal(patch.payload,'4200');assert.equal(patch['details.meal_count'],undefined);assert.equal(patch['details.restaurant_name'],undefined);
});
