'use client';

interface GasColumnProps {
  gas: number;
  maxGas: number;
}

/** Vertical column of gas crystals (compact horizontal strip on mobile). */
export default function GasColumn({ gas, maxGas }: GasColumnProps) {
  const slots = Math.max(maxGas, Math.min(gas, 10));
  return (
    <aside
      className="shrink-0 rounded-xl border border-solana/30 bg-void/60 px-2 py-2 md:px-2.5 md:py-3
                 flex md:flex-col flex-row items-center gap-1.5 md:gap-2 md:w-[4.25rem]"
      title="Gas: mana for this block. Spent on cards and hero power, refills each block."
    >
      <div className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-solana font-bold [writing-mode:horizontal-tb] md:[writing-mode:vertical-rl] md:rotate-180">
        Gas
      </div>
      <div className="flex md:flex-col flex-row items-center gap-1 md:gap-1.5">
        {Array.from({ length: slots }, (_, i) => (
          <div
            key={i}
            className={`gas-crystal w-5 h-7 md:w-7 md:h-9 ${i < gas ? 'gas-crystal-lit' : 'gas-crystal-dim'}`}
            title={i < gas ? 'Charged crystal' : 'Spent crystal'}
          />
        ))}
      </div>
      <div className="font-mono text-xs md:text-sm font-bold text-solana">
        {gas}
        <span className="text-lavender/60 font-medium">/{maxGas}</span>
      </div>
    </aside>
  );
}
