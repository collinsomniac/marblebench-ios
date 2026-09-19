import {LIFT} from './course.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smoothstep=t=>t*t*(3-2*t);
export const RATCHET_STEPS=12;
export const RATCHET_DUTY=0.68;

/** Stepped kinematic elevator timing profile in seconds and metres.
 * This is motor control, not teleportation: position and velocity remain continuous.
 * Rapier handles the shelf-to-marble contact; the motor supplies work.
 */
export function steppedLiftHeight(t){
  const {bottom,top,rise,bottomDwell,topDwell,return:back}=LIFT;
  const period=bottomDwell+rise+topDwell+back;
  const phase=((t%period)+period)%period;
  if(phase<bottomDwell)return bottom;
  if(phase<bottomDwell+rise){
    const elapsed=phase-bottomDwell;
    const slot=rise/RATCHET_STEPS;
    const index=Math.min(RATCHET_STEPS-1,Math.floor(elapsed/slot));
    const progress=clamp((elapsed-index*slot)/(slot*RATCHET_DUTY),0,1);
    return bottom+(top-bottom)*(index+smoothstep(progress))/RATCHET_STEPS;
  }
  if(phase<bottomDwell+rise+topDwell)return top;
  const descent=(phase-bottomDwell-rise-topDwell)/back;
  return top+(bottom-top)*smoothstep(clamp(descent,0,1));
}

export function ratchetStage(t){
  const {bottomDwell,rise,topDwell,return:back}=LIFT;
  const period=bottomDwell+rise+topDwell+back;
  const phase=((t%period)+period)%period;
  if(phase<bottomDwell)return {stage:0,moving:false,mode:'loading'};
  if(phase<bottomDwell+rise){
    const slot=rise/RATCHET_STEPS,elapsed=phase-bottomDwell;
    return {stage:Math.min(RATCHET_STEPS-1,Math.floor(elapsed/slot))+1,moving:(elapsed%slot)<slot*RATCHET_DUTY,mode:'raising'};
  }
  if(phase<bottomDwell+rise+topDwell)return {stage:RATCHET_STEPS,moving:false,mode:'unloading'};
  return {stage:RATCHET_STEPS,moving:true,mode:'returning'};
}
