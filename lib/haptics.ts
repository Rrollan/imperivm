const KEY='imperivm.haptics';
export function hapticsEnabled(): boolean {
  if(typeof window==='undefined')return false;
  try{return localStorage.getItem(KEY)!=='0';}catch{return false;}
}
export function setHapticsEnabled(enabled:boolean){try{localStorage.setItem(KEY,enabled?'1':'0');}catch{}}
/** Best effort on supported devices, once at confirmed visual contact. */
export function hapticContact(type:string){
  if(typeof navigator==='undefined'||typeof document==='undefined'||document.hidden||!navigator.vibrate||!hapticsEnabled())return;
  const pattern=type==='attack'?12:type==='hero-power'?[7,16,7]:type==='play-minion'||type==='cast-spell'?7:0;
  if(pattern)try{navigator.vibrate(pattern);}catch{}
}
