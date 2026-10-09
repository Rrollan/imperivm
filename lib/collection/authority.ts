import { deckError } from '../engine/deckValidation';
import { needsCollection, parseCollectionAuth, cleanOwned, configuredTitle, deckCardCounts } from './access';
import {isFreeHero,HEROES} from '../heroes';
import {heroesFromCollectibles} from './heroAccess';

/** Server-only read of iDos entitlements. URL and Title are controlled by deployment, never by a player. */
export async function authorizeCollectionDeck(deck: readonly string[], credential?: unknown, fetcher: typeof fetch = fetch,hero='builder'): Promise<void> {
  if(!Object.hasOwn(HEROES,hero))throw new Error('Неизвестный правитель.');
  if (!needsCollection(deck)&&isFreeHero(hero)) return;
  const title = configuredTitle(process.env.IDOS_TITLE_ID);
  const auth = parseCollectionAuth(credential);
  if (!title || !auth) throw new Error('Карты из паков в сетевой игре требуют входа в iDos. Бесплатная колода доступна всегда.');
  const response = await fetcher(`https://api.idosgames.com/api/v2/${encodeURIComponent(title)}/Client/Collection/GetUserState/${encodeURIComponent(auth.userId)}`, {
    method: 'POST', redirect: 'error', headers: {'Content-Type': 'application/json', 'X-IG-Platform': 'Web', Authorization: `Bearer ${auth.sessionTicket}`},
    body: JSON.stringify({TitleID: title, UserID: auth.userId, ClientSessionTicket: auth.sessionTicket, ...(process.env.IDOS_BUILD_KEY ? {BuildKey: process.env.IDOS_BUILD_KEY} : {})}),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Не удалось проверить коллекцию iDos. Войдите заново или выберите бесплатную колоду.');
  const text = await response.text();
  if (text.length > 512_000) throw new Error('Некорректный ответ коллекции iDos.');
  const envelope: unknown = JSON.parse(text);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Не удалось проверить коллекцию iDos.');
  const result = envelope as Record<string, unknown>;
  if (result.Success !== true || !result.Data || typeof result.Data !== 'object' || Array.isArray(result.Data)) throw new Error('Сессия iDos не подтверждена. Войдите заново.');
  const data = result.Data as Record<string, unknown>;
  if (data.CollectionID !== (process.env.IDOS_COLLECTION_ID || 'IMPERIVM_AGORA')) throw new Error('Коллекция iDos не соответствует этому выпуску карт.');
  const problem = deckError(deck, deckCardCounts(cleanOwned(data.OwnedCollectibles)));
  if (problem) throw new Error('В колоде есть карты или копии, которых нет в вашей коллекции iDos.');
  if(!heroesFromCollectibles(data.OwnedCollectibles).includes(hero))throw new Error('Этот правитель ещё не получен из кейса iDos.');
}
