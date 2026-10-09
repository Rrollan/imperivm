import React from 'react';
import {createRoot} from 'react-dom/client';
import Providers from '../../components/Providers';
import SceneTextures from '../../components/SceneTextures';
import LandingPage from '../../app/page';
import CollectionPage from '../../app/collection/page';
import LibraryPage from '../../app/library/page';
import PacksPage from '../../app/packs/page';
import LeaderboardPage from '../../app/leaderboard/page';
import ArenaGates from '../../components/ArenaGates';
import ArenaEntry from '../../components/presentation/ArenaEntry';
import {PlayLobby} from '../../components/multiplayer/PlayLobby';
import {HEROES} from '../../lib/heroes';
import {usePathname, useSearchParams} from './navigation';
import '../../app/globals.css';
import '../../app/card-frames.css';
import '../../app/arena.css';
import '../../app/scene.css';
import '../../app/design-polish.css';
import './fonts.css';

function Pages() {
  const path = usePathname(), params = useSearchParams();
  if (path === '/collection') return <CollectionPage/>;
  if (path === '/library') return <LibraryPage/>;
  if (path === '/packs') return <PacksPage/>;
  if (path === '/leaderboard') return <LeaderboardPage/>;
  if (path === '/arena') return <ArenaGates/>;
  if (path === '/play') return <PlayLobby/>;
  if (path === '/arena-lab') {
    const requested = params.get('hero') ?? 'builder';
    const hero = Object.hasOwn(HEROES, requested) ? requested : 'builder';
    return <ArenaEntry key={hero} heroId={hero} debug={false} opening={params.get('opening') !== '0'}/>;
  }
  return <LandingPage/>;
}
createRoot(document.getElementById('app')!).render(<Providers><SceneTextures/><Pages/></Providers>);
