import { applyAction, createGame, legalActions } from '../../lib/engine/engine';
import { chooseAiAction } from '../../lib/ai';
import { DECKS } from '../../lib/decks';
import { HEROES } from '../../lib/heroes';
import { diffAction, type BattleEvents } from '../../lib/events';
import type { Action, GameState } from '../../lib/engine/types';
import {historyEntry,type HistoryEntry} from './battleHistory';

export interface PresentationBatch {
  id: number;
  revision: number;
  action: Action;
  before: GameState;
  after: GameState;
  events: BattleEvents | null;
}

export interface SessionSnapshot {
  state: GameState;
  shown: GameState;
  busy: boolean;
  revision: number;
  history: readonly HistoryEntry[];
}

/** A real, seeded mid-match encounter, reached entirely through legal engine actions. */
export function createLabGame(heroId = 'builder', opening = false, seed = 2718): GameState {
  const hero = HEROES[heroId] ? heroId : 'builder';
  const foe = hero === 'degen' ? 'whale' : 'degen';
  let state = opening
    ? createGame(hero, DECKS[hero], foe, DECKS[foe], {enableMulligan:true}, seed)
    : createGame(hero, DECKS[hero], foe, DECKS[foe], seed);
  if (!opening) {
    for (let step = 0; step < 180 && state.block < 9 && state.winner === null; step++) {
      state = applyAction(state, chooseAiAction(state));
    }
  }
  return state;
}

/** Rules commit immediately. Display timing is a separate, cancellable concern. */
export class GameSession {
  private state: GameState;
  private shown: GameState;
  private pending: PresentationBatch | null = null;
  private revision = 0;
  private serial = 0;
  private history:HistoryEntry[]=[];
  private recordedId:number|null=null;
  private listeners = new Set<(snapshot: SessionSnapshot) => void>();

  constructor(initial: GameState) { this.state = initial; this.shown = initial; }

  snapshot(): SessionSnapshot {
    return { state: this.state, shown: this.shown, busy: this.pending !== null, revision: this.revision,history:this.history };
  }

  subscribe(listener: (snapshot: SessionSnapshot) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private publish() { const snapshot = this.snapshot(); this.listeners.forEach(fn => fn(snapshot)); }

  legal() { return this.pending ? [] : legalActions(this.state); }

  dispatch(action: Action): PresentationBatch | null {
    if (this.pending || this.state.winner !== null) return null;
    const before = this.state;
    // applyAction validates before any session state is changed.
    const after = applyAction(before, action);
    const batch = { id: ++this.serial, revision: ++this.revision, action, before, after, events: diffAction(before, after, action) };
    this.state = after;
    this.pending = batch;
    this.publish();
    return batch;
  }

  impact(id: number) {
    if (this.pending?.id !== id) return;
    this.record(this.pending);
    this.shown = this.pending.after;
    this.publish();
  }

  complete(id: number) {
    if (this.pending?.id !== id) return;
    this.record(this.pending);
    this.shown = this.state;
    this.pending = null;
    this.publish();
  }

  restart(initial: GameState) {
    this.serial++;
    this.revision++;
    this.pending = null;
    this.history=[];this.recordedId=null;
    this.state = initial;
    this.shown = initial;
    this.publish();
  }

  private record(batch:PresentationBatch){
    if(this.recordedId===batch.id)return;
    this.recordedId=batch.id;this.history=[...this.history,historyEntry(batch)].slice(-60);
  }
}
