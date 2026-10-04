'use client';
import WalletContext from './WalletContext';
import CollectionContext from './CollectionContext';
export default function Providers({ children }: { children: React.ReactNode }) {
  return <WalletContext><CollectionContext>{children}</CollectionContext></WalletContext>;
}
