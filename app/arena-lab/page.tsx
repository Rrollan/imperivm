import ArenaLab from '../../components/presentation/ArenaEntry';
import { HEROES } from '../../lib/heroes';

export const metadata = { title: 'Арена IMPERIVM — новый игровой стол' };

export default function ArenaLabPage({ searchParams }: { searchParams: { hero?: string; opening?: string; debug?: string; seed?: string;opponent?:string;ruleset?:string } }) {
  const hero = searchParams.hero && Object.hasOwn(HEROES,searchParams.hero) ? searchParams.hero : 'builder';
  const debug=searchParams.debug==='1';
  const opening=searchParams.opening==='1'||(!debug&&searchParams.opening!=='0');
  const requestedSeed=Number(searchParams.seed);
  const seed=searchParams.debug==='1'&&searchParams.seed!==undefined&&Number.isInteger(requestedSeed)&&requestedSeed>=0&&requestedSeed<=0xffffffff?requestedSeed:2718;
  const opponent=searchParams.opponent&&Object.hasOwn(HEROES,searchParams.opponent)?searchParams.opponent:undefined;
  const ruleset=searchParams.ruleset==='validator-investment-v1'?'validator-investment-v1':'classic-v1';
  return <ArenaLab heroId={hero} opening={opening} debug={debug} seed={seed} opponent={opponent} ruleset={ruleset} />;
}
