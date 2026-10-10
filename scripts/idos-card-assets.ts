import {CARDS} from '../lib/cards';
import {cardArtworkPaths} from '../components/presentation/cardFace';
import {cardPreviewArtPath} from '../lib/cardArt';

// Evaluate actual card paths, including nested renewed/ and character artwork.
// This gives the static packager an exhaustive check independent of its scanner.
console.log(JSON.stringify([...cardArtworkPaths(Object.keys(CARDS)),...Object.keys(CARDS).map(cardPreviewArtPath)]));
