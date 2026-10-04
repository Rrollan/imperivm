'use client';

import { useLocale } from './LocaleContext';

interface ManaCrystalsProps {
  gas: number;
  maxGas: number;
}

export default function ManaCrystals({ gas, maxGas }: ManaCrystalsProps) {
  const { t } = useLocale();
  const count = `${gas}/${maxGas}`;

  return (
    <div className="mana-crystals" role="img" title={count}
      aria-label={t(`Мана: ${gas} из ${maxGas}`, `Mana: ${gas} of ${maxGas}`)}>
      <div className="mana-crystals-row" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={`mana-crystal ${i < gas ? 'filled' : i < maxGas ? 'spent' : 'empty'}`}>
            <span className="mana-crystal-gem" />
          </i>
        ))}
      </div>
      <b className="mana-crystals-count" aria-hidden="true">{gas}<small>/{maxGas}</small></b>
    </div>
  );
}
