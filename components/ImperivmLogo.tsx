import styles from './ImperivmLogo.module.css';

/** Original painted emblem and lettering, shared by all menu headers. */
export function ImperivmLogo(){
  return <img className={styles.logo} src="/ui/menu/imperivm-wordmark-v1.png" width={2163} height={727} alt="" aria-hidden="true" fetchPriority="high"/>;
}
