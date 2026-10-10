import {CARDS} from '../cards';

/** Aggregate of native completed deals reported by verified participants. */
export interface CardPriceStats {
  sampleSize:number;
  units:number;
  /** IMP per card, truncated to at most six decimal places. */
  meanImp:string;
  minImp:string;
  maxImp:string;
  lastTradeAt:string;
}
export interface CardPriceSnapshot {
  schemaVersion:1;
  ready:boolean;
  coverage:'verified-reports';
  currencyID:'Main';
  symbol:'IMP';
  stats:Record<string,CardPriceStats>;
  sampleSize:number;
  units:number;
  updatedAt:string|null;
  reason?:string;
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const amount=(value:unknown):value is string=>typeof value==='string'&&/^(?:0|[1-9]\d{0,12})(?:\.\d{1,6})?$/.test(value);
const timestamp=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const millionths=(value:string)=>{const [whole,fraction='']=value.split('.');return BigInt(whole)*BigInt(1_000_000)+BigInt(fraction.padEnd(6,'0'));};

/** Fail closed on malformed storage/API responses; never invent a zero price. */
export function parseCardPriceSnapshot(value:unknown):CardPriceSnapshot {
  if(!object(value)||value.schemaVersion!==1||typeof value.ready!=='boolean'||value.coverage!=='verified-reports'||value.currencyID!=='Main'||value.symbol!=='IMP'||!object(value.stats)||!count(value.sampleSize)||!count(value.units)||value.updatedAt!==null&&!timestamp(value.updatedAt)||value.reason!==undefined&&(typeof value.reason!=='string'||value.reason.length>512))throw new Error('Invalid market price snapshot');
  const stats:Record<string,CardPriceStats>={};let samples=0,units=0;
  for(const [cardId,raw] of Object.entries(value.stats)){
    if(!Object.hasOwn(CARDS,cardId)||!object(raw)||!count(raw.sampleSize)||raw.sampleSize<1||!count(raw.units)||raw.units<raw.sampleSize||!amount(raw.meanImp)||!amount(raw.minImp)||!amount(raw.maxImp)||!timestamp(raw.lastTradeAt))throw new Error('Invalid market price statistics');
    const min=millionths(raw.minImp),mean=millionths(raw.meanImp),max=millionths(raw.maxImp);
    if(min>mean||mean>max||max>BigInt(1_000_000_000_000)*BigInt(1_000_000))throw new Error('Invalid market price range');
    samples+=raw.sampleSize;units+=raw.units;
    stats[cardId]={sampleSize:raw.sampleSize,units:raw.units,meanImp:raw.meanImp,minImp:raw.minImp,maxImp:raw.maxImp,lastTradeAt:raw.lastTradeAt};
  }
  if(!Number.isSafeInteger(samples)||!Number.isSafeInteger(units)||samples!==value.sampleSize||units!==value.units||(!value.ready&&(samples!==0||units!==0||value.updatedAt!==null))||(samples>0&&value.updatedAt===null))throw new Error('Invalid market price totals');
  return {schemaVersion:1,ready:value.ready,coverage:'verified-reports',currencyID:'Main',symbol:'IMP',stats,sampleSize:samples,units,updatedAt:value.updatedAt as string|null,...(value.reason===undefined?{}:{reason:value.reason as string})};
}
