export type OrderSlot='ready'|'bonus'|'spent'|'locked';

/** Socket centers measured in each delivered board, not inferred from HUD width. */
export function ordersLayout(portrait:boolean){
  const width=portrait?650:432,height=portrait?68:54,x=portrait?876:1364,y=portrait?905:760;
  const worldCenters=portrait
    ?[250,307,364,421,478,535,592,649,706,763].map(px=>350+.9*px)
    :[1157,1194,1229,1265,1301,1337,1373,1408,1443,1478].map(px=>px*1600/1586);
  const socketY=portrait?-130+.9*1147:754*1000/992;
  return {width,height,x,y,
    centers:worldCenters.map(center=>(center-(x-width/2))*1248/width),
    centerY:(socketY-(y-height/2))*160/height,
    verticalScale:(width/height)/(1248/160),
    anchorX:(worldCenters[0]+worldCenters[9])/2,anchorY:socketY};
}
/** Engine bonuses may exceed the regular capacity and the ten carved sockets. */
export function ordersView(available:number,capacity:number){
  return {
    slots:Array.from({length:10},(_,i):OrderSlot=>i<available?(i>=capacity?'bonus':'ready'):i<capacity?'spent':'locked'),
    overflow:Math.max(0,available-10),
    bonus:Math.max(0,available-capacity),
    available,capacity,
  };
}
