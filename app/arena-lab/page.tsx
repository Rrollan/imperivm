import ArenaLab from '../../components/presentation/ArenaLab';
import { HEROES } from '../../lib/heroes';

export const metadata = { title: 'Арена IMPERIVM — новый игровой стол' };

export default function ArenaLabPage({ searchParams }: { searchParams: { hero?: string; opening?: string; debug?: string } }) {
  const hero = searchParams.hero && HEROES[searchParams.hero] ? searchParams.hero : 'builder';
  return <ArenaLab heroId={hero} opening={searchParams.opening === '1'} debug={searchParams.debug === '1'} />;
}
