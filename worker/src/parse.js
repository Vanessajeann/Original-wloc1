import { gcj02ToWgs84, validateCoords } from "./coords.js";

const MAP_HOSTS = ["maps.apple.com", "maps.apple", "amap.com", "gaode.com", "maps.google.com", "www.google.com", "maps.google.cn", "www.google.cn", "maps.app.goo.gl", "goo.gl", "map.baidu.com"];

export function safeDecode(value) {
  try { return decodeURIComponent(String(value).replace(/\+/g, " ")); } catch { return String(value); }
}

function sourceFor(url) {
  const host = url.hostname.toLowerCase();
  if (host === "maps.apple.com" || host === "maps.apple") return "apple";
  if (host === "amap.com" || host.endsWith(".amap.com") || host === "gaode.com" || host.endsWith(".gaode.com")) return "amap";
  if (host === "map.baidu.com" || host.endsWith(".map.baidu.com")) return "baidu";
  return "google";
}

export function allowedMapUrl(value) {
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

export function extractFromString(input) {
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

export async function parseCoords(raw, fetcher = fetch) {
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

export function normalizeCoords(result, cs = "auto") {
  if (!["auto","gcj","none"].includes(cs)) throw new Error("不支持的坐标系");
  let {lat,lon} = result;
  validateCoords(lat,lon);
  if (cs !== "none" && result.src === "baidu") ({lat,lon}=bd09ToGcj02(lat,lon));
  if (cs === "gcj" || (cs === "auto" && ["amap","apple","baidu"].includes(result.src))) ({lat,lon}=gcj02ToWgs84(lat,lon));
  return { ...result, ...validateCoords(round6(lat),round6(lon)) };
}

export function round6(value) { return Math.round(Number(value)*1e6)/1e6; }
