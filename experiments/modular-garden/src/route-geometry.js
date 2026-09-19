/**
 * Post-funnel route in simulation metres. Explicit downhill U-turn in x/z rather
 * than a planar hairpin or a track that climbs against diminishing marble speed.
 * The centerline passes in front of the loop's z=-0.88 plane, then rejoins the
 * physical loop entry from outside the ring. Rendering and physics sample the
 * same points; no marble position or velocity scripting is involved.
 */
export const POST_FUNNEL_WAYPOINTS=Object.freeze([
  [ 2.26,3.17,-.88],
  [ 1.68,3.01,-.50],
  [  .05,2.83, .16],
  [-2.70,2.42, .20],
  [-3.90,2.14, .20],
  [-4.55,1.97,-.06],
  [-4.68,1.78,-.66],
  [-4.26,1.61,-1.11],
  [-3.62,1.54,-.88]
].map(p=>Object.freeze(p)));
