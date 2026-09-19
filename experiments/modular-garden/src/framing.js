// Presentation-only framing. The course extends roughly from x=-8 to x=+8;
// include lateral space for the pool catchers and a modest edge margin.
export const COURSE_FRAME_WIDTH = 18.4;
export const ORBIT_MIN_DISTANCE = 4;
export const ORBIT_MAX_DISTANCE = 75;

export function fitOrbitDistance(aspect, verticalFovDegrees, width = COURSE_FRAME_WIDTH) {
  if (!Number.isFinite(aspect) || aspect <= 0 ||
      !Number.isFinite(verticalFovDegrees) || verticalFovDegrees <= 0 || verticalFovDegrees >= 179 ||
      !Number.isFinite(width) || width <= 0) return 21;
  const halfHorizontalTangent = Math.tan(verticalFovDegrees * Math.PI / 360) * aspect;
  return Math.min(ORBIT_MAX_DISTANCE, Math.max(21, width / (2 * halfHorizontalTangent)));
}
