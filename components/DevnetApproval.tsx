'use client';
import Dialog from './Dialog';
import type { DevnetPlan } from '../lib/solana/metaplex';
export default function DevnetApproval({ plan, busy, onApprove, onCancel }: { plan: DevnetPlan; busy: boolean; onApprove: () => void; onCancel: () => void }) {
  return <Dialog title={plan.title} onClose={busy ? () => {} : onCancel}>
    <div className="transaction-summary"><p><span>Network</span><b>Solana devnet</b></p><p><span>Fee payer / recipient</span><code>{plan.owner}</code></p><p><span>New / updated account</span><code>{plan.account}</code></p><p><span>Account rent estimate</span><b>{(Number(plan.rentLamports) / 1e9).toFixed(6)} test SOL</b></p><p><span>Network fee</span><b>{(Number(plan.feeLamports) / 1e9).toFixed(6)} test SOL</b></p><p><span>Simulation</span><b className="text-mint">Passed · {String(plan.units)} compute units</b></p></div>
    <p className="integration-note">No real currency. Phantom must approve the devnet transaction. This preview expires after 45 seconds; cancellation changes nothing on chain.</p>
    <div className="dialog-actions"><button className="primary-button" disabled={busy} onClick={onApprove}>{busy ? 'Waiting for confirmation…' : 'Approve in Phantom'}</button><button className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </Dialog>;
}
