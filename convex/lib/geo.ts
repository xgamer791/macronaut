/** Distance and bounding-box math for the home-gym search. Pure so the
 * Convex actions, the client, and Jest can all share one definition of
 * "within seven miles". */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_M = 6_371_008.8;
export const MILE_M = 1_609.344;
/** Seven miles: the radius a gym has to fall inside to count as "yours". */
export const GYM_SEARCH_RADIUS_M = 11_265;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The smallest lat/lng rectangle that contains the circle. Latitude is
 * clamped at the poles and longitude wrapped, which never matters for a gym
 * but keeps the box valid for any input. */
export function boundingBox(center: GeoPoint, radiusM: number): { low: GeoPoint; high: GeoPoint } {
  const dLat = toDeg(radiusM / EARTH_RADIUS_M);
  const cosLat = Math.max(Math.cos(toRad(center.lat)), 1e-6);
  const dLng = toDeg(radiusM / (EARTH_RADIUS_M * cosLat));
  return {
    low: { lat: Math.max(-90, center.lat - dLat), lng: wrapLng(center.lng - dLng) },
    high: { lat: Math.min(90, center.lat + dLat), lng: wrapLng(center.lng + dLng) },
  };
}

function wrapLng(lng: number): number {
  let out = lng;
  while (out < -180) out += 360;
  while (out >= 180) out -= 360;
  return out;
}

export function metersToMiles(m: number): number {
  return m / MILE_M;
}

export function isFiniteCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
