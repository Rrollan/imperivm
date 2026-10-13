import type {CardDef, EmperorState, GameState, Minion, PlayerId} from './types';

export interface EmperorRule {
  readonly id: string;
  readonly titleRu: string;
  readonly titleEn: string;
  readonly textRu: string;
  readonly textEn: string;
  readonly kind: 'law' | 'event';
  readonly minRound: number;
}
/** UI-safe catalogue: imports no card data, engine runtime, browser, or hidden state. */
export const EMPEROR_RULES: readonly EmperorRule[] = Object.freeze(([
  {id:'three-seats', titleRu:'Трое — уже легион',titleEn:'Three Make a Legion',textRu:'У каждого игрока максимум 3 места для бойцов. Уже стоящие бойцы остаются; новые призывы ждут свободного места.',textEn:'Each player has 3 fighter slots. Existing fighters stay; new summons require a free slot.',kind:'law',minRound:1},
  {id:'grand-court',titleRu:'Дворец без очереди',titleEn:'Room at the Palace',textRu:'У каждого игрока 7 мест для бойцов. После отмены указа лишние бойцы остаются.',textEn:'Each player has 7 fighter slots. Extra fighters remain after this law ends.',kind:'law',minRound:1},
  {id:'armory-sale',titleRu:'Распродажа в арсенале',titleEn:'Armory Sale',textRu:'Карты бойцов стоят на 1 приказ меньше, но не меньше 1.',textEn:'Fighter cards cost 1 less order, with a minimum cost of 1.',kind:'law',minRound:1},
  {id:'red-tape',titleRu:'Три подписи на указ',titleEn:'Imperial Red Tape',textRu:'Все заклинания стоят на 1 приказ больше, но не больше 10.',textEn:'All spells cost 1 extra order, capped at 10.',kind:'law',minRound:1},
  {id:'scholars-grant',titleRu:'Грант писцам',titleEn:'Scribes Get a Grant',textRu:'Все заклинания стоят на 1 приказ меньше, но не меньше 1.',textEn:'All spells cost 1 less order, with a minimum cost of 1.',kind:'law',minRound:1},
  {id:'heavy-recruitment',titleRu:'Большим — скидка',titleEn:'A Discount for Giants',textRu:'Бойцы с напечатанной стоимостью 5 и выше стоят на 1 приказ меньше.',textEn:'Fighters with a printed cost of 5 or more cost 1 less order.',kind:'law',minRound:1},
  {id:'scout-duty',titleRu:'Пошлина для разведчиков',titleEn:'Scout Duty',textRu:'Бойцы с напечатанной стоимостью 3 и ниже стоят на 1 приказ больше.',textEn:'Fighters with a printed cost of 3 or less cost 1 extra order.',kind:'law',minRound:1},
  {id:'royal-favor',titleRu:'Личный приём',titleEn:'A Private Audience',textRu:'Способность каждого правителя стоит ровно 1 приказ.',textEn:'Every ruler power costs exactly 1 order.',kind:'law',minRound:1},
  {id:'royal-levy',titleRu:'Платный приём',titleEn:'Audience Tax',textRu:'Способность каждого правителя стоит на 1 приказ больше после обычных скидок.',textEn:'Every ruler power costs 1 extra order after normal discounts.',kind:'law',minRound:1},
  {id:'first-blood',titleRu:'Первый в строю',titleEn:'First in Formation',textRu:'Первый разыгранный из руки боец в каждый свой ход получает +1 к атаке навсегда.',textEn:'The first fighter played from hand each own turn gains +1 attack permanently.',kind:'law',minRound:1},
  {id:'veteran-armor',titleRu:'Броня по размеру',titleEn:'Armor for Veterans',textRu:'Новые бойцы с напечатанной стоимостью 4 и выше получают +1 к здоровью навсегда.',textEn:'New fighters with a printed cost of 4 or more gain +1 health permanently.',kind:'law',minRound:1},
  {id:'little-heroes',titleRu:'Маленькие герои',titleEn:'Little Heroes',textRu:'Новые бойцы с напечатанной стоимостью 2 и ниже получают +1 к здоровью навсегда.',textEn:'New fighters with a printed cost of 2 or less gain +1 health permanently.',kind:'law',minRound:1},
  {id:'rapid-march',titleRu:'Марш без остановок',titleEn:'Rapid March',textRu:'Все новые бойцы навсегда получают Натиск: могут сразу атаковать бойцов, но не казну.',textEn:'All new fighters permanently gain Rush: they can immediately attack fighters, but not a treasury.',kind:'law',minRound:1},
  {id:'honor-guard',titleRu:'Все в почётный караул',titleEn:'Everyone Guards the Palace',textRu:'Все новые бойцы навсегда получают Провокацию.',textEn:'All new fighters permanently gain Taunt.',kind:'law',minRound:1},
  {id:'mercy-medals',titleRu:'Медаль милосердия',titleEn:'Medals of Mercy',textRu:'Все новые бойцы навсегда получают Лечение: возвращают казне нанесённый урон.',textEn:'All new fighters permanently gain Lifesteal: actual damage dealt heals their treasury.',kind:'law',minRound:1},
  {id:'honorable-duels',titleRu:'Сначала разберитесь в поле',titleEn:'Settle It on the Field',textRu:'Нельзя атаковать казну бойцом, пока у противника есть хотя бы один боец. Заклинания и способности работают как обычно.',textEn:'Fighters cannot attack a treasury while the opponent has any fighter. Spells and powers work normally.',kind:'law',minRound:1},
  {id:'garrison-holiday',titleRu:'Гарнизон в отпуске',titleEn:'Garrison Holiday',textRu:'Бойцы в гарнизоне не приносят дополнительные приказы в начале хода.',textEn:'Staked fighters grant no extra orders at the start of a turn.',kind:'law',minRound:1},
  {id:'full-granaries',titleRu:'Полные амбары',titleEn:'Full Granaries',textRu:'В начале каждого своего хода получайте на 1 приказ больше обычного.',textEn:'Gain 1 extra order at the start of each own turn.',kind:'law',minRound:1},
  {id:'tight-rations',titleRu:'Экономьте приказы',titleEn:'Tight Rations',textRu:'В начале каждого своего хода получайте на 1 приказ меньше обычного, но не меньше 1.',textEn:'Gain 1 fewer order at the start of each own turn, with a minimum of 1.',kind:'law',minRound:1},
  {id:'field-hospital',titleRu:'Полевой лазарет',titleEn:'Field Hospital',textRu:'В начале своего хода восстанавливайте всем своим бойцам 1 здоровье, не выше их максимума.',textEn:'At the start of each own turn, heal all your fighters for 1, up to their maximum health.',kind:'law',minRound:4},
  {id:'morning-parade',titleRu:'Утренний парад',titleEn:'Morning Parade',textRu:'В начале своего хода все свои бойцы автоматически выходят из гарнизона и готовятся атаковать.',textEn:'At the start of each own turn, all your fighters automatically leave the garrison and ready to attack.',kind:'law',minRound:4},
  {id:'legion-rations',titleRu:'Хлеб первому легиону',titleEn:'Bread for the First Legion',textRu:'Первый разыгранный из руки боец в свой ход восстанавливает вашей казне 1 здоровье.',textEn:'The first fighter played from hand each own turn heals your treasury for 1.',kind:'law',minRound:1},
  {id:'scribes-insight',titleRu:'Мысль рождает мысль',titleEn:'One Edict Inspires Another',textRu:'Первое разыгранное заклинание в свой ход даёт добор 1 карты. Пустая колода наносит обычный урон усталости.',textEn:'Your first spell each own turn draws 1 card. An empty deck causes normal fatigue damage.',kind:'law',minRound:1},
  {id:'ink-tax',titleRu:'Чернила за здоровье',titleEn:'Ink Costs Blood',textRu:'Каждое разыгранное заклинание отнимает 1 здоровье у вашей казны, но не опускает её ниже 1.',textEn:'Each spell played costs your treasury 1 health, but cannot reduce it below 1.',kind:'law',minRound:1},
  {id:'festival',titleRu:'Карты народу',titleEn:'Cards for the People',textRu:'Каждый игрок немедленно берёт 1 карту. Пустые колоды пропускаются; переполненные руки сжигают карту.',textEn:'Each player immediately draws 1 card. Empty decks are skipped; full hands burn the card.',kind:'event',minRound:4},
  {id:'arena-quake',titleRu:'Арена содрогнулась',titleEn:'The Arena Shakes',textRu:'Все бойцы на обеих сторонах получают 1 урон. Казны не затронуты.',textEn:'All fighters on both sides take 1 damage. Treasuries are unaffected.',kind:'event',minRound:4},
  {id:'imperial-tax',titleRu:'Сбор на новый дворец',titleEn:'A Tax for the New Palace',textRu:'Обе казны теряют 2 здоровья, но не опускаются ниже 1.',textEn:'Both treasuries lose 2 health, but cannot fall below 1.',kind:'event',minRound:4},
  {id:'bread-and-games',titleRu:'Хлеба и зрелищ',titleEn:'Bread and Games',textRu:'Обе казны восстанавливают 3 здоровья, не выше 30.',textEn:'Both treasuries heal for 3, up to 30.',kind:'event',minRound:4},
  {id:'war-cry',titleRu:'Ура Императору',titleEn:'Hail the Emperor',textRu:'Все бойцы на обеих сторонах навсегда получают +1 к атаке.',textEn:'All fighters on both sides permanently gain +1 attack.',kind:'event',minRound:4},
  {id:'bronze-issue',titleRu:'Выдать новую броню',titleEn:'Issue New Armor',textRu:'Все бойцы на обеих сторонах навсегда получают +1 к текущему и максимальному здоровью.',textEn:'All fighters on both sides permanently gain +1 current and maximum health.',kind:'event',minRound:4},
  {id:'blunt-weapons',titleRu:'Затупить мечи',titleEn:'Blunt Their Swords',textRu:'Все бойцы теряют 1 атаку, но не опускаются ниже 0.',textEn:'All fighters lose 1 attack, with a minimum of 0.',kind:'event',minRound:4},
  {id:'medical-inspection',titleRu:'Медосмотр легиона',titleEn:'Legion Medical Inspection',textRu:'Все бойцы восстанавливают 2 здоровья, не выше своего максимума.',textEn:'All fighters heal for 2, up to their own maximum health.',kind:'event',minRound:4},
  {id:'cut-the-tallest',titleRu:'Сильнейшим — проверка',titleEn:'Inspect the Strongest',textRu:'У каждого игрока боец с наибольшей атакой теряет 2 атаки, не ниже 0. При равенстве выбирается первый в строю.',textEn:'Each player’s highest-attack fighter loses 2 attack, with a minimum of 0. Formation order breaks ties.',kind:'event',minRound:4},
  {id:'shield-the-smallest',titleRu:'Щит маленькому',titleEn:'A Shield for the Smallest',textRu:'У каждого игрока боец с наименьшим максимальным здоровьем получает +2 к здоровью навсегда. При равенстве — первый в строю.',textEn:'Each player’s fighter with the lowest maximum health permanently gains +2 health. Formation order breaks ties.',kind:'event',minRound:4},
  {id:'amnesty',titleRu:'Сенат распущен',titleEn:'The Senate Is Dismissed',textRu:'Все отложенные заклинания обоих игроков отменяются. Карты и приказы не возвращаются.',textEn:'All queued spells of both players are cancelled. Cards and orders are not refunded.',kind:'event',minRound:4},
  {id:'garrison-recall',titleRu:'Вернуться в строй',titleEn:'Back to Formation',textRu:'Все бойцы выходят из гарнизона. Бойцы текущего игрока, уже пережившие ход, готовы атаковать.',textEn:'All fighters leave the garrison. Current-player fighters past their arrival turn ready to attack.',kind:'event',minRound:4},
  {id:'reserve-grant',titleRu:'Приказы из резерва',titleEn:'Orders from the Reserve',textRu:'Оба игрока получают по 2 дополнительных приказа в начале следующего своего хода.',textEn:'Both players receive 2 extra orders at the start of their next own turn.',kind:'event',minRound:4},
  {id:'emergency-guard',titleRu:'Срочный караул',titleEn:'Emergency Guard',textRu:'У каждого игрока боец с наименьшим текущим здоровьем получает Провокацию и +2 к здоровью навсегда. При равенстве — первый в строю.',textEn:'Each player’s lowest-current-health fighter permanently gains Taunt and +2 health. Formation order breaks ties.',kind:'event',minRound:4},
  {id:'mirror-drill',titleRu:'Зеркальная муштра',titleEn:'Mirror Drill',textRu:'Каждый боец меняет местами текущие атаку и здоровье. Новое здоровье не ниже 1 и становится его новым максимумом.',textEn:'Each fighter swaps current attack and health. New health is at least 1 and becomes its new maximum.',kind:'event',minRound:4},
  {id:'balanced-books',titleRu:'Свести казны',titleEn:'Balance the Treasuries',textRu:'Здоровье обеих казн становится средним их текущих значений с округлением вверх. Минимум 1, максимум 30.',textEn:'Both treasuries become the rounded-up average of their current health, between 1 and 30.',kind:'event',minRound:4},
] satisfies EmperorRule[]).map(rule => Object.freeze(rule)));

const rulesById = new Map(EMPEROR_RULES.map(rule => [rule.id, rule]));
export const EMPEROR_ROUNDS: readonly number[] = Object.freeze([1, 4, 7]);
export function emperorOf(state: Pick<GameState, 'emperor'>): EmperorState | null { return state.emperor ?? null; }
export function activeEmperorRule(state: Pick<GameState, 'emperor'>): EmperorRule | null {
  return state.emperor?.active ? rulesById.get(state.emperor.active) ?? null : null;
}
/** A full round is one turn by each seat; display never depends on private RNG. */
export function emperorRound(state: Pick<GameState, 'block'>): number { return Math.floor((state.block + 1) / 2); }
export function createEmperorState(seed: number): EmperorState {
  return {version:1, active:null, history:[], rng:(seed ^ 0x45d9f3b) | 0, playsThisTurn:[0,0],minionsThisTurn:[0,0],spellsThisTurn:[0,0]};
}
export function emperorCardCost(state: GameState, card: CardDef): number {
  switch (activeEmperorRule(state)?.id) {
    case 'armory-sale': return card.type === 'minion' ? Math.max(1,card.cost-1) : card.cost;
    case 'red-tape': return card.type === 'spell' ? Math.min(10,card.cost+1) : card.cost;
    case 'scholars-grant': return card.type === 'spell' ? Math.max(1,card.cost-1) : card.cost;
    case 'heavy-recruitment': return card.type === 'minion' && card.cost >= 5 ? card.cost-1 : card.cost;
    case 'scout-duty': return card.type === 'minion' && card.cost <= 3 ? card.cost+1 : card.cost;
    default: return card.cost;
  }
}
export function emperorPowerCost(state: GameState, normalCost: number): number {
  const id = activeEmperorRule(state)?.id;
  return id === 'royal-favor' ? 1 : id === 'royal-levy' ? normalCost+1 : normalCost;
}
export function emperorBoardCapacity(state: GameState, normalCapacity: number): number {
  const id = activeEmperorRule(state)?.id;
  return id === 'three-seats' ? 3 : id === 'grand-court' ? 7 : normalCapacity;
}
export function emperorCanAttackTreasury(state: GameState, foe: PlayerId): boolean {
  return activeEmperorRule(state)?.id !== 'honorable-duels' || state.players[foe].board.length === 0;
}
/** Applied once to a new fighter instance: existing card definitions never mutate. */
export function emperorPrepareFighter(state: GameState, card: CardDef, fighter: Minion): void {
  switch (activeEmperorRule(state)?.id) {
    case 'veteran-armor': if(card.cost>=4)growHealth(fighter,1);break;
    case 'little-heroes': if(card.cost<=2)growHealth(fighter,1);break;
    case 'rapid-march': fighter.rush=true;fighter.canAttack=true;break;
    case 'honor-guard': fighter.taunt=true;break;
    case 'mercy-medals': fighter.lifesteal=true;break;
  }
}
export interface EmperorServices {
  draw: (player: PlayerId, count: number) => void;
  log: (text: string) => void;
}
function growHealth(fighter: Minion, amount: number): void {fighter.health+=amount;fighter.maxHealth+=amount;}
function lowest(board: Minion[], stat: (m: Minion) => number): Minion | undefined {
  return board.reduce<Minion|undefined>((chosen,m)=>!chosen||stat(m)<stat(chosen)?m:chosen,undefined);
}
function allFighters(state: GameState): Minion[] {return state.players.flatMap(p=>p.board);}
/** Internal transition hook; caller owns an already-cloned mutable state. */
export function resolveEmperorEvent(state: GameState, id: string, services: EmperorServices): void {
  const fighters=allFighters(state);
  switch(id){
    case 'festival': for(const p of state.players)if(p.deck.length)services.draw(p.id,1);break;
    case 'arena-quake': for(const m of fighters)m.health-=1;for(const p of state.players)p.board=p.board.filter(m=>m.health>0);break;
    case 'imperial-tax': for(const p of state.players)p.treasury=Math.max(1,p.treasury-2);break;
    case 'bread-and-games': for(const p of state.players)p.treasury=Math.min(30,p.treasury+3);break;
    case 'war-cry': for(const m of fighters)m.attack+=1;break;
    case 'bronze-issue': for(const m of fighters)growHealth(m,1);break;
    case 'blunt-weapons': for(const m of fighters)m.attack=Math.max(0,m.attack-1);break;
    case 'medical-inspection': for(const m of fighters)m.health=Math.min(m.maxHealth,m.health+2);break;
    case 'cut-the-tallest': for(const p of state.players){const target=lowest(p.board,m=>-m.attack);if(target)target.attack=Math.max(0,target.attack-2);}break;
    case 'shield-the-smallest': for(const p of state.players){const target=lowest(p.board,m=>m.maxHealth);if(target)growHealth(target,2);}break;
    case 'amnesty': for(const p of state.players){const extended=p as typeof p&{mempool?:unknown[]};extended.mempool=[];}break;
    case 'garrison-recall': for(const p of state.players)for(const m of p.board)if(m.staked){m.staked=false;m.canAttack=p.id===state.turn&&!m.fresh;}break;
    case 'reserve-grant': for(const p of state.players)p.powerIncome=(p.powerIncome??0)+2;break;
    case 'emergency-guard': for(const p of state.players){const target=lowest(p.board,m=>m.health);if(target){growHealth(target,2);target.taunt=true;}}break;
    case 'mirror-drill': for(const m of fighters){const attack=m.attack;m.attack=m.health;m.health=Math.max(1,attack);m.maxHealth=m.health;}break;
    case 'balanced-books': {const average=Math.max(1,Math.min(30,Math.ceil((state.players[0].treasury+state.players[1].treasury)/2)));for(const p of state.players)p.treasury=average;break;}
  }
}
export function emperorResetTurn(state: GameState, pid: PlayerId): void {
  const e=state.emperor;if(!e)return;e.playsThisTurn[pid]=0;e.minionsThisTurn[pid]=0;e.spellsThisTurn[pid]=0;
}
export function emperorTurnIncome(state: GameState, pid: PlayerId, base: number): number {
  const id=activeEmperorRule(state)?.id;
  const staked=id==='garrison-holiday'||id==='morning-parade'?0:state.players[pid].board.filter(m=>m.staked).length;
  return Math.max(1,base+staked+(id==='full-granaries'?1:id==='tight-rations'?-1:0));
}
export function emperorAtTurnStart(state: GameState, pid: PlayerId): void {
  const id=activeEmperorRule(state)?.id;
  for(const m of state.players[pid].board){
    if(id==='field-hospital')m.health=Math.min(m.maxHealth,m.health+1);
    if(id==='morning-parade')m.staked=false;
  }
}
export function emperorAfterCardPlay(state: GameState, pid: PlayerId, card: CardDef, fighter: Minion | undefined, services: EmperorServices): void {
  const e=state.emperor;if(!e)return;
  e.playsThisTurn[pid]+=1;
  // The card's normal effect may already have ended the match (e.g. draw fatigue).
  // A nonlethal imperial tax must never heal a defeated treasury back to 1.
  if(state.winner!==null){
    if(card.type==='minion')e.minionsThisTurn[pid]+=1;else e.spellsThisTurn[pid]+=1;
    return;
  }
  const id=activeEmperorRule(state)?.id;
  if(card.type==='minion'){
    if(e.minionsThisTurn[pid]===0){
      if(id==='first-blood'&&fighter)fighter.attack+=1;
      if(id==='legion-rations')state.players[pid].treasury=Math.min(30,state.players[pid].treasury+1);
    }
    e.minionsThisTurn[pid]+=1;
  }else{
    const first=e.spellsThisTurn[pid]===0;
    e.spellsThisTurn[pid]+=1;
    if(id==='ink-tax')state.players[pid].treasury=Math.max(1,state.players[pid].treasury-1);
    if(id==='scribes-insight'&&first)services.draw(pid,1);
  }
}
function usefulEvent(state: GameState, id: string): boolean {
  const fighters=allFighters(state);
  switch(id){
    case 'festival':return state.players.some(p=>p.deck.length>0);
    case 'bread-and-games':return state.players.some(p=>p.treasury<30);
    case 'medical-inspection':return fighters.some(m=>m.health<m.maxHealth);
    case 'blunt-weapons':case 'cut-the-tallest':return fighters.some(m=>m.attack>0);
    case 'amnesty':return state.players.some(p=>((p as typeof p&{mempool?:unknown[]}).mempool??[]).length>0);
    case 'garrison-recall':return fighters.some(m=>m.staked);
    case 'balanced-books':return state.players[0].treasury!==state.players[1].treasury;
    case 'arena-quake':case 'war-cry':case 'bronze-issue':case 'shield-the-smallest':case 'emergency-guard':return fighters.length>0;
    case 'mirror-drill':return fighters.some(m=>m.attack!==m.health||m.health!==m.maxHealth);
    default:return true;
  }
}
function random(e: EmperorState): number {
  e.rng=(e.rng+0x6d2b79f5)|0;
  let t=Math.imul(e.rng^(e.rng>>>15),1|e.rng);t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
}
/** At most one announcement at the opening of full rounds 1, 4 and 7. */
export function emperorAnnounceIfDue(state: GameState, services: EmperorServices): boolean {
  const e=state.emperor;if(!e||state.winner!==null)return false;
  const round=emperorRound(state);
  if(state.block!==round*2-1||!EMPEROR_ROUNDS.includes(round)||e.history.some(a=>a.round===round))return false;
  const used=new Set(e.history.map(a=>a.id));
  const pool=EMPEROR_RULES.filter(rule=>rule.minRound<=round&&!used.has(rule.id)&&(rule.kind==='law'||usefulEvent(state,rule.id)));
  const rule=pool[Math.floor(random(e)*pool.length)];if(!rule)return false;
  e.active=rule.kind==='law'?rule.id:null;
  e.history.push({id:rule.id,round,block:round*2-1});
  services.log(`Emperor decrees: ${rule.id} (round ${round})`);
  if(rule.kind==='event')resolveEmperorEvent(state,rule.id,services);
  return true;
}
