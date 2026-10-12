import { getPageHtml } from "./page.js";
import { parseCoords, normalizeCoords } from "./parse.js";

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
