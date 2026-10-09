import type {CurrencyDefinitions} from '@idosgames/core';
import {IMPERIVM_TITLE} from './title';
export function validateImpToken(definitions: CurrencyDefinitions): void {
  const main = definitions.CryptoCurrencies?.[IMPERIVM_TITLE.currency];
  const networks = main?.Networks;
  const binding = networks?.find(item => item.NetworkID === IMPERIVM_TITLE.network);
  if (!main || main.Status !== 'Active' || main.Permissions?.SpendableInGame !== true || networks?.length !== 1 || binding?.ContractAddress !== IMPERIVM_TITLE.mint || binding.Decimals !== IMPERIVM_TITLE.decimals) {
    throw new Error('iDos: настройка токена IMP не совпадает с Solana (нужно 6 decimals). Покупки приостановлены до исправления платформой.');
  }
}
