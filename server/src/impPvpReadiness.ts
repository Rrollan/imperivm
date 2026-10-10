import {IMPERIVM_TITLE} from '../../lib/idos/title';

/** Capability contract, not a balance or a reservation. Nothing here moves funds. */
export function impPvpReadiness() {
  return {
    schemaVersion: 1,
    enabled: false,
    reasonCode: 'external-tcg-settlement-unavailable',
    reason: 'iDos has not provided a verified reserve/query/settle/refund API for externally adjudicated TCG matches.',
    titleID: IMPERIVM_TITLE.id,
    currencyID: IMPERIVM_TITLE.currency,
    symbol: 'IMP',
    networkID: IMPERIVM_TITLE.network,
    mint: IMPERIVM_TITLE.mint,
    decimals: IMPERIVM_TITLE.decimals,
    capabilities: {
      freeRandomPvp: true,
      readWalletBalance: true,
      reserveBothEntries: false,
      settleExternalWinner: false,
      refundEntries: false,
      recoverPaidMatchAfterRestart: false,
    },
    unmetRequirements: [
      'verified-external-tcg-financial-api',
      'trusted-server-financial-authorization',
      'durable-match-and-settlement-storage',
      'verified-mainnet-deposit-and-payout',
    ],
    documentation: 'https://github.com/Rrollan/imperivm/blob/main/docs/idos/paid-pvp-integration-contract-20261010.md',
  } as const;
}
