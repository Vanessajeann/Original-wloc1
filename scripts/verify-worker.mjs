import assert from 'node:assert/strict';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

let request;
if (process.argv[2] === '--bundle') {
  const app=(await import(pathToFileURL(path.resolve(process.argv[3])).href)).default;
  request=(suffix)=>app.fetch(new Request('https://wloc.test'+suffix));
} else {
  const base=process.argv[2];
  if (!base || !base.startsWith('https://')) throw new Error('Use --bundle <file> or an HTTPS service URL');
  request=(suffix)=>fetch(new URL(suffix,base),{signal:AbortSignal.timeout(15000),cache:'no-store'});
}
const health=await request('/health');
assert.equal(health.status,200);
assert.deepEqual(await health.json(),{service:'wloc',version:2});
const response=await request('/api/parse?format=json&u=0%2C-73.9');
assert.equal(response.status,200);
assert.deepEqual(await response.json(),{lat:0,lon:-73.9,name:''});
assert.equal((await request('/api/parse?format=json&u=999%2C999')).status,422);
const html=await (await request('/')).text();
assert.ok(html.includes('设备已保存坐标'));
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
new vm.Script(scripts);
const context=vm.createContext({});
vm.runInContext(scripts.slice(0,scripts.indexOf('const SAVE_API')),context);
const shifted=context.wgs84ToGcj02(31.2,121.4);
const result=context.gcj02ToWgs84(shifted.lat,shifted.lon);
assert.ok(Math.abs(result.lat-31.2)<1e-8 && Math.abs(result.lon-121.4)<1e-8);
console.log('PASS: health, valid/invalid coordinate API, rendered script syntax and browser coordinate conversion.');
