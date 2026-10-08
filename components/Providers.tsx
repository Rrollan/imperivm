'use client';
import LocaleProvider from './LocaleContext';
import WalletContext from './WalletContext';
import CollectionContext from './CollectionContext';
import NftContext from './NftContext';
import IDosContext from './IDosContext';
export default function Providers({ children }: { children: React.ReactNode }) {
  return <LocaleProvider><WalletContext><IDosContext><CollectionContext><NftContext>{children}</NftContext></CollectionContext></IDosContext></WalletContext></LocaleProvider>;
}
