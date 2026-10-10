import {CARDS} from '../cards';

/** The shared inventory read contract stays independent of the browser SDK. */
export interface CardInventoryState {
  Items?: Record<string,{StackableAmount:number;UnstackableAmount:number;TotalAmount:number}> | null;
}

/** Starter/legacy unlocks never become sellable goods. */
export function cardItemCounts(inventory:CardInventoryState):Record<string,number> {
  const owned:Record<string,number>={};
  for(const id of Object.keys(CARDS)) {
    const amount=inventory.Items?.[id];if(!amount)continue;
    if(!Number.isSafeInteger(amount.StackableAmount)||amount.StackableAmount<0||amount.UnstackableAmount!==0||amount.TotalAmount!==amount.StackableAmount)throw new Error('iDos вернул неверное количество продаваемых карт.');
    if(amount.StackableAmount>0)owned[id]=amount.StackableAmount;
  }
  return owned;
}
