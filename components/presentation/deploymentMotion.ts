const unit=(t:number)=>Math.max(0,Math.min(1,t));
const ease=(t:number)=>{const x=unit(t);return x*x*(3-2*x);};

/** Align over the socket before accelerating down to the surface. */
export function deploymentDrop(progress:number,heavy:boolean){
  const t=unit(progress),peak=heavy?1.8:.95;
  if(t===1)return {travel:1,lift:0,tiltX:0,tiltY:0,scale:1};
  const lift=t<.18?peak*ease(t/.18):t<.68?peak:peak*(1-((t-.68)/.32)**2);
  return {travel:ease((t-.06)/.82),lift,tiltX:-(heavy?.62:.42)*ease(t/.15)*(1-ease((t-.48)/.52)),tiltY:(heavy?.24:.16)*Math.sin(t*Math.PI),scale:1+.075*lift/peak};
}

/** A rigid piece rocks once; it does not squash like rubber or dissolve. */
export function deploymentContact(elapsed:number,heavy:boolean){
  const t=Math.max(0,elapsed),decay=Math.exp(-t/(heavy?105:78)),wave=Math.sin(t/(heavy?48:38));
  return {lift:Math.max(0,wave)*decay*(heavy?.11:.055),tiltX:wave*decay*(heavy?.045:.028)};
}

/** Archived arrival videos stay available to the art lab, never overlay native drops. */
export function isArrivalClip(id:string){return /^(1[0-5]-deploy|21-legendary-descent|2[3-9]-|3[0-5]-)/.test(id);}
