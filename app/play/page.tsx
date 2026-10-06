import {Suspense} from 'react';
import {PlayLobby} from '../../components/multiplayer/PlayLobby';

export default function PlayPage() {
  return <Suspense fallback={<main style={{padding: '4rem', color: '#f6dfaa'}}>Открываем зал сражений…</main>}><PlayLobby/></Suspense>;
}
