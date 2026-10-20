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

test('planned domains are nested in correct navigation groups',()=>{
  for(const [id,group] of [
    ['freight-3pl','freight'],['hotshot','hotshot'],
    ['local-courier','local-services'],['food-delivery','local-services'],
    ['passenger-services','local-services']
  ]) {
    assert.equal(getUniversalNavItem(id)?.groupId,group,id);
    assert.equal(getUniversalNavItem(id)?.status,'planned',id);
    assert.ok(getUniversalWorkspace(id),id);
  }
});

test('division cards link to known workspaces and architecture links exist',()=>{
  assert.equal(UNIVERSAL_DIVISIONS.length,6);
  for(const division of UNIVERSAL_DIVISIONS) assert.ok(getUniversalNavItem(division.id));
  for(const [id,workspace] of Object.entries(UNIVERSAL_WORKSPACES)){
    assert.equal(getUniversalNavItem(id)?.status,'planned');
    assert.ok(workspace.capabilities.length);
    for(const link of workspace.links)assert.equal(getUniversalNavItem(link.id)?.status,'existing');
  }
});

test('unknown workspace and navigation IDs fail closed',()=>{
  assert.equal(getUniversalWorkspace('__unknown__'),null);
  assert.equal(getUniversalNavItem('__unknown__'),null);
});
