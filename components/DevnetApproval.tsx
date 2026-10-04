'use client';
import Dialog from './Dialog';
import { useLocale } from './LocaleContext';
import type { DevnetPlan } from '../lib/solana/metaplex';
export default function DevnetApproval({ plan, busy, onApprove, onCancel }: { plan: DevnetPlan; busy: boolean; onApprove: () => void; onCancel: () => void }) {
  const { t, errorText } = useLocale();
  return <Dialog title={errorText(plan.title)} onClose={busy ? () => {} : onCancel}>
    <div className="transaction-summary"><p><span>{t('Сеть', 'Network')}</span><b>Solana devnet</b></p><p><span>{t('Плательщик комиссии / получатель', 'Fee payer / recipient')}</span><code>{plan.owner}</code></p><p><span>{t('Новый / обновляемый аккаунт', 'New / updated account')}</span><code>{plan.account}</code></p><p><span>{t('Оценка стоимости аккаунта / протокола', 'Account / protocol cost estimate')}</span><b>{(Number(plan.rentLamports) / 1e9).toFixed(6)} {t('тестовых SOL', 'test SOL')}</b></p><p><span>{t('Комиссия сети', 'Network fee')}</span><b>{(Number(plan.feeLamports) / 1e9).toFixed(6)} {t('тестовых SOL', 'test SOL')}</b></p><p><span>{t('Симуляция', 'Simulation')}</span><b className="text-mint">{t('Успешно', 'Passed')} · {String(plan.units)} {t('вычислительных единиц', 'compute units')}</b></p></div>
    <p className="integration-note">{t('Используются тестовые SOL. Подтвердите транзакцию devnet в Phantom. Предпросмотр действует 45 секунд; отмена не меняет данные в сети.', 'No real currency. Phantom must approve the devnet transaction. This preview expires after 45 seconds; cancellation changes nothing on chain.')}</p>
    <div className="dialog-actions"><button className="primary-button" disabled={busy} onClick={onApprove}>{busy ? t('Ожидаем подтверждения…', 'Waiting for confirmation…') : t('Подтвердить в Phantom', 'Approve in Phantom')}</button><button className="secondary-button" disabled={busy} onClick={onCancel}>{t('Отмена', 'Cancel')}</button></div>
  </Dialog>;
}
