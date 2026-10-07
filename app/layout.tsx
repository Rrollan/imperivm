import './globals.css';
import './card-frames.css';
import './arena.css';
import './scene.css';
import './design-polish.css';
import Providers from '../components/Providers';
import SceneTextures from '../components/SceneTextures';
import type { Metadata, Viewport } from 'next';
import { Cinzel, Cormorant_Garamond, Manrope, JetBrains_Mono } from 'next/font/google';

const display = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-cinzel', display: 'swap', adjustFontFallback: false, fallback: [] });
// Cinzel has no Cyrillic glyphs: this Roman serif keeps Russian headings coherent.
const roman = Cormorant_Garamond({ subsets: ['latin', 'cyrillic'], weight: ['600', '700'], variable: '--font-roman', display: 'swap' });
const sans = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });

const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IMPERIVM — Veni. Vidi. Rugi.',
  description: 'IMPERIVM — карточные сражения, где блокчейн-механики становятся правилами игры. Создано для Crypto World’s Fair Hackathon.',
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#171210',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${display.variable} ${roman.variable} ${sans.variable} ${mono.variable} font-sans`}>
        <Providers><SceneTextures />{children}</Providers>
      </body>
    </html>
  );
}
