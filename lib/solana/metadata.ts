import { CARDS } from '../cards';
// Freeze the original 40-item Candy Machine manifest. New gameplay cards must
// not shift existing config-line indices or expand an immutable deployed machine.
export const GENESIS_IDS = [
  'lending-legionnaire', 'amm-centurion', 'liquidation-officer', 'frontrun-bot', 'priority-fee',
  'yield-farmer', 'staking-pool', 'flash-loan', 'impermanent-guard', 'imperator-liquidus',
  'pixel-squire', 'whitelist-scout', 'profile-pic-phalanx', 'trait-reroll', 'floor-sweeper',
  'ape-praetorian', 'minting-press', 'reveal-ceremony', 'blue-chip-basilisk', 'genesis-pfp',
  'antenna-auxilia', 'mesh-messenger', 'relay-runner', 'node-sentinel', 'bandwidth-barbarian',
  'hotspot-hoplite', 'gps-gladiator', 'solar-sapper', 'firmware-phalanx', 'the-grand-cartographer',
  'jeet-legion', 'gm-greeter', 'dogen', 'sandwich-attacker', 'pepito', 'pump-chaser',
  'diamond-hoarder', 'fud-hydra', 'to-the-moon-militia', 'rug-pull',
];
export function metadataBase(raw = process.env.NEXT_PUBLIC_NFT_METADATA_BASE_URL): string | null {
  try {
    if (!raw) return null;
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || /(^|\.)(localhost|example\.com|test|local)$/.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(':')) return null;
    return url.origin;
  } catch { return null; }
}
export function metadataUri(id: string, base = metadataBase()): string {
  if (!base) throw new Error('Configure the actual public HTTPS metadata origin before minting.');
  return `${base}/api/nft/metadata/${encodeURIComponent(id)}`;
}
export function cardIdFromUri(uri: string, base = metadataBase()): string | null {
  if (!base) return null;
  try {
    const url = new URL(uri);
    if (url.origin !== base || url.search || url.hash) return null;
    const id = decodeURIComponent(url.pathname.replace('/api/nft/metadata/', ''));
    return GENESIS_IDS.includes(id) && uri === metadataUri(id, base) ? id : null;
  } catch { return null; }
}
export function nftMetadata(id: string, base: string) {
  if (id === 'genesis') return { name: 'IMPERIVM Genesis', symbol: 'IMPV', description: 'The original forty IMPERIVM card artworks. Solana devnet demo collection.', image: `${base}/cards/card-back.webp`, external_url: `${base}/collection`, attributes: [{ trait_type: 'Network', value: 'Solana devnet' }] };
  if (id === 'victory') return { name: 'IMPERIVM First Victory', symbol: 'IMPV', description: 'A self-reported first AI victory in IMPERIVM. Devnet only; not a competitive proof or financial reward.', image: `${base}/heroes/whale.webp`, external_url: `${base}/leaderboard`, attributes: [{ trait_type: 'Network', value: 'Solana devnet' }, { trait_type: 'Achievement', value: 'First AI victory' }] };
  if (!GENESIS_IDS.includes(id)) throw new Error('Unknown Genesis card');
  const card = CARDS[id];
  return { name: card.name, symbol: 'IMPV', description: `IMPERIVM Genesis · ${card.faction} ${card.type}. ${card.text} Solana devnet collectible.`, image: `${base}/cards/${id}.webp`, external_url: `${base}/collection?card=${id}`, attributes: [
    { trait_type: 'card_id', value: id }, { trait_type: 'Faction', value: card.faction }, { trait_type: 'Rarity', value: card.rarity }, { trait_type: 'Type', value: card.type }, { trait_type: 'Gas', value: card.cost }, { trait_type: 'Network', value: 'Solana devnet' },
    ...(card.type === 'minion' ? [{ trait_type: 'Attack', value: card.attack ?? 0 }, { trait_type: 'Health', value: card.health ?? 0 }] : []),
  ], properties: { files: [{ uri: `${base}/cards/${id}.webp`, type: 'image/webp' }], category: 'image' } };
}
