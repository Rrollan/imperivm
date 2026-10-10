import type {IDosRuntime} from './client';
import {parseCardPriceSnapshot,type CardPriceSnapshot} from './cardPrice';

function endpoint():string {
  const url=new URL(process.env.NEXT_PUBLIC_WS_URL||'http://localhost:3102');
  url.protocol=url.protocol==='wss:'?'https:':url.protocol==='ws:'?'http:':url.protocol;
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Некорректный адрес статистики рынка.');
  url.pathname='/market/prices';url.search='';url.hash='';return url.href;
}
async function request(options:RequestInit):Promise<CardPriceSnapshot> {
  const response=await fetch(endpoint(),{...options,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(options.method==='POST'?35000:20000)});
  if(!response.ok)throw new Error('Статистика рынка временно недоступна.');
  const raw=await response.text();if(raw.length>512000)throw new Error('Некорректная статистика рынка.');
  return parseCardPriceSnapshot(JSON.parse(raw));
}
export function readMarketPrices():Promise<CardPriceSnapshot>{return request({method:'GET'});}
export async function syncMarketPrices(runtime:IDosRuntime):Promise<CardPriceSnapshot>{
  const account=runtime.getSnapshot();if(account.status!=='wallet'||!account.owner||!account.userId)throw new Error('Для подтверждения сделок нужен вход кошельком.');
  const credential=await runtime.collectionAuth();
  const current=runtime.getSnapshot();if(current.owner!==account.owner||current.userId!==account.userId||current.status!=='wallet')throw new Error('Аккаунт изменился.');
  // Only a credential is relayed. The server independently fetches native deals;
  // neither browser prices nor card balances are accepted as evidence.
  return request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:account.owner,collectionAuth:credential})});
}
