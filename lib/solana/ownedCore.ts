import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchAssetsByOwner, fetchAsset, mplCore, type AssetV1 } from '@metaplex-foundation/mpl-core';
import { assertDevnet, DEVNET_RPC } from './devnet';
import { cardIdFromUri } from './metadata';
import type { OwnedCardNFT } from './ownership';
import type { GenesisDeployment } from './deployment';
function verifiedCore(asset: AssetV1, owner: string, deployment: GenesisDeployment): OwnedCardNFT | null {
  if (asset.owner !== owner || asset.updateAuthority.type !== 'Collection' || asset.updateAuthority.address !== deployment.collection) return null;
  const cardId = cardIdFromUri(asset.uri, deployment.metadataOrigin);
  return cardId ? { address: asset.publicKey, cardId, owner, compressed: false, source: 'core-rpc' } : null;
}
export async function ownedCoreCards(owner: string, deployment: GenesisDeployment) {
  await assertDevnet();
  const umi = createUmi(DEVNET_RPC).use(mplCore());
  return (await fetchAssetsByOwner(umi, owner, { skipDerivePlugins: true })).map(asset => verifiedCore(asset, owner, deployment)).filter((asset): asset is OwnedCardNFT => !!asset);
}
export async function verifyMintedCard(address: string, owner: string, deployment: GenesisDeployment) {
  await assertDevnet();
  const umi = createUmi(DEVNET_RPC).use(mplCore());
  const raw = await umi.rpc.getAccount(address as AssetV1['publicKey'], { commitment: 'confirmed' });
  if (!raw.exists || raw.owner !== umi.programs.getPublicKey('mplCore')) throw new Error('The minted account is not a Metaplex Core asset.');
  const card = verifiedCore(await fetchAsset(umi, address, { skipDerivePlugins: true, commitment: 'confirmed' }), owner, deployment);
  if (!card) throw new Error('NFT ownership, Genesis collection or card metadata did not verify.');
  return card;
}
