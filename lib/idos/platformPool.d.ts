import type {Connection,Transaction} from '@solana/web3.js';
import type {SolanaProgramAdapter} from '@idosgames/wallet';
export declare function createPlatformPoolAdapter(options: {connection: Connection; owner: string; programId: string; signTransaction: (transaction:Transaction)=>Promise<Transaction>}): SolanaProgramAdapter;
