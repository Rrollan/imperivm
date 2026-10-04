'use client';
import LocaleProvider from './LocaleContext';
import WalletContext from './WalletContext';
import CollectionContext from './CollectionContext';
import NftContext from './NftContext';
export default function Providers({ children }: { children: React.ReactNode }) {
  return <LocaleProvider><WalletContext><CollectionContext><NftContext>{children}</NftContext></CollectionContext></WalletContext></LocaleProvider>;
}
