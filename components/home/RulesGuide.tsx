'use client';

import { useLocale } from '../LocaleContext';
import styles from './Home.module.css';

export function RulesGuide({ compact = false }: { compact?: boolean }) {
  const { t, mechanicText, keywordName } = useLocale();
  const steps = [
    [t('Соберите легион', 'Build your legion'), t('Тратьте приказы на бойцов и силу правителя. Обычные бойцы атакуют со следующего своего хода; Натиск позволяет сразу атаковать бойцов.', 'Spend orders on fighters and your ruler’s power. Regular fighters attack on your next turn; Rush can attack fighters immediately.')],
    [t('Выберите момент', 'Choose the moment'), t('Мгновенные заклинания работают в этом ходу. Указы ждут начала следующего вашего хода — соперник может ответить Приоритетом.', 'Instant spells work this turn. Edicts wait until your next turn starts, giving your opponent time to answer with Priority.')],
    [t('Опустошите казну', 'Empty their treasury'), t('У каждого правителя 30 здоровья казны. Выбирайте между ударами по легиону и правителю: побеждает тот, кто первым опустошит чужую казну.', 'Each ruler starts with 30 treasury health. Choose between attacking fighters and the ruler: empty the enemy treasury first to win.')],
  ];
  return <div className={styles.rulesGuide}>
    <div className={styles.ruleSteps}>{steps.map(([title, description], index) => <article key={index}><span className={styles.ruleNumber} aria-hidden="true">{['I', 'II', 'III'][index]}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
    {!compact && <>
      <div className={styles.controlsNote}><strong>{t('Управление', 'Controls')}</strong><p>{t('Выберите карту в руке, изучите её и нажмите «Разыграть» или «Применить сейчас». Для атаки выберите своего готового бойца, затем противника. Escape закрывает просмотр и отменяет выбор цели.', 'Select a card in your hand, inspect it, and choose “Play” or “Cast now”. To attack, select a ready friendly fighter, then an enemy. Escape closes inspection and cancels targeting.')}</p></div>
      <div className={styles.glossary}>{['Gas', 'Taunt', 'Rush', 'Lifesteal', 'Priority', 'Staking', 'Halving', 'Pavilion', 'Comeback', 'Fatigue', 'Mulligan'].map(key => <details key={key}><summary>{keywordName(key)}</summary><p>{mechanicText(key).replace(/\bgas\b/gi, 'orders')}</p></details>)}</div>
    </>}
  </div>;
}
