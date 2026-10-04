import { create, fetchAssetsByOwner, updatePlugin } from '@metaplex-foundation/mpl-core';
import { generateSigner } from '@metaplex-foundation/umi';
import { makeUmi, prepareDevnetPlan, type WalletSign } from './metaplex';
import { metadataUri } from './metadata';
import { winsFor, readMatches } from '../matches';
export async function prepareVictoryBadge(owner: string, sign: WalletSign) {
  const wins = winsFor(owner);
  if (wins < 1) throw new Error('Win a match signed by this wallet first. Autoplay exhibitions do not count.');
  const umi = makeUmi(owner, sign), uri = metadataUri('victory');
  const existing = (await fetchAssetsByOwner(umi, owner, { skipDerivePlugins: true })).find(asset => asset.uri === uri && asset.updateAuthority.type === 'Address' && asset.updateAuthority.address === owner && asset.attributes?.attributeList.some(a => a.key === 'achievement' && a.value === 'first-victory'));
  const lastMatch = readMatches().find(m => m.owner === owner && m.won && !m.exhibition)?.id ?? '';
  const attributeList = [{ key: 'achievement', value: 'first-victory' }, { key: 'wins', value: String(wins) }, { key: 'last_match_id', value: lastMatch }, { key: 'verification', value: 'self-reported-local-ai' }];
  if (existing && existing.attributes?.attributeList.some(a => a.key === 'wins' && a.value === String(wins))) throw new Error('Your badge already has this win count.');
  const asset = generateSigner(umi);
  const builder = existing ? updatePlugin(umi, { asset: existing.publicKey, authority: umi.identity, plugin: { type: 'Attributes', attributeList } }) : create(umi, { asset, name: 'IMPERIVM First Victory', uri, owner: umi.identity.publicKey, updateAuthority: umi.identity.publicKey, plugins: [{ type: 'Attributes', attributeList }] });
  return prepareDevnetPlan(umi, builder, { title: existing ? `Update victory badge to ${wins} wins` : 'Mint First Victory badge', owner, recipient: owner, account: existing?.publicKey ?? asset.publicKey });
}
