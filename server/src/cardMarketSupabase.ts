import {parseCardPriceSnapshot,type CardPriceSnapshot} from '../../lib/idos/cardPrice';
import {IMPERIVM_TITLE} from '../../lib/idos/title';

/** No identities, wallet addresses or session credentials enter price storage. */
export interface VerifiedCardDeal {offerId:string;cardId:string;quantity:number;priceImp:string;completedAt:string}
export interface CardMarketRepository {
  read():Promise<CardPriceSnapshot>;
  /** Atomic batch; an immutable duplicate mismatch aborts the entire batch. */
  insert(deals:readonly VerifiedCardDeal[]):Promise<number>;
}

/** Bound bytes while streaming, including a body without Content-Length. */
export async function boundedMarketJson(response:Response,maxBytes=1_000_000):Promise<unknown> {
  if(!response.ok)throw new Error('Market service unavailable');
  const length=response.headers.get('Content-Length');
  if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new Error('Market response too large');
  if(!response.body)throw new Error('Invalid market response');
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{
    for(;;){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Market response too large');}parts.push(result.value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('Invalid market response');}
}

function serviceHeaders(key:string):Record<string,string> {
  if(/^sb_secret_[A-Za-z0-9_-]{8,512}$/.test(key))return {'Content-Type':'application/json',apikey:key};
  // JWT validation is performed by Supabase. Reject anon/user JWTs locally too.
  const parts=key.split('.');
  if(parts.length===3&&parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part))){
    try{if(JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).role==='service_role')return {'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`};}catch{}
  }
  throw new Error('Supabase requires a server secret or service_role key');
}
export function createSupabaseCardMarketRepository({supabaseUrl,supabaseKey,fetcher=fetch}:{supabaseUrl:string;supabaseKey:string;fetcher?:typeof fetch}):CardMarketRepository {
  const url=new URL(supabaseUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Invalid Supabase project URL');
  const headers=serviceHeaders(supabaseKey);
  async function rpc(name:string,body:unknown):Promise<unknown>{
    try{return await boundedMarketJson(await fetcher(new URL(`/rest/v1/rpc/${name}`,url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers,body:JSON.stringify(body)}),512_000);}
    catch{throw new Error('Market price storage unavailable');}
  }
  return {
    async read(){return parseCardPriceSnapshot(await rpc('card_market_price_snapshot',{p_title_id:IMPERIVM_TITLE.id}));},
    async insert(deals){
      if(!deals.length)return 0;
      if(deals.length>1000)throw new Error('Too many market deals');
      const result=await rpc('card_market_insert_deals',{p_title_id:IMPERIVM_TITLE.id,p_deals:deals.map(deal=>({offer_id:deal.offerId,card_id:deal.cardId,quantity:deal.quantity,price_imp:deal.priceImp,completed_at:deal.completedAt}))});
      if(typeof result!=='number'||!Number.isSafeInteger(result)||result<0||result>deals.length)throw new Error('Invalid market insert result');
      return result;
    },
  };
}
