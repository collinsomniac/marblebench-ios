export const ORBIT_MIN_DISTANCE = 0.25,
  ORBIT_MAX_DISTANCE = 6;
export function fitOrbitDistance(aspect, fov, width = 1.5) {
  const t = Math.tan((fov * Math.PI) / 360);
  return Math.min(6, Math.max(1.95, width / (2 * t * aspect), 1.65 / (2 * t)));
}
