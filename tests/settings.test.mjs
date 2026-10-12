import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWlocSettings } from '../src/settings.js';
import { resolveWlocSettings } from '../src/state.js';

function store(initial=null) {
  let saved=initial;
  return { read:()=>saved, write(value){saved=JSON.parse(JSON.stringify(value));return true;} };
}
const url=query=>'https://gs-loc.apple.com/wloc-settings/save?'+query;

test('save accepts zero coordinates, boundaries and negative coordinates',()=>{
  for(const [lon,lat] of [[0,51.5],[121,0],[-180,-90],[180,90],[-73.9,40.7]]) {
    const storage=store();
    assert.equal(handleWlocSettings(url(`lon=${lon}&lat=${lat}`),storage).success,true);
    assert.equal(handleWlocSettings(url('action=query'),storage).longitude,lon);
    assert.equal(resolveWlocSettings({},storage.read()).latitude,lat);
  }
});
test('invalid and incomplete input never overwrites saved coordinates',()=>{
  const original={longitude:121,latitude:31};
  for(const query of ['lon=999&lat=999','lon=&lat=0','lat=31','lon=121abc&lat=31','lon=Infinity&lat=0','lon=1&lat=1&acc=0','lon=1&lat=1&acc=1.5','action=unknown']) {
    const storage=store(original);
    assert.equal(handleWlocSettings(url(query),storage).success,false,query);
    assert.deepEqual(storage.read(),original);
  }
});
test('restore overrides manual module parameters and survives queries',()=>{
  const storage=store({longitude:121,latitude:31});
  assert.equal(handleWlocSettings(url('action=clear'),storage).success,true);
  assert.equal(handleWlocSettings(url('action=query'),storage).enabled,false);
  assert.equal(resolveWlocSettings({longitude:120,latitude:30},storage.read()).longitude,null);
  assert.equal(handleWlocSettings(url('lon=0&lat=0'),storage).enabled,true);
  assert.equal(resolveWlocSettings({longitude:120,latitude:30},storage.read()).longitude,0);
});
test('storage failures and stale reads are reported rather than claiming success',()=>{
  for(const action of ['action=clear','lon=1&lat=1']) {
    assert.equal(handleWlocSettings(url(action),{read:()=>({longitude:121,latitude:31}),write:()=>false}).success,false);
    assert.equal(handleWlocSettings(url(action),{read:()=>({longitude:121,latitude:31}),write:()=>true}).success,false);
    assert.equal(handleWlocSettings(url(action),{read(){throw Error('unavailable');},write(){throw Error('unavailable');}}).success,false);
  }
});
test('existing stored coordinates remain supported; default install is passthrough',()=>{
  assert.deepEqual(resolveWlocSettings({}, {longitude:121,latitude:31}).longitude,121);
  assert.equal(resolveWlocSettings({longitude:'113.94114',latitude:'22.544577'}).longitude,null);
  assert.equal(resolveWlocSettings({longitude:'120',latitude:'30'}).longitude,120);
  assert.equal(resolveWlocSettings({}, {longitude:999,latitude:999}).longitude,null);
});
