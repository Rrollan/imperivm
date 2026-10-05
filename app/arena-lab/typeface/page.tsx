import Link from 'next/link';
import styles from './typeface.module.css';

export const metadata = { title: 'IMPERIVM Inscription — русский и английский алфавит' };

export default function TypefacePage() {
  return <main className={styles.page}>
    <nav><Link href="/arena-lab">← Арена</Link><span>IMPERIVM · мастерская шрифта</span></nav>
    <header><p>Собственное начертание · версия 1</p><h1>IMPERIVM<br />INSCRIPTION</h1>
      <p>Резные засечки, контраст штрихов и малые прописные для названий и команд.</p>
    </header>
    <section aria-labelledby="try-type"><h2 id="try-type">Набери свой текст</h2>
      <textarea className={styles.sample} aria-label="Текст для проверки шрифта" defaultValue={'Империя строится ход за ходом.\nThe empire is built turn by turn.'} spellCheck={false} />
      <p>Обычные символы Unicode. Строчные буквы отображаются малыми прописными. Правила карт и длинные тексты используют Manrope.</p>
    </section>
    <section className={styles.alphabet}><h2>Алфавит и знаки</h2>
      <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>abcdefghijklmnopqrstuvwxyz</p>
      <p>АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ</p><p>абвгдеёжзийклмнопрстуфхцчшщъыьэюя</p>
      <p>0123456789 + × / ! ? ₿ $ € ₽</p>
    </section>
    <section><h2>Скачать и подключить</h2><div className={styles.downloads}>
      <a href="/fonts/imperivm/imperivm-inscription.woff2" download>WOFF2 · браузер</a>
      <a href="/fonts/imperivm/imperivm-inscription.ttf" download>TTF · дизайн и редакторы</a>
      <a href="/fonts/imperivm/alphabet.svg" download>SVG · образец алфавита</a>
    </div><pre>{`@font-face {
  font-family: 'IMPERIVM Inscription';
  src: url('/fonts/imperivm/imperivm-inscription.woff2') format('woff2');
  font-display: swap;
}
.title { font-family: 'IMPERIVM Inscription', serif; }`}</pre>
      <p>Оригинальные векторные контуры. Исходный генератор находится в scripts/typeface. Лицензия MIT.</p>
    </section>
  </main>;
}
