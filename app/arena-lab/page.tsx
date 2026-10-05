import ArenaLab from '../../components/presentation/ArenaLab';
import { HEROES } from '../../lib/heroes';

export const metadata = { title: 'Арена IMPERIVM — новый игровой стол' };

export default function ArenaLabPage({ searchParams }: { searchParams: { hero?: string; opening?: string; debug?: string; seed?: string } }) {
  const hero = searchParams.hero && HEROES[searchParams.hero] ? searchParams.hero : 'builder';
  const requestedSeed=Number(searchParams.seed);
  const seed=searchParams.debug==='1'&&searchParams.seed!==undefined&&Number.isInteger(requestedSeed)&&requestedSeed>=0&&requestedSeed<=0xffffffff?requestedSeed:2718;
  return <ArenaLab heroId={hero} opening={searchParams.opening === '1'} debug={searchParams.debug === '1'} seed={seed} />;
}
