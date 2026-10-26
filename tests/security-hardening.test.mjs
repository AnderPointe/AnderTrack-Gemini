import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicSupabaseConfig} from '../apps/driver/src/security/public-config.js';
import {mapTextLabel} from '../src/lib/map-label.js';
const endpoint='https://test.supabase.co';
const jwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
test('public clients reject privileged, malformed and insecure configuration',()=>{
 for(const key of ['sb_secret_test',jwt('service_role'),jwt('authenticated'),'replace_with_your_publishable_key','garbage'])assert.equal(publicSupabaseConfig(endpoint,key),false);
 for(const url of ['http://test.supabase.co','javascript:alert(1)','https://user:pass@test.supabase.co','https://test.supabase.co/?token=x'])assert.equal(publicSupabaseConfig(url,'sb_publishable_test'),false);
 assert.equal(publicSupabaseConfig(endpoint,'sb_publishable_test'),true);
 assert.equal(publicSupabaseConfig(endpoint,jwt('anon')),true);
});
test('map tooltips render hostile labels as literal text, never HTML',()=>{
 const hostile='<img src=x onerror=alert(1)><svg onload=alert(2)>';
 const document={createElement(tag){assert.equal(tag,'span');return {set innerHTML(value){throw Error('HTML assignment prohibited');}};}};
 assert.equal(mapTextLabel(hostile,document).textContent,hostile);
 assert.equal(mapTextLabel(null,document).textContent,'');
});
for(const file of ['../vercel.json','../apps/driver/vercel.json'])test(`${file} restricts scripts, framing, referrers and caching without disabling GPS/photo`,()=>{
 const config=JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));
 const headers=Object.fromEntries(config.headers.find(rule=>rule.source==='/(.*)').headers.map(h=>[h.key,h.value]));
 const csp=headers['Content-Security-Policy'];
 assert.match(csp,/script-src 'self';/);assert.doesNotMatch(csp,/unsafe-eval|script-src[^;]*unsafe-inline/);
 for(const rule of ["object-src 'none'","base-uri 'none'","frame-ancestors 'none'","form-action 'self'",'upgrade-insecure-requests'])assert.ok(csp.includes(rule));
 assert.match(csp,/https:\/\/ofyfausfhinwgrfmapgc.supabase.co/);assert.match(csp,/https:\/\/\*\.tile.openstreetmap.org/);
 assert.equal(headers['Referrer-Policy'],'no-referrer');assert.equal(headers['X-Content-Type-Options'],'nosniff');
 assert.match(headers['Permissions-Policy'],/geolocation=\(self\), camera=\(self\)/);
 assert.ok(config.headers.some(rule=>rule.headers.some(h=>h.key==='Cache-Control'&&h.value==='private, no-store')));
});
