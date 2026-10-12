// Generated from worker/src/. Do not edit directly.
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function gcjOutOfChina(lng, la) {
  return lng < 72.004 || lng > 137.8347 || la < 0.8293 || la > 55.8271;
}

function gcjDeltaLat(x, y) {
  let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  r += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return r;
}

function gcjDeltaLon(x, y) {
  let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  r += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return r;
}

// WGS84 -> GCJ-02 (正向偏移), 与高德/苹果中国所用偏移一致。
function wgs84ToGcj02(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let dLat = gcjDeltaLat(lon - 105.0, lat - 35.0);
  let dLon = gcjDeltaLon(lon - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLon = (dLon * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lon: lon + dLon };
}

// GCJ-02 -> WGS84 (迭代反算, 亚米级)。
// 单程反算在偏移梯度大的地区会残留 1~2m, 这里用不动点迭代收敛到 <0.1m,
// 与高德自身的 WGS84->GCJ 逆运算严格对齐, 消除回看时的残差。
function gcj02ToWgs84(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let wgsLat = lat;
  let wgsLon = lon;
  for (let i = 0; i < 6; i++) {
    const g = wgs84ToGcj02(wgsLat, wgsLon);
    const errLat = g.lat - lat;
    const errLon = g.lon - lon;
    if (Math.abs(errLat) < 1e-9 && Math.abs(errLon) < 1e-9) break;
    wgsLat -= errLat;
    wgsLon -= errLon;
  }
  return { lat: wgsLat, lon: wgsLon };
}

function validateCoords(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw new Error('经纬度超出有效范围');
  return { lat, lon };
}
function getCoordinateHelpers() {
  return 'const GCJ_A=6378245.0, GCJ_EE=0.00669342162296594323;\n' + [gcjOutOfChina,gcjDeltaLat,gcjDeltaLon,wgs84ToGcj02,gcj02ToWgs84].map(fn=>fn.toString()).join('\n');
}


const MAP_HOSTS = ["maps.apple.com", "maps.apple", "amap.com", "gaode.com", "maps.google.com", "www.google.com", "maps.google.cn", "www.google.cn", "maps.app.goo.gl", "goo.gl", "map.baidu.com"];

function safeDecode(value) {
  try { return decodeURIComponent(String(value).replace(/\+/g, " ")); } catch { return String(value); }
}

function sourceFor(url) {
  const host = url.hostname.toLowerCase();
  if (host === "maps.apple.com" || host === "maps.apple") return "apple";
  if (host === "amap.com" || host.endsWith(".amap.com") || host === "gaode.com" || host.endsWith(".gaode.com")) return "amap";
  if (host === "map.baidu.com" || host.endsWith(".map.baidu.com")) return "baidu";
  return "google";
}

function allowedMapUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !MAP_HOSTS.some(domain => host === domain || (["amap.com","gaode.com","map.baidu.com"].includes(domain) && host.endsWith("."+domain)))) {
    throw new Error("仅支持 HTTPS 苹果、Google、高德和百度地图链接");
  }
  return url;
}

function pair(value) {
  const match = String(value ?? "").match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[,，]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:,.*)?$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function extractFromString(input) {
  const text = String(input).trim();
  if (!/^https?:/i.test(text)) {
    const coords = pair(text);
    if (!coords) return null;
    return { ...validateCoords(coords[0], coords[1]), name: "", src: "text" };
  }
  const url = allowedMapUrl(text);
  const src = sourceFor(url);
  const query = url.searchParams;
  let coords;
  let name = query.get("name") || query.get("title") || "";
  if (src === "apple") {
    coords = pair(query.get("coordinate") || query.get("ll") || query.get("sll"));
    name ||= query.get("q") || "";
  } else if (src === "amap") {
    const position = pair(query.get("position") || query.get("lnglat") || query.get("center"));
    if (position) coords = [position[1], position[0]];
    if (!coords && query.get("p")) {
      const values = query.get("p").split(",");
      coords = pair(values.slice(1,3).join(","));
      name ||= values[3] || "";
    }
    if (!coords) {
      coords = pair(query.get("q"));
      name ||= query.get("q")?.split(",").slice(2).join(",") || "";
    }
  } else if (src === "baidu") {
    coords = pair(query.get("location"));
    // Baidu links without explicit location are not guessed from viewport values.
  } else {
    const point = url.href.match(/!3d([+-]?[\d.]+)!4d([+-]?[\d.]+)/);
    const view = url.pathname.match(/@([+-]?[\d.]+),([+-]?[\d.]+)/);
    coords = point ? [Number(point[1]),Number(point[2])] : pair(query.get("query") || query.get("q") || query.get("ll"));
    if (!coords && view) coords = [Number(view[1]),Number(view[2])];
  }
  return coords ? { ...validateCoords(coords[0],coords[1]), name: name.slice(0,200), src } : null;
}

async function readLimited(response, maxBytes = 262144) {
  if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("地图响应过大，请分享带坐标的链接");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("地图响应过大，请分享带坐标的链接");
      text += decoder.decode(value,{stream:true});
    }
  } finally { await reader.cancel().catch(()=>{}); }
}

async function parseCoords(raw, fetcher = fetch) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("请粘贴地图链接或纬度,经度");
  if (text.length > 8192) throw new Error("链接或文本过长");
  const urlMatch = text.match(/https?:\/\/[^\s'"<>，。]+/i);
  if (!urlMatch) {
    const hit = extractFromString(text);
    if (hit) return hit;
    throw new Error("坐标文本请使用 纬度,经度 格式");
  }
  let current = allowedMapUrl(urlMatch[0]);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),8000);
  try {
    for (let index=0;index<5;index++) {
      const direct = extractFromString(current.href);
      if (direct) return direct;
      const response = await fetcher(current.href,{
        redirect:"manual", signal:controller.signal,
        headers:{"User-Agent":"WLOC-Map-Parser/1.0","Accept":"text/html"}
      });
      const redirect = response.headers.get("location");
      if (redirect) {
        await response.body?.cancel().catch(()=>{});
        current = allowedMapUrl(new URL(redirect,current).href);
        continue;
      }
      if (!response.ok) throw new Error("地图服务暂时不可用，请使用带坐标的完整链接");
      const body = await readLimited(response);
      // Read only explicit map URLs, rather than unrelated numbers in an HTML page.
      const links = body.replace(/&amp;/g,"&").match(/https?:\/\/[^\s'"<>]+/g) || [];
      for (const link of links.slice(0,30)) {
        try { const hit=extractFromString(link); if(hit) return hit; } catch {}
      }
      break;
    }
    throw new Error("未找到坐标，请长按地图选点后分享，或输入纬度,经度");
  } catch (error) {
    if (controller.signal.aborted) throw new Error("地图链接解析超时，请使用完整链接");
    throw error;
  } finally { clearTimeout(timer); }
}

function bd09ToGcj02(lat,lon) {
  const x=lon-0.0065, y=lat-0.006;
  const z=Math.sqrt(x*x+y*y)-0.00002*Math.sin(y*Math.PI*3000/180);
  const theta=Math.atan2(y,x)-0.000003*Math.cos(x*Math.PI*3000/180);
  return {lat:z*Math.sin(theta),lon:z*Math.cos(theta)};
}

function normalizeCoords(result, cs = "auto") {
  if (!["auto","gcj","none"].includes(cs)) throw new Error("不支持的坐标系");
  let {lat,lon} = result;
  validateCoords(lat,lon);
  if (cs !== "none" && result.src === "baidu") ({lat,lon}=bd09ToGcj02(lat,lon));
  if (cs === "gcj" || (cs === "auto" && ["amap","apple","baidu"].includes(result.src))) ({lat,lon}=gcj02ToWgs84(lat,lon));
  return { ...result, ...validateCoords(round6(lat),round6(lon)) };
}

function round6(value) { return Math.round(Number(value)*1e6)/1e6; }


function getPageHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>WLOC 虚拟定位</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="WLOC">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
:root { --blue:#007aff; --green:#34c759; --red:#ff3b30; --gray:#8e8e93; --bg:#f2f2f7; --orange:#ff9500; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,system-ui,"SF Pro","Helvetica Neue",sans-serif; background:var(--bg); }
#map { height:50vh; width:100%; min-height:250px; }
.panel { padding:16px; max-width:600px; margin:0 auto; }
.card { background:#fff; border-radius:12px; padding:16px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
.card h3 { font-size:15px; font-weight:600; margin-bottom:10px; }
.coords { font-family:"SF Mono",monospace; font-size:14px; color:#333; padding:8px 12px; background:var(--bg); border-radius:8px; word-break:break-all; }
.row { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
.btn { flex:1; min-width:100px; padding:12px 16px; border:none; border-radius:10px; font-size:14px; font-weight:500; cursor:pointer; transition:all .15s; }
.btn-primary { background:var(--blue); color:#fff; }
.btn-primary:active { background:#005bb5; transform:scale(.97); }
.btn-secondary { background:#e5e5ea; color:#333; }
.btn-secondary:active { background:#d1d1d6; transform:scale(.97); }
.btn-danger { background:var(--red); color:#fff; }
.btn-danger:active { background:#d63027; transform:scale(.97); }
.btn.success { background:var(--green); color:#fff; }
.btn-sm { flex:none; min-width:auto; padding:6px 12px; font-size:12px; border-radius:8px; }
.input-row { display:flex; gap:8px; margin-top:10px; }
.input-row input { flex:1; padding:10px 12px; border:1px solid #d1d1d6; border-radius:8px; font-size:14px; outline:none; min-width:0; }
.input-row input:focus { border-color:var(--blue); }
.status { font-size:12px; color:var(--gray); margin-top:8px; text-align:center; }
.error-banner { background:var(--red); color:#fff; padding:14px 16px; border-radius:12px; margin-bottom:12px; font-size:14px; line-height:1.5; display:none; }
.error-banner b { display:block; margin-bottom:4px; }
.toast { position:fixed; top:60px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.8); color:#fff; padding:10px 20px; border-radius:20px; font-size:14px; opacity:0; transition:opacity .3s; pointer-events:none; z-index:9999; max-width:90vw; text-align:center; }
.toast.show { opacity:1; }
.active-loc { background:var(--bg); border-radius:8px; padding:10px 12px; font-size:13px; color:#333; }
.active-loc .label { font-size:11px; color:var(--gray); margin-bottom:4px; }
.active-loc .value { font-family:"SF Mono",monospace; font-size:13px; }
.fav-list { max-height:240px; overflow-y:auto; }
.fav-item { display:flex; align-items:center; gap:8px; padding:10px 12px; background:var(--bg); border-radius:8px; margin-bottom:6px; cursor:pointer; transition:background .15s; }
.fav-item:active { background:#e0e0e5; }
.fav-item .fav-info { flex:1; min-width:0; }
.fav-item .fav-name { font-size:14px; font-weight:500; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fav-item .fav-coords { font-size:11px; color:var(--gray); font-family:"SF Mono",monospace; margin-top:2px; }
.fav-item .fav-active { font-size:10px; color:var(--green); font-weight:600; }
.fav-item .fav-del { flex:none; width:28px; height:28px; border:none; border-radius:50%; background:transparent; color:var(--red); font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; }
.fav-item .fav-del:hover { background:rgba(255,59,48,.1); }
.fav-empty { text-align:center; color:var(--gray); font-size:13px; padding:16px 0; }
.fav-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.fav-header h3 { margin-bottom:0; }
.modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,.4); z-index:10000; display:none; align-items:center; justify-content:center; padding:20px; }
.modal-overlay.show { display:flex; }
.modal { background:#fff; border-radius:16px; padding:20px; width:100%; max-width:340px; }
.modal h3 { font-size:17px; font-weight:600; margin-bottom:16px; text-align:center; }
.modal input { width:100%; padding:12px; border:1px solid #d1d1d6; border-radius:10px; font-size:15px; outline:none; margin-bottom:12px; }
.modal input:focus { border-color:var(--blue); }
.modal .modal-btns { display:flex; gap:8px; }
.modal .modal-btns .btn { padding:12px; }
.layer-switch { position:absolute; top:10px; right:10px; z-index:1000; display:flex; gap:4px; background:rgba(255,255,255,.92); border-radius:8px; padding:4px; box-shadow:0 2px 8px rgba(0,0,0,.15); }
.layer-btn { border:none; background:transparent; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:500; color:#333; cursor:pointer; transition:all .15s; white-space:nowrap; }
.layer-btn.active { background:var(--blue); color:#fff; }
.layer-btn:active { transform:scale(.95); }
@media(max-width:480px) { #map { height:44vh; } .panel { padding:12px; } .layer-btn { padding:5px 7px; font-size:11px; } }
</style>
</head>
<body>
<div style="position:relative">
<div id="map"></div>
<div class="layer-switch">
  <button class="layer-btn active" data-layer="satellite" onclick="switchLayer('satellite')">卫星</button>
  <button class="layer-btn" data-layer="wgs84" onclick="switchLayer('wgs84')">WGS84</button>
  <button class="layer-btn" data-layer="amap" onclick="switchLayer('amap')">高德</button>
  <button class="layer-btn" data-layer="voyager" onclick="switchLayer('voyager')">彩色</button>
  <button class="layer-btn" data-layer="standard" onclick="switchLayer('standard')">标准</button>
  <button class="layer-btn" data-layer="dark" onclick="switchLayer('dark')">暗色</button>
</div>
</div>
<div class="panel">
  <div class="card">
    <h3>开始使用</h3>
    <p style="font-size:13px;line-height:1.7">先安装并启用代理模块，开启 MITM 并信任证书，再选择位置保存。</p>
    <p style="font-size:13px;margin-top:8px"><a href="https://github.com/Vanessajeann/Original-wloc1#快速开始" target="_blank" rel="noopener">安装模块和使用说明</a> · <a href="https://github.com/Vanessajeann/Original-wloc1/issues" target="_blank" rel="noopener">反馈问题</a></p>
  </div>
  <div class="error-banner" id="errorBanner">
    <b>模块未生效</b>
    请检查以下配置：<br>
    1. 已安装并启用 WLOC 定位模块<br>
    2. MITM 已开启且信任证书<br>
    3. MITM 主机名包含 gs-loc.apple.com<br>
    4. 当前网络已走代理
  </div>
  <div class="card">
    <h3>选择目标位置</h3>
    <div class="coords" id="coords">点击地图或使用下方工具选择位置</div>
    <div class="row">
      <button class="btn btn-primary" id="saveBtn" onclick="save()">储存到设备</button>
      <button class="btn btn-secondary" onclick="addFav()">收藏位置</button>
      <button class="btn btn-secondary" onclick="locateMe()">当前位置</button>
    </div>
  </div>
  <div class="card">
    <div class="fav-header">
      <h3>收藏的位置</h3>
      <button class="btn btn-sm btn-secondary" onclick="clearAllFav()" id="clearAllBtn" style="display:none">清空全部</button>
    </div>
    <div id="favList" class="fav-list"></div>
  </div>
  <div class="card">
    <h3>设备已保存坐标</h3>
    <div class="active-loc" id="activeLoc">
      <div class="label">由当前代理工具保存，系统是否采用需另行验证</div>
      <div class="value" id="activeValue">查询中...</div>
    </div>
    <div class="row">
      <button class="btn btn-sm btn-secondary" onclick="queryActive()">刷新</button>
      <button class="btn btn-sm btn-danger" onclick="clearActive()">恢复真实定位</button>
    </div>
  </div>
  <div class="card">
    <h3>粘贴地图链接</h3>
    <div class="input-row">
      <input id="urlInput" placeholder="地图分享链接 或 纬度,经度" />
      <button class="btn btn-secondary" style="flex:none;min-width:56px" onclick="parseUrl()">解析</button>
    </div>
    <div style="font-size:11px;color:var(--gray);margin-top:6px">支持带坐标的苹果、Google、高德链接及百度 location 链接；短链由服务解析，无法解析时请输入纬度,经度</div>
  </div>
  <div class="card">
    <h3>搜索地点</h3>
    <div class="input-row">
      <input id="searchInput" placeholder="输入地名（如: 上海外滩）" />
      <button class="btn btn-secondary" style="flex:none;min-width:56px" onclick="searchPlace()">搜索</button>
    </div>
  </div>
  <div class="status" id="status">选好位置后点击「储存到设备」写入代理工具</div>
</div>
<div class="toast" id="toast"></div>
<div class="modal-overlay" id="favModal">
  <div class="modal">
    <h3>收藏此位置</h3>
    <input id="favNameInput" placeholder="输入备注名称（如: 公司、家）" maxlength="30" />
    <div style="font-size:12px;color:var(--gray);margin-bottom:12px;text-align:center" id="favModalCoords"></div>
    <div class="modal-btns">
      <button class="btn btn-secondary" onclick="closeFavModal()">取消</button>
      <button class="btn btn-primary" onclick="confirmFav()">保存</button>
    </div>
  </div>
</div>
<script>
${getCoordinateHelpers()}
const SAVE_API = 'https://gs-loc.apple.com/wloc-settings/save';
const FAV_KEY = 'wloc_favorites';
let lat = 22.544577, lon = 113.94114;
let selected = false;
let activeLon = null, activeLat = null;

const map = L.map('map').setView([lat, lon], 13);
const tiles = {
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'ArcGIS'}),
  wgs84: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'ArcGIS WGS84'}),
  standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'\\u00a9 OSM'}),
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {maxZoom:19, attribution:'\\u00a9 Carto'}),
  amap: L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {maxZoom:18, subdomains:'1234', attribution:'\\u00a9 高德'}),
  voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {maxZoom:19, attribution:'\\u00a9 Carto'})
};
let currentLayerName = 'satellite';
let currentLayer = tiles.satellite;
currentLayer.addTo(map);
function displayCoords(newLat, newLon) {
  return currentLayerName === 'amap' ? wgs84ToGcj02(newLat,newLon) : {lat:newLat,lon:newLon};
}
function switchLayer(name) {
  const center = map.getCenter();
  const wgsCenter = currentLayerName === 'amap' ? gcj02ToWgs84(center.lat,center.lng) : {lat:center.lat,lon:center.lng};
  map.removeLayer(currentLayer);
  currentLayerName = name;
  currentLayer = tiles[name];
  currentLayer.addTo(map);
  const target=displayCoords(wgsCenter.lat,wgsCenter.lon);
  map.setView([target.lat,target.lon],map.getZoom());
  const point=displayCoords(lat,lon);
  marker.setLatLng([point.lat,point.lon]);
  document.querySelectorAll('.layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === name));
}
let marker = L.marker([lat, lon], {draggable:true}).addTo(map);

function setMapPos(newLat,newLon) {
  const point=currentLayerName === 'amap' ? gcj02ToWgs84(newLat,newLon) : {lat:newLat,lon:newLon};
  setPos(point.lat,point.lon);
}
marker.on('dragend', e => { const p=e.target.getLatLng(); setMapPos(p.lat, p.lng); });
map.on('click', e => { setMapPos(e.latlng.lat, e.latlng.lng); });

function setPos(newLat, newLon) {
  if (!Number.isFinite(newLat) || !Number.isFinite(newLon) || Math.abs(newLat)>90 || Math.abs(newLon)>180) throw new Error('无效经纬度');
  lat = newLat; lon = newLon; selected = true;
  const point=displayCoords(lat,lon);
  marker.setLatLng([point.lat,point.lon]);
  document.getElementById('coords').textContent = '经度 ' + lon.toFixed(6) + '  纬度 ' + lat.toFixed(6) + '（WGS84）';
}

function moveTo(newLat, newLon, zoom) {
  setPos(newLat, newLon);
  const point=displayCoords(lat,lon);
  map.setView([point.lat,point.lon], zoom || 15);
}

function toast(msg, ms) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms || 2500);
}

function showError(show) {
  document.getElementById('errorBanner').style.display = show ? 'block' : 'none';
}

/* ---- Favorites (localStorage) ---- */
function getFavs() {
  try { const items=JSON.parse(localStorage.getItem(FAV_KEY)); return Array.isArray(items) ? items.filter(f=>typeof f.name==='string' && Number.isFinite(f.lat) && Number.isFinite(f.lon) && Math.abs(f.lat)<=90 && Math.abs(f.lon)<=180) : []; } catch(e) { return []; }
}
function saveFavs(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

function renderFavs() {
  const favs = getFavs();
  const el = document.getElementById('favList');
  const clearBtn = document.getElementById('clearAllBtn');
  clearBtn.style.display = favs.length ? '' : 'none';
  if (!favs.length) {
    el.innerHTML = '<div class="fav-empty">暂无收藏，选好位置后点击「收藏位置」</div>';
    return;
  }
  el.innerHTML = favs.map((f, i) => {
    const isActive = activeLon !== null && Math.abs(f.lon - activeLon) < 0.000001 && Math.abs(f.lat - activeLat) < 0.000001;
    return '<div class="fav-item" onclick="loadFav(' + i + ')">' +
      '<div class="fav-info">' +
        '<div class="fav-name">' + escHtml(f.name) + '<\\/div>' +
        '<div class="fav-coords">' + f.lon.toFixed(6) + ', ' + f.lat.toFixed(6) + '<\\/div>' +
        (isActive ? '<div class="fav-active">\\u2713 设备已保存<\\/div>' : '') +
      '<\\/div>' +
      '<button class="fav-del" onclick="event.stopPropagation();delFav(' + i + ')" title="删除">\\u00d7<\\/button>' +
    '<\\/div>';
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addFav() {
  if (!selected) { toast('请先在地图上选择一个位置'); return; }
  document.getElementById('favModalCoords').textContent = lon.toFixed(6) + ', ' + lat.toFixed(6);
  document.getElementById('favNameInput').value = '';
  document.getElementById('favModal').classList.add('show');
  setTimeout(() => document.getElementById('favNameInput').focus(), 100);
}

function closeFavModal() {
  document.getElementById('favModal').classList.remove('show');
}

function confirmFav() {
  const name = document.getElementById('favNameInput').value.trim();
  if (!name) { toast('请输入备注名称'); return; }
  const favs = getFavs();
  favs.push({ name, lon, lat, time: new Date().toISOString() });
  saveFavs(favs);
  closeFavModal();
  renderFavs();
  toast('已收藏: ' + name);
}

function loadFav(i) {
  const favs = getFavs();
  if (!favs[i]) return;
  moveTo(favs[i].lat, favs[i].lon, 15);
  toast(favs[i].name + ' (' + favs[i].lon.toFixed(4) + ', ' + favs[i].lat.toFixed(4) + ')');
}

function delFav(i) {
  const favs = getFavs();
  if (!favs[i]) return;
  const name = favs[i].name;
  favs.splice(i, 1);
  saveFavs(favs);
  renderFavs();
  toast('已删除: ' + name);
}

function clearAllFav() {
  if (!confirm('确定清空所有收藏？')) return;
  saveFavs([]);
  renderFavs();
  toast('已清空所有收藏');
}

/* ---- Active location query ---- */
function queryActive() {
  const el = document.getElementById('activeValue');
  el.textContent = '查询中...';
  fetch(SAVE_API + '?action=query', { method:'GET', mode:'cors', cache:'no-store' })
    .then(r => r.json())
    .then(d => {
      if (!d.success) throw new Error(d.error || '查询失败');
      if (d.enabled !== false && Number.isFinite(d.longitude) && Number.isFinite(d.latitude)) {
        activeLon = parseFloat(d.longitude);
        activeLat = parseFloat(d.latitude);
        el.textContent = '经度 ' + activeLon.toFixed(6) + '  纬度 ' + activeLat.toFixed(6) + (d.accuracy ? '  精度 ' + d.accuracy + 'm' : '');
        renderFavs();
      } else {
        activeLon = null; activeLat = null;
        el.textContent = '定位覆盖已关闭或尚未保存位置';
        renderFavs();
      }
    })
    .catch(() => {
      el.textContent = '查询失败 (需要代理模块支持)';
    });
}

function clearActive() {
  if (!confirm('恢复真实定位并关闭定位覆盖？系统已有缓存可能需要重新触发定位或重启设备。')) return;
  fetch(SAVE_API + '?action=clear', { method:'GET', mode:'cors', cache:'no-store' })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        activeLon = null; activeLat = null;
        document.getElementById('activeValue').textContent = '定位覆盖已关闭';
        renderFavs();
        toast('定位覆盖已关闭；请在地图中验证');
      } else { toast('清除失败: ' + (d.error || ''), 3000); }
    })
    .catch(() => { toast('清除失败 - 请检查模块配置', 3000); });
}

/* ---- Save to device ---- */
async function save() {
  if (!selected) { toast('请先在地图上选择一个位置'); return; }
  const savedLon=lon, savedLat=lat;
  const btn = document.getElementById('saveBtn');
  btn.textContent = '储存中...'; btn.disabled = true;
  showError(false);
  try {
    const r = await fetch(SAVE_API + '?lon=' + savedLon + '&lat=' + savedLat + '&acc=25', {
      method: 'GET', mode: 'cors', cache: 'no-store'
    });
    const d = await r.json();
    if (d.success) {
      activeLon = savedLon; activeLat = savedLat;
      btn.textContent = '\\u2713 已储存'; btn.className = 'btn btn-primary success';
      document.getElementById('status').textContent = '\\u2713 已写入: ' + lon.toFixed(6) + ', ' + lat.toFixed(6) + ' \\u00b7 ' + new Date().toLocaleTimeString('zh-CN');
      document.getElementById('activeValue').textContent = '经度 ' + lon.toFixed(6) + '  纬度 ' + lat.toFixed(6) + '  精度 25m';
      renderFavs();
      toast('\\u2713 坐标已写入设备，请在地图中验证');
      setTimeout(() => { btn.textContent='储存到设备'; btn.className='btn btn-primary'; btn.disabled=false; }, 2500);
    } else {
      throw new Error(d.error || '写入失败');
    }
  } catch(e) {
    btn.textContent = '储存到设备'; btn.className = 'btn btn-primary'; btn.disabled = false;
    showError(true);
    toast('\\u2717 储存失败 - 请检查模块配置', 4000);
  }
}

function locateMe() {
  if (!navigator.geolocation) return toast('浏览器不支持定位');
  toast('获取位置中...');
  navigator.geolocation.getCurrentPosition(
    pos => { moveTo(pos.coords.latitude, pos.coords.longitude, 16); toast('已获取当前位置'); },
    err => toast('定位失败: ' + err.message, 3000),
    { enableHighAccuracy:true, timeout:10000 }
  );
}

async function parseUrl() {
  const input = document.getElementById('urlInput').value.trim();
  if (!input) return toast('请粘贴地图链接或纬度,经度');
  toast('解析中...');
  try {
    const response=await fetch('/api/parse?format=json&u='+encodeURIComponent(input),{cache:'no-store'});
    const result=await response.json();
    if (!response.ok || result.error) throw new Error(result.error || '解析失败');
    moveTo(result.lat,result.lon,15);
    toast('已解析: '+result.lon.toFixed(6)+', '+result.lat.toFixed(6));
  } catch(error) { toast(error.message || '解析失败',4000); }
}

async function searchPlace() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return toast('请输入地名');
  toast('搜索中...');
  try {
    const r = await fetch('https://photon.komoot.io/api/?limit=1&q='+encodeURIComponent(q));
    if (!r.ok) throw new Error('搜索服务不可用');
    const data = await r.json();
    const results = data.features || [];
    if (!results.length) { toast('未找到: ' + q, 3000); return; }
    const p = results[0];
    moveTo(Number(p.geometry.coordinates[1]), Number(p.geometry.coordinates[0]), 15);
    toast(String(p.properties.name || q).slice(0,40));
  } catch(e) { toast('搜索失败', 3000); }
}

document.addEventListener('paste', e => {
  const text = (e.clipboardData||window.clipboardData).getData('text');
  if (text && (text.includes('map') || text.includes('loc') || text.includes('lnglat') || /[0-9]+\\.[0-9]+/.test(text))) {
    document.getElementById('urlInput').value = text;
    setTimeout(parseUrl, 200);
  }
});
document.getElementById('searchInput').addEventListener('keydown', e => { if(e.key==='Enter') searchPlace(); });
document.getElementById('urlInput').addEventListener('keydown', e => { if(e.key==='Enter') parseUrl(); });
document.getElementById('favNameInput').addEventListener('keydown', e => { if(e.key==='Enter') confirmFav(); });

renderFavs();
queryActive();
<\/script>
</body>
</html>`;
}


const API_HEADERS = {
  "Content-Type":"application/json; charset=utf-8",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET, OPTIONS",
  "Cache-Control":"no-store"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:API_HEADERS});
    if (request.method !== "GET") return new Response("Method not allowed",{status:405,headers:{Allow:"GET, OPTIONS"}});
    if (url.pathname === "/") return new Response(getPageHtml(),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}});
    if (url.pathname === "/health") return new Response(JSON.stringify({service:"wloc",version:2}),{headers:API_HEADERS});
    if (url.pathname !== "/api/parse") return new Response("Not found",{status:404});
    try {
      const result = normalizeCoords(await parseCoords(url.searchParams.get("u") || ""),url.searchParams.get("cs") || "auto");
      if (url.searchParams.get("format") === "json") return new Response(JSON.stringify({lat:result.lat,lon:result.lon,name:result.name}),{headers:API_HEADERS});
      return new Response(`lat=${result.lat}&lon=${result.lon}`,{headers:{...API_HEADERS,"Content-Type":"text/plain; charset=utf-8"}});
    } catch (error) {
      return new Response(JSON.stringify({error:error.message || "解析失败"}),{status:422,headers:API_HEADERS});
    }
  }
};
