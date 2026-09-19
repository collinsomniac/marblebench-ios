/**
 * Post-funnel centerline in simulation metres. The track descends throughout
 * a wide U-turn, remains in a separate depth lane from the vertical loop, and
 * ends at a diagonal entry merge. Rendering and Rapier use this same centerline.
 */
export const LOOP_ENTRY_START=Object.freeze([-3.62,1.54,.60]);
export const POST_FUNNEL_WAYPOINTS=Object.freeze([
  [ 2.26,3.17,-.88],
  [ 1.68,3.01,-.50],
  [  .05,2.83, .16],
  [-2.70,2.42, .20],
  [-3.90,2.14, .20],
  [-4.55,1.97, .20],
  [-4.68,1.78, .65],
  [-4.26,1.61, .85],
  LOOP_ENTRY_START
].map(p=>Object.freeze(p)));
