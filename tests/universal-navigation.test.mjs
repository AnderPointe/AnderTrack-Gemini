import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIVERSAL_NAV_GROUPS,UNIVERSAL_NAV_ITEMS,UNIVERSAL_DIVISIONS,
  UNIVERSAL_WORKSPACES,getUniversalNavItem,getUniversalWorkspace,
} from '../src/lib/universal-navigation.js';

test('universal navigation retains every legacy command-center view',()=>{
  const legacy=['overview','delivery-overview','warehouse','class-c','tracking',
    'intelligent-fleet','fleet-health','driver-cockpit','dispatch','dispatch-mode',
    'dispatch-planner','journeys','intelligence','fleet','analytics','settings'];
  for(const id of legacy)assert.equal(getUniversalNavItem(id)?.status,'existing',id);
});

test('universal navigation has unique registered view IDs',()=>{
  assert.equal(new Set(UNIVERSAL_NAV_ITEMS.map(x=>x.id)).size,UNIVERSAL_NAV_ITEMS.length);
  assert.equal(new Set(UNIVERSAL_NAV_GROUPS.map(x=>x.id)).size,UNIVERSAL_NAV_GROUPS.length);
});

test('service task domains remain in the correct operational divisions',()=>{
  for(const [id,group] of [
    ['freight-3pl','freight'],['hotshot','hotshot'],
    ['local-courier','local-services'],['food-delivery','local-services'],
    ['passenger-services','local-services']
  ]) {
    assert.equal(getUniversalNavItem(id)?.groupId,group,id);
    assert.equal(getUniversalNavItem(id)?.status,id==='hotshot'?'planned':'existing',id);
    assert.ok(getUniversalWorkspace(id),id);
  }
  assert.equal(getUniversalNavItem('waste-services')?.groupId,'collection');
});

test('division cards link to known workspaces and architecture links exist',()=>{
  assert.equal(UNIVERSAL_DIVISIONS.length,6);
  for(const division of UNIVERSAL_DIVISIONS) assert.ok(getUniversalNavItem(division.id));
  for(const [id,workspace] of Object.entries(UNIVERSAL_WORKSPACES)){
    assert.equal(getUniversalNavItem(id)?.status,id==='hotshot'?'planned':'existing');
    assert.ok(workspace.capabilities.length);
    for(const link of workspace.links)assert.equal(getUniversalNavItem(link.id)?.status,'existing');
  }
});

test('unknown workspace and navigation IDs fail closed',()=>{
  assert.equal(getUniversalWorkspace('__unknown__'),null);
  assert.equal(getUniversalNavItem('__unknown__'),null);
});


test('command center imports and renders the universal navigation with safe planned views', async()=>{
  const {readFileSync}=await import('node:fs');
  const body=readFileSync(new URL('../src/features/live/OpsCommandCenter.jsx',import.meta.url),'utf8');
  assert.match(body,/UNIVERSAL_NAV_GROUPS\.map/);
  assert.match(body,/UniversalDivisionLaunchpad/);
  assert.match(body,/UniversalDivisionWorkspace/);
  assert.match(body,/getUniversalWorkspace\(view\)/);
});
