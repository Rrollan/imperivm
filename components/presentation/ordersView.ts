export type OrderSlot='ready'|'bonus'|'spent'|'locked';
/** Engine bonuses may exceed the regular capacity and the ten carved sockets. */
export function ordersView(available:number,capacity:number){
  return {
    slots:Array.from({length:10},(_,i):OrderSlot=>i<available?(i>=capacity?'bonus':'ready'):i<capacity?'spent':'locked'),
    overflow:Math.max(0,available-10),
    bonus:Math.max(0,available-capacity),
    available,capacity,
  };
}
