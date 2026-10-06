'use client';
import {useState} from 'react';
import Link from 'next/link';
import report from '../../docs/balance/baseline-20261006.json';
import {heroPortraitPath} from './heroPortrait';
import {ArenaCardPreview} from './ArenaCardPreview';
import {useReducedMotion} from '../../lib/prefersReducedMotion';
import {cardName} from '../../lib/locale';
import styles from './BalanceLab.module.css';

const heroes=['whale','builder','degen','validator'];
const names:Record<string,string>={whale:'Кит',builder:'Строитель',degen:'Деген',validator:'Валидатор'};
const suites=[['starters-greedy','Стартовые колоды','Текущий AI: дорогие карты, выгодные размены, атака казны.'],['starters-pressure','Давление на казну','Та же логика, но легальные атаки казны выполняются раньше.'],['shared-deck-greedy','Одна колода у всех','Все герои используют колоду Строителя. Это отделяет вклад силы героя от состава колоды.']];
const strategies=[
  {hero:'degen',title:'Темп и риск',plan:'Захватить поле дешёвыми бойцами, добирать ценой казны, завершать прямым уроном.',combo:'Сэндвич-атакер → Ликвидатор: две карты разных фракций, давление и восстановление. Бонус фракции требует второй карты той же фракции.',counter:'Провокация, восстановление, точечное удаление. Не раздавать всем финишеры без условий.'},
  {hero:'builder',title:'Строй и поддержка',plan:'Сохранять бойцов, развивать широкий строй и превращать его в угрозу общим усилением.',combo:'Фаланга профилей прикрывает бойцов → Фаланга прошивки усиливает сохранившийся строй.',counter:'Массовый урон и публичное предупреждение о RUG PULL. Нужен способ восстановить строй после зачистки.'},
  {hero:'whale',title:'Контроль и долг',plan:'Сдерживать раннее давление, менять карты выгоднее соперника, побеждать сильным поздним ходом.',combo:'Солнечный сапёр в очереди → бойцы снижают здоровье врагов до двух. Соперник видит подготовку и может ответить.',counter:'Давление до дорогих ходов; не выкладывать всю руку под объявленную зачистку.'},
  {hero:'validator',title:'План и контригра',plan:'Выбирать между доходом и атакой, защищать растущих бойцов, управлять очередью указов.',combo:'Гоплит хотспота в гарнизоне → дополнительный приказ следующего хода; Аудит отменяет указ и готовит усиление.',counter:'Удалить источник дохода или вынудить потратить отмену. Сила героя требует отдельной переработки.'},
];

export function BalanceLab(){
  const [suiteId,setSuite]=useState('starters-greedy'),[seat,setSeat]=useState<0|1>(0),[pair,setPair]=useState({hero:'builder',foe:'degen'});
  const [materialsOn,setMaterialsOn]=useState(true);
  const reduced=useReducedMotion();
  const matchCount=report.results.reduce((sum,result)=>sum+result.matches,0);
  const suite=report.results.find(s=>s.id===suiteId)!;
  const selected=suite.cells.find(c=>c.a===(seat===0?pair.hero:pair.foe)&&c.b===(seat===0?pair.foe:pair.hero))!;
  const selectedWins=seat===0?selected.wins:selected.losses;
  const selectedRate=seat===0?selected.winRate:100-selected.winRate;
  const interval=seat===0?selected.interval95:[100-selected.interval95[1],100-selected.interval95[0]];
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/arena-lab/animation-kit">← Пак анимаций</Link><span>IMPERIVM / ИССЛЕДОВАНИЕ 01</span><Link href="/arena-lab?opening=1">На арену →</Link></header>
    <section className={styles.intro}><p className={styles.eyebrow}>Баланс для PvP · 6 октября 2026</p><h1>Что решает<br/><em>исход боя</em></h1><p className={styles.lead}>{matchCount} матчей. Четыре правителя. Один движок.<br/>Сначала измеряем перекосы, затем меняем правила.</p><p className={styles.scope}>Это диагностические бои ботов, а не установленная PvP-мета. Разные тактики дают разные результаты. Матрица показывает исходную версию правил; изменения ниже — предложения.</p></section>
    <section className={styles.research} aria-label="Результаты проверки">
      <div className={styles.sectionHeading}><span>01 / МАТЧИ</span><h2>Проверяем каждую пару</h2></div>
      <div className={styles.suiteControls} role="group" aria-label="Метод проверки">{suites.map(([id,label])=><button key={id} aria-pressed={suiteId===id} onClick={()=>setSuite(id)}>{label}</button>)}</div>
      <p className={styles.method}>{suites.find(s=>s[0]===suiteId)?.[2]} {suite.matches} матчей, {report.seedsPerOrderedPair} посевов на каждую упорядоченную пару, включая зеркальные матчи. Пересдача стартовой руки включена.</p>
      <div className={styles.metrics}><div><strong>{suite.firstWinRate.toFixed(1)}%</strong><span>победы первого игрока</span></div><div><strong>{suite.blocks.median}</strong><span>медиана числа ходов обоих игроков</span></div><div><strong>{suite.incomplete}</strong><span>незавершённых матчей</span></div></div>
      <div className={styles.tableTop}><p>Строка — выбранный герой. Столбец — соперник.</p><div role="group" aria-label="Порядок хода"><button aria-pressed={seat===0} onClick={()=>setSeat(0)}>Ходит первым</button><button aria-pressed={seat===1} onClick={()=>setSeat(1)}>Ходит вторым</button></div></div>
      <div className={styles.tableScroll}><table><caption className={styles.srOnly}>Процент побед героя по строке, {seat===0?'первый':'второй'} ход</caption><thead><tr><th scope="col">Герой / Соперник</th>{heroes.map(h=><th scope="col" key={h}>{names[h]}</th>)}</tr></thead><tbody>{heroes.map(hero=><tr key={hero}><th scope="row"><img src={heroPortraitPath(hero)} alt=""/>{names[hero]}</th>{heroes.map(foe=>{
        const cell=suite.cells.find(c=>c.a===(seat===0?hero:foe)&&c.b===(seat===0?foe:hero))!;
        const value=seat===0?cell.winRate:100-cell.winRate;
        return <td key={foe}><button data-strength={value>60?'high':value<40?'low':'even'} aria-pressed={pair.hero===hero&&pair.foe===foe} aria-label={`${names[hero]} против ${names[foe]}: ${value.toFixed(1)}% побед`} onClick={()=>setPair({hero,foe})}>{value.toFixed(1)}<small>%</small></button></td>;
      })}</tr>)}</tbody></table></div>
      <div className={styles.matchDetail} aria-live="polite"><div><span>{names[pair.hero]} / {names[pair.foe]}</span><h3>{selectedRate.toFixed(1)}% побед · {seat===0?'первый':'второй'} ход</h3><p>{selectedWins} побед из {selected.wins+selected.losses} решающих матчей. 95% интервал Уилсона: {interval[0].toFixed(1)}–{interval[1].toFixed(1)}%. Ничьи: {selected.draws}. Матчи этой пары используют одни и те же посевы в выбранных методах проверки.</p></div><Link href={`/arena-lab?hero=${pair.hero}&opponent=${pair.foe}&opening=1`}>Сыграть первым против AI →</Link></div>
    </section>
    <section className={styles.findings}><div className={styles.sectionHeading}><span>02 / ПРИЧИНЫ</span><h2>Правила, которые надо пересмотреть</h2></div><ol>
      <li><strong>Сила Валидатора обычно ничего не меняет.</strong><p>Цена 2, доход 2. В выбранном прогоне {suite.powers.validator.neutral} из {suite.powers.validator.uses} применений не изменили приказы, руку, казну или поле. Вариант для прототипа: заплатить 2 сейчас за +2 приказа на следующем своём ходу. Появится выбор между темпом сейчас и будущим ходом.</p></li>
      <li><strong>Некоторые карты отличаются ценой, но не эффектом.</strong><p>Пепито: 3 за 2/2; AMM-центурион: 2 за 2/2. Церемония раскрытия: 4 за массовые 2 урона; Солнечный сапёр: 3 за тот же эффект. Фракционная связка различает их, но не доказывает справедливость такой доплаты.</p></li>
      <li><strong>Строителю трудно восстановить потерянное поле.</strong><p>Восстановление казны не убирает угрозу. Его исходная колода сильно уступает Киту при текущей логике бота. С общей колодой разница меньше — надо проверять отдельно героя и состав набора.</p></li>
      <li><strong>Ожидание указа должно создавать выбор.</strong><p>Показать порядок и момент исполнения, подсветить доступный ответ, объяснить выбранную цель. Добавить ограниченный набор немедленных тактик и адресных эффектов вместо ещё одного случайного удара.</p></li>
    </ol></section>
    <section><div className={styles.sectionHeading}><span>03 / НАПРАВЛЕНИЕ ДИЗАЙНА</span><h2>Четыре способа победить</h2></div><p className={styles.method}>Цель — тактический PvP-матч на 7–10 минут, за счёт решений и темпа колод. Архетипы ниже — для следующего прототипа. Существующие карты сохраняем; числа и способности проверяем по одному изменению.</p><div className={styles.strategies}>{strategies.map(s=><article key={s.hero}><img src={heroPortraitPath(s.hero)} alt=""/><span>{names[s.hero]}</span><h3>{s.title}</h3><p>{s.plan}</p><details><summary>Связка и ответ соперника</summary><p>{s.combo}</p><p><strong>Контригра:</strong> {s.counter}</p></details></article>)}</div></section>
    <section className={styles.materials}><div className={styles.sectionHeading}><span>04 / МАТЕРИАЛЫ КАРТ</span><h2>Редкость ощущается в свете</h2></div><p className={styles.method}>Наведите указатель или выберите карту клавишей Tab и нажимайте стрелки. Блик ограничен иллюстрацией: цена, имя и характеристики остаются чистыми. В режиме уменьшенного движения эффект выключен.</p><button aria-pressed={materialsOn&&!reduced} disabled={reduced} onClick={()=>setMaterialsOn(on=>!on)}>Блики и наклон</button><div className={styles.cardSamples}>{[['amm-centurion','Бронза · обычная'],['hotspot-hoplite','Бирюза · редкая'],['firmware-phalanx','Аметист · эпическая'],['genesis-pfp','Золото · легендарная']].map(([id,label])=><figure key={id}><div><ArenaCardPreview id={id} locale="ru" label={cardName(id,'ru')} interactive reduced={reduced||!materialsOn}/></div><figcaption>{label}</figcaption></figure>)}</div></section>
    <section className={styles.technology}><div className={styles.sectionHeading}><span>05 / ТЕХНОЛОГИИ</span><h2>Как внедряем референсы</h2></div><div><article><span>УЖЕ В ПРОСМОТРЕ КАРТ</span><h3>Pokémon Cards CSS</h3><p>Наклон, отдельные слои отражения и маска на иллюстрации. Наши материалы и React-компонент; без дополнительного WebGL-движка. Боевые карты остаются спокойными.</p><a href="https://github.com/simeydotme/pokemon-cards-css">Исходный проект ↗</a></article><article><span>СЛЕДУЮЩИЙ ПРОТОТИП</span><h3>Spine</h3><p>Живой портрет предводителя: ожидание, подготовка, удар, реакция, смерть. Нужны раздельные слои и скелетный экспорт, а не MP4. Для Babylon.js сначала сравним запечённый атлас с адаптером Spine; второй рендерер в бой пока не добавлен.</p><a href="https://esotericsoftware.com/spine-pixi">Официальный runtime и формат экспорта ↗</a></article></div></section>
    <footer className={styles.footer}><p>Данные исходных правил · {report.engineCommit.slice(0,7)}<br/>Самоигра обнаруживает проблемы. PvP-плейтест проверяет интерес, ясность и контригру.</p><Link href="/arena-lab/animation-kit">START / END / PROMPT →</Link></footer>
  </main>;
}
