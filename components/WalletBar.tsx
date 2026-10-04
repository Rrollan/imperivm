'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FC, ReactNode } from 'react';
import Link from 'next/link';
import MuteButton from './MuteButton';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import type { Adapter } from '@solana/wallet-adapter-base';

const ENDPOINT = 'https://api.devnet.solana.com';

// NOTE: @solana/wallet-adapter-react ships .d.ts files compiled against React 19
// types, which don't typecheck as JSX under this project's @types/react@18.
// These casts are type-level only — at runtime the very same components render.
const ConnectionProvider18 = ConnectionProvider as unknown as FC<{
  endpoint: string;
  children: ReactNode;
}>;
const WalletProvider18 = WalletProvider as unknown as FC<{
  wallets: Adapter[];
  autoConnect?: boolean;
  children: ReactNode;
}>;
const WalletModalProvider18 = WalletModalProvider as unknown as FC<{ children: ReactNode }>;
const WalletMultiButton18 = WalletMultiButton as unknown as FC;

/** Wallet providers are only constructed after client mount — never during SSR. */
function WalletButtons() {
  const wallets = useMemo<Adapter[]>(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider18 endpoint={ENDPOINT}>
      <WalletProvider18 wallets={wallets} autoConnect>
        <WalletModalProvider18>
          <WalletMultiButton18 />
        </WalletModalProvider18>
      </WalletProvider18>
    </ConnectionProvider18>
  );
}

export default function WalletBar() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="app-header border-b border-gold/20 bg-void/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2">
        <Link href="/" className="header-brand font-display tracking-[0.18em] gold-text font-bold">IMPERIVM</Link>
        <div className="wallet-controls flex items-center gap-2">
          <MuteButton />
          <span className="hidden sm:inline-block text-[11px] px-2.5 py-1 rounded-full border border-mint/40 text-mint uppercase tracking-widest">
            Demo mode — wallet optional
          </span>
          {mounted ? (
            <WalletButtons />
          ) : (
            <div className="h-10 w-36 rounded-lg bg-void border border-gold/20 animate-pulse" />
          )}
        </div>
      </div>
    </header>
  );
}
