'use client';
import Dialog from './Dialog';
export { MECHANICS } from '../lib/mechanics';
import { MECHANICS } from '../lib/mechanics';
import { useLocale } from './LocaleContext';
export default function MechanicsGuide({ onClose }: { onClose: () => void }) {
  const { t, keywordName, mechanicText } = useLocale();
  return <Dialog title={t('Правила Империи', 'The imperial rulebook')} onClose={onClose} wide>
    <p className="dialog-copy">{t('Нажмите на карту, чтобы прочитать её свойства. Подсвеченные цели показывают, куда можно атаковать.', 'Tap a card to read its rules; glowing targets show where you can attack.')}</p>
    <div className="mechanics-guide">{Object.keys(MECHANICS).map(name => <details key={name}><summary>{keywordName(name)}</summary><p>{mechanicText(name)}</p></details>)}</div>
  </Dialog>;
}
