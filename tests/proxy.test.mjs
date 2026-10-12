import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

const settings=fs.readFileSync(new URL('../dist/wloc-settings.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../dist/wloc.js',import.meta.url),'utf8');
const platforms={Surge:{$environment:{'surge-version':'1'}},Loon:{$loon:{}},Stash:{$environment:{'stash-version':'1'}},Shadowrocket:{$rocket:{}},Egern:{Egern:{}},QuantumultX:{$task:{}}};
async function run(source,platform,{query='',saved=null,argument={},response}={}) {
  let value=saved ? JSON.stringify(saved) : null;
  let complete;
  const done=new Promise(resolve=>complete=resolve);
  const context=vm.createContext({...platform,$argument:argument,$script:{startTime:Date.now()},$request:{url:'https://gs-loc.apple.com/'+(response?'clls/wloc':'wloc-settings/save?'+query),method:'GET'},
    $persistentStore:{read:()=>value,write(v){value=v;return true;}},
    $prefs:{valueForKey:()=>value,setValueForKey(v){value=v;return true;}},
    console:{log(){}},$done:complete, ...(response?{$response:response}:{}) });
  vm.runInContext(source,context,{timeout:1000});
  const result=await done;
  return {response:result.response||result,saved:value ? JSON.parse(value):null};
}
function varint(value) {
  let n=BigInt(value),out=[];
  if(n<0n)n=BigInt.asUintN(64,n);
  do {let b=Number(n&127n);n>>=7n;out.push(b|(n?128:0));} while(n);
  return out;
}
const field=(number,value)=>[...varint(number*8),...varint(value)];
const bytes=(number,value)=>[...varint(number*8+2),...varint(value.length),...value];
function fixture(lat,lon) {
  const loc=[...field(1,Math.round(lat*1e8)),...field(2,Math.round(lon*1e8)),...field(3,25)];
  const wifi=[...bytes(1,[...Buffer.from('aa:bb:cc:dd:ee:ff')]),...bytes(2,loc)];
  const payload=bytes(2,wifi);
  return Uint8Array.from([...Array(8).fill(0),payload.length>>8,payload.length&255,...payload]);
}
for(const [name,platform] of Object.entries(platforms)) {
  test(`${name}: settings save/query/restore through generated proxy script`,async()=>{
    const saved=await run(settings,platform,{query:'lon=0&lat=0'});
    assert.equal(JSON.parse(saved.response.body).success,true);
    const queried=await run(settings,platform,{query:'action=query',saved:saved.saved});
    assert.equal(JSON.parse(queried.response.body).longitude,0);
    const cleared=await run(settings,platform,{query:'action=clear',saved:saved.saved});
    assert.equal(cleared.saved.enabled,false);
  });
  test(`${name}: binary WLOC frame is patched using saved zero coordinate`,async()=>{
    const result=await run(core,platform,{saved:{enabled:true,longitude:0,latitude:51.5,accuracy:25},response:{bodyBytes:fixture(31.2,121.4),headers:{}}});
    const actual=result.response.bodyBytes||result.response.body;
    assert.deepEqual(Array.from(new Uint8Array(actual)),Array.from(fixture(51.5,0)));
  });
}
test('Loon receives named object arguments for manual coordinates',async()=>{
  const result=await run(core,platforms.Loon,{argument:{longitude:0,latitude:40,accuracy:25},response:{bodyBytes:fixture(31.2,121.4),headers:{}}});
  assert.deepEqual(Array.from(result.response.bodyBytes),Array.from(fixture(40,0)));
});
test('restore keeps gzip bytes and headers intact even with custom module parameters',async()=>{
  const body=gzipSync(fixture(31.2,121.4));
  const result=await run(core,platforms.Shadowrocket,{saved:{enabled:false},argument:{longitude:120,latitude:30},response:{bodyBytes:body,headers:{'Content-Encoding':'gzip'}}});
  assert.deepEqual(Array.from(result.response.bodyBytes),Array.from(body));
  assert.equal(result.response.headers['Content-Encoding'],'gzip');
});
test('gzip WLOC payload can still be decoded and patched',async()=>{
  const result=await run(core,platforms.Shadowrocket,{saved:{longitude:0,latitude:40},response:{bodyBytes:gzipSync(fixture(31.2,121.4)),headers:{'Content-Encoding':'gzip'}}});
  assert.deepEqual(Array.from(result.response.bodyBytes),Array.from(fixture(40,0)));
  assert.equal(result.response.headers['Content-Encoding'],undefined);
});
