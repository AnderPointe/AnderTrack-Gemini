import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHealthHandler} from '../apps/driver/server/health.js';
import {checkDeployment, deploymentOrigin, runReleaseSmoke} from '../scripts/release-smoke.mjs';
const sha='a'.repeat(40);
function response(){return {code:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;return this;},end(){this.ended=true;return this;}};}
function deploymentFetch({wrongSurface=false,wrongRelease=false,assetType='text/javascript',failurePath='',failureStatus=503}={}) {
 return async url=>{
  if(url.pathname===failurePath)return new Response('private upstream details',{status:failureStatus});
  if(url.pathname==='/api/health')return Response.json({status:'ok',check:'liveness',surface:wrongSurface?'wrong':url.hostname.startsWith('web')?'website':'driver',release:wrongRelease?'b'.repeat(40):sha});
  if(url.pathname==='/assets/entry.js')return new Response('console.log("entry");',{headers:{'content-type':assetType}});
  return new Response('<html><script type="module" src="/assets/entry.js"></script></html>',{headers:{'content-type':'text/html'}});
 };
}
test('public health is liveness only and exposes only validated release metadata',()=>{
 const res=response();createHealthHandler('website',()=>sha)({method:'GET'},res);
 assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');
 assert.deepEqual(res.body,{status:'ok',check:'liveness',surface:'website',release:sha});
 const invalid=response();createHealthHandler('driver',()=>'{secret environment details}')({method:'GET'},invalid);assert.equal(invalid.body.release,null);
});
test('health HEAD has no body and unsupported methods cannot trigger work',()=>{
 let calls=0;const handler=createHealthHandler('driver',()=>{calls++;return sha;});const res=response();handler({method:'HEAD'},res);assert.equal(res.ended,true);assert.equal(res.body,undefined);
 const post=response();handler({method:'POST'},post);assert.equal(post.code,405);assert.equal(post.headers.Allow,'GET, HEAD');assert.equal(calls,1);
});
test('release checks reject credential-bearing URLs, redirects and foreign origins',async()=>{
 for(const url of ['http://web.vercel.app','https://example.com','https://user:token@web.vercel.app','https://web.vercel.app/path','https://web.vercel.app/?token=secret','https://web.vercel.app/#secret','https://web.vercel.app.evil.test'])assert.throws(()=>deploymentOrigin(url));
 await assert.rejects(checkDeployment({origin:'https://web.vercel.app',surface:'website',commit:sha,fetchImpl:deploymentFetch({failurePath:'/api/health',failureStatus:302})}),/HTTP 302/);
});
test('both surfaces must serve the exact expected release and real JS entry',async()=>{
 const result=await runReleaseSmoke({website:'https://web.vercel.app',driver:'https://driver.vercel.app',commit:sha,fetchImpl:deploymentFetch()});assert.deepEqual(result.map(r=>r.surface),['website','driver']);assert.ok(result.every(r=>r.release===sha));
});
test('mismatched release/surface, protected deployment and HTML masquerading as JS fail closed',async()=>{
 for(const config of [{wrongRelease:true},{wrongSurface:true},{assetType:'text/html'},{failurePath:'/api/health',failureStatus:401}])await assert.rejects(checkDeployment({origin:'https://web.vercel.app',surface:'website',commit:sha,fetchImpl:deploymentFetch(config)}));
 await assert.rejects(checkDeployment({origin:'https://web.vercel.app',surface:'website',commit:'short',fetchImpl:deploymentFetch()}));
});
test('a failing paired deployment cannot yield an overall passing result',async()=>{
 const fetchImpl=async(url,opts)=>url.hostname==='driver.vercel.app'?new Response('down',{status:503}):deploymentFetch()(url,opts);
 await assert.rejects(runReleaseSmoke({website:'https://web.vercel.app',driver:'https://driver.vercel.app',commit:sha,fetchImpl}),/driver: unexpected HTTP 503/);
});
test('both deploy configs leave API paths out of SPA fallback and include health functions',async()=>{
 for(const file of ['vercel.json','apps/driver/vercel.json']){
  const config=JSON.parse(await readFile(new URL('../'+file,import.meta.url)));
  assert.equal(config.functions['api/health.js'].maxDuration,5);
  assert.match(config.rewrites[0].source,/api/);
 }
});
