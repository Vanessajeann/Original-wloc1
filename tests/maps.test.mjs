import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import worker from '../worker/src/index.js';
import standalone from '../worker/wloc-worker.js';
import pages from '../worker/dist/_worker.js';
import { extractFromString, parseCoords, normalizeCoords } from '../worker/src/parse.js';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../worker/src/coords.js';
import { getPageHtml } from '../worker/src/page.js';

test('map providers use their own coordinate ordering and source',()=>{
  const inputs=[
    ['https://maps.apple.com/?coordinate=31.2304%2C121.4737','apple'],
    ['https://uri.amap.com/marker?position=121.4737,31.2304','amap'],
    ['https://www.amap.com/?p=POI,31.2304,121.4737,上海','amap'],
    ['https://www.amap.com/?q=31.2304,121.4737,上海','amap'],
    ['https://www.google.com/maps?q=31.2304,121.4737','google'],
    ['https://www.google.com/maps/place/test/data=!3d31.2304!4d121.4737','google'],
    ['https://map.baidu.com/?location=31.2304,121.4737','baidu']
  ];
  for(const [url,src] of inputs) {
    const result=extractFromString(url);
    assert.deepEqual([result.lat,result.lon,result.src],[31.2304,121.4737,src],url);
  }
});
test('text coordinates are WGS84, zero and signed values are preserved',()=>{
  assert.deepEqual(normalizeCoords(extractFromString('0,-73.9000')),{lat:0,lon:-73.9,name:'',src:'text'});
  assert.throws(()=>extractFromString('121.47,31.23'));
});
test('GCJ conversion is reversible and skipped outside its region',()=>{
  const shifted=wgs84ToGcj02(31.2,121.4);
  const restored=gcj02ToWgs84(shifted.lat,shifted.lon);
  assert.ok(Math.abs(restored.lat-31.2)<1e-8 && Math.abs(restored.lon-121.4)<1e-8);
  assert.deepEqual(gcj02ToWgs84(40.7,-73.9),{lat:40.7,lon:-73.9});
  assert.equal(normalizeCoords(extractFromString('https://maps.apple.com/?ll=31.2304,121.4737'),'none').lat,31.2304);
  assert.equal(normalizeCoords(extractFromString('https://www.google.com/maps?ll=31.2304,121.4737')).lat,31.2304);
});
test('shortlink redirects resolve coordinates and retain provider identity',async()=>{
  let calls=0;
  const result=await parseCoords('上海 https://surl.amap.com/test',async()=>{
    calls++;
    return new Response(null,{status:302,headers:{location:'https://uri.amap.com/marker?position=121.4737,31.2304'}});
  });
  assert.equal(calls,1);
  assert.equal(result.src,'amap');
  assert.equal(result.lat,31.2304);
});
test('untrusted targets and redirects are rejected before they are fetched',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/'}});};
  await assert.rejects(()=>parseCoords('https://evil.example/?ll=1,2',fetcher));
  assert.equal(calls,0);
  await assert.rejects(()=>parseCoords('https://surl.amap.com/test',fetcher));
  assert.equal(calls,1);
  await assert.rejects(()=>parseCoords('http://maps.apple.com/?ll=1,2',fetcher));
  await assert.rejects(()=>parseCoords('https://maps.apple.com:444/?ll=1,2',fetcher));
});
test('oversized shortlink responses fail with a useful error',async()=>{
  await assert.rejects(()=>parseCoords('https://surl.amap.com/test',async()=>new Response('x',{headers:{'Content-Length':'999999'}})),/过大/);
});
test('source Worker, dashboard bundle and Pages bundle expose identical routes',async()=>{
  for(const app of [worker,standalone,pages]) {
    const health=await app.fetch(new Request('https://wloc.test/health'));
    assert.deepEqual(await health.json(),{service:'wloc',version:2});
    const result=await app.fetch(new Request('https://wloc.test/api/parse?format=json&u=0%2C-73.9'));
    assert.equal(result.headers.get('cache-control'),'no-store');
    assert.deepEqual(await result.json(),{lat:0,lon:-73.9,name:''});
    assert.equal((await app.fetch(new Request('https://wloc.test/api/parse?format=json&u=999%2C999'))).status,422);
    assert.equal((await app.fetch(new Request('https://wloc.test/no-such-route'))).status,404);
    assert.equal((await app.fetch(new Request('https://wloc.test/api/parse',{method:'POST'}))).status,405);
  }
});
test('rendered webpage has valid script, backend parser and correct layer conversion',()=>{
  const html=getPageHtml();
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  new vm.Script(scripts);
  const context=vm.createContext({});
  vm.runInContext(scripts.slice(0,scripts.indexOf('const SAVE_API')),context);
  const gcj=context.wgs84ToGcj02(31.2,121.4);
  const restored=context.gcj02ToWgs84(gcj.lat,gcj.lon);
  assert.ok(Math.abs(restored.lat-31.2)<1e-8 && Math.abs(restored.lon-121.4)<1e-8);
  assert.ok(scripts.includes('/api/parse?format=json'));
  assert.ok(scripts.includes('gcj02ToWgs84(newLat,newLon)'));
  assert.ok(html.includes('设备已保存坐标'));
});
