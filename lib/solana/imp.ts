import {Connection, PublicKey} from '@solana/web3.js';
import {IMPERIVM_TITLE} from '../idos/title';
import {tokenBalance} from './rug';

/** Read-only mainnet balance. Devnet signing and NFT code never use this connection. */
export async function readImpWalletBalance(owner: string): Promise<string> {
  const accounts = await new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
    .getParsedTokenAccountsByOwner(new PublicKey(owner), {mint: new PublicKey(IMPERIVM_TITLE.mint)});
  return tokenBalance(accounts.value.map(({account}) => {
    if (!('parsed' in account.data)) throw new Error('Invalid IMP token account.');
    return account.data.parsed;
  }), owner, IMPERIVM_TITLE.mint);
}
