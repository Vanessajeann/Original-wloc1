export const WLOC_SETTINGS_KEY = "wloc_settings";

export function wlocNumber(value, limit) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function wlocAccuracy(value = 25) {
  const accuracy = Number(value);
  return Number.isInteger(accuracy) && accuracy > 0 && accuracy <= 100000 ? accuracy : null;
}

export function resolveWlocSettings(argument = {}, saved = null) {
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
