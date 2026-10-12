// Generated from src/state.js and src/settings.js. Run node scripts/build.mjs.
(() => {
const WLOC_SETTINGS_KEY = "wloc_settings";

function wlocNumber(value, limit) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function wlocAccuracy(value = 25) {
  const accuracy = Number(value);
  return Number.isInteger(accuracy) && accuracy > 0 && accuracy <= 100000 ? accuracy : null;
}

function resolveWlocSettings(argument = {}, saved = null) {
  const result = { longitude: null, latitude: null, accuracy: 25, logLevel: argument.logLevel || argument.LogLevel || "info" };
  // A restore action overrides even manually configured module coordinates.
  if (saved?.enabled === false) return result;
  const settings = saved && typeof saved === "object" ? saved : argument;
  const longitude = wlocNumber(settings.longitude, 180);
  const latitude = wlocNumber(settings.latitude, 90);
  const accuracy = wlocAccuracy(settings.accuracy ?? 25);
  if (longitude === null || latitude === null || accuracy === null) return result;
  // Preserve the previous install's default-coordinate passthrough behavior.
  if (!saved && longitude === 113.94114 && latitude === 22.544577) return result;
  return { ...result, longitude, latitude, accuracy };
}


function wlocQuery(url) {
  const result = new Map();
  const query = String(url).split("?")[1]?.split("#")[0] || "";
  for (const part of query.split("&")) {
    if (!part) continue;
    const index = part.indexOf("=");
    const key = decodeURIComponent(index < 0 ? part : part.slice(0, index));
    const value = decodeURIComponent((index < 0 ? "" : part.slice(index + 1)).replace(/\+/g, " "));
    if (!result.has(key)) result.set(key, value);
  }
  // Proxy engines do not all provide the browser URL/URLSearchParams globals.
  return { get: (key) => result.has(key) ? result.get(key) : null };
}

function handleWlocSettings(url, storage, now = () => new Date().toISOString()) {
  const reply = (data) => ({ service: "wloc-settings", version: 2, ...data });
  try {
    const query = wlocQuery(url);
    const action = query.get("action") || "save";
    if (action === "query") {
      const saved = storage.read();
      if (saved?.enabled === false) return reply({ success: true, enabled: false, updatedAt: saved.updatedAt });
      const longitude = wlocNumber(saved?.longitude, 180);
      const latitude = wlocNumber(saved?.latitude, 90);
      if (longitude === null || latitude === null) return reply({ success: true, enabled: false });
      return reply({ success: true, enabled: true, longitude, latitude, accuracy: wlocAccuracy(saved.accuracy) ?? 25, updatedAt: saved.updatedAt ?? null });
    }
    if (action !== "save" && action !== "clear") return reply({ success: false, error: "不支持的操作" });
    let state;
    if (action === "clear") {
      state = { enabled: false, updatedAt: now() };
    } else {
      const longitude = wlocNumber(query.get("lon") ?? query.get("longitude"), 180);
      const latitude = wlocNumber(query.get("lat") ?? query.get("latitude"), 90);
      const accuracy = wlocAccuracy(query.get("acc") ?? query.get("accuracy") ?? 25);
      if (longitude === null || latitude === null || accuracy === null) return reply({ success: false, error: "请输入有效经纬度（经度 -180～180，纬度 -90～90）和正整数精度" });
      state = { enabled: true, longitude, latitude, accuracy, updatedAt: now() };
    }
    if (!storage.write(state)) return reply({ success: false, error: "设备存储写入失败" });
    const confirmed = storage.read();
    if (JSON.stringify(confirmed) !== JSON.stringify(state)) return reply({ success: false, error: "设备存储确认失败，请重试" });
    return reply({ success: true, ...state });
  } catch {
    return reply({ success: false, error: "无法访问设备存储或请求无效" });
  }
}

function runWlocSettings() {
  const quantumult = typeof $task !== "undefined";
  const storage = {
    read() {
      const raw = quantumult ? $prefs.valueForKey(WLOC_SETTINGS_KEY) : $persistentStore.read(WLOC_SETTINGS_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    write(value) {
      const raw = JSON.stringify(value);
      return quantumult ? $prefs.setValueForKey(raw, WLOC_SETTINGS_KEY) : $persistentStore.write(raw, WLOC_SETTINGS_KEY);
    }
  };
  const body = $request.method === "OPTIONS" ? "" : JSON.stringify(handleWlocSettings($request.url, storage));
  const response = {
    status: quantumult ? "HTTP/1.1 200 OK" : 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    }, body
  };
  $done(quantumult ? response : { response });
}

runWlocSettings();
})();
