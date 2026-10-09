/*
MIT License

Copyright (c) 2026 iDos Games

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


Source: @idosgames/wallet 0.6.3, dist/react/solanaIndex.js
Original SHA-256: 5022f0e478112bdbb0a9b3be0bad2111a61e75193323eb35c7f6a07f438ca144
Official platform pool adapter extracted to keep Reown/AppKit out of this game.
Only adaptation: receipt polling has a 120-second bound; pending receipts remain recoverable.
*/
import { PublicKey, ComputeBudgetProgram, Transaction, Ed25519Program, TransactionInstruction, SYSVAR_INSTRUCTIONS_PUBKEY, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
var Ue = "e000c6afc62f69cc", Le = "b59a5e563e7306ba", Me = "d668e18c1bdc33f1", H = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), He = "1nc1nerator11111111111111111111111111111111", de = 177, Ge = 3e5, ge = 40, me = 4, Se = ge + 32 * me, Fe = Se + 8, P = class extends Error {
    constructor(o, r) { super(r); this.code = o; this.name = "PlatformPoolError"; }
    code;
};
function M(t) { let e = (t ?? "").replace(/^0x/i, ""), o = new Uint8Array(e.length >> 1); for (let r = 0; r < o.length; r++)
    o[r] = parseInt(e.slice(r * 2, r * 2 + 2), 16); return o; }
function E(t) { let e = Buffer.alloc(8); return e.writeBigUInt64LE(BigInt(t || 0)), e; }
function Ve(t) { let e = Buffer.alloc(8); return e.writeBigInt64LE(BigInt(t || 0)), e; }
function O(t) { let e = Buffer.from(t ?? "", "utf8"), o = Buffer.alloc(4); return o.writeUInt32LE(e.length), Buffer.concat([o, e]); }
async function fe(t) { let e = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(t ?? "")); return new Uint8Array(e); }
function we(t, e, o) { return I(t, Buffer.from("title_balance"), Buffer.from(e), o.toBuffer()); }
function qe(t) { return Buffer.concat([Buffer.from(Ue, "hex"), E(t.amountRaw), O(t.userID), O(t.titleID), O(t.category), Buffer.from(t.titleHash)]); }
function je(t, e) { let o = t.Splits ?? [], r = Buffer.alloc(4); return r.writeUInt32LE(o.length), Buffer.concat([Buffer.from(t.Domain === "SPL_DEV" ? Me : Le, "hex"), E(t.Amount), E(t.BurnAmount), E(t.Nonce), Ve(t.ExpiresAt), r, ...o.map(i => Buffer.concat([Buffer.from(new PublicKey(i.To ?? "").toBytes()), E(i.Amount)])), O(t.UserID), O(t.TitleID), O(t.Category), Buffer.from(e)]); }
function C(t, e, o) { return PublicKey.findProgramAddressSync([e.toBuffer(), o.toBuffer(), t.toBuffer()], H)[0]; }
function $e(t, e, o, r, i) { return new TransactionInstruction({ programId: H, keys: [{ pubkey: t, isSigner: true, isWritable: true }, { pubkey: e, isSigner: false, isWritable: true }, { pubkey: o, isSigner: false, isWritable: false }, { pubkey: r, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: i, isSigner: false, isWritable: false }], data: Buffer.from([1]) }); }
function I(t, ...e) { return PublicKey.findProgramAddressSync(e, t)[0]; }
function ze(t) { let { programId: e, user: o, mint: r, tokenProgram: i } = t, n = I(e, Buffer.from("vault")); return new TransactionInstruction({ programId: e, keys: [{ pubkey: I(e, Buffer.from("config")), isSigner: false, isWritable: false }, { pubkey: n, isSigner: false, isWritable: true }, { pubkey: r, isSigner: false, isWritable: false }, { pubkey: o, isSigner: true, isWritable: true }, { pubkey: C(r, o, i), isSigner: false, isWritable: true }, { pubkey: C(r, n, i), isSigner: false, isWritable: true }, { pubkey: i, isSigner: false, isWritable: false }, { pubkey: H, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: we(e, t.titleHash, r), isSigner: false, isWritable: true }], data: qe(t) }); }
function Ye(t) { let { sig: e, payer: o, tokenProgram: r, titleHash: i } = t, n = new PublicKey(e.ProgramID ?? ""), a = new PublicKey(e.Mint ?? ""), l = new PublicKey(e.WalletAddress ?? ""), s = I(n, Buffer.from("vault")), p = new PublicKey(He), c = (e.Splits ?? []).map(w => new PublicKey(w.To ?? "")), g = c.map(w => C(a, w, r)), f = Ed25519Program.createInstructionWithPublicKey({ publicKey: M(e.Ed25519PublicKey), message: M(e.Ed25519Message), signature: M(e.SignatureHex) }), b = c.map((w, d) => $e(o, g[d], w, a, r)), S = new TransactionInstruction({ programId: n, keys: [{ pubkey: I(n, Buffer.from("config")), isSigner: false, isWritable: false }, { pubkey: o, isSigner: true, isWritable: true }, { pubkey: s, isSigner: false, isWritable: true }, { pubkey: I(n, Buffer.from("nonce"), E(e.Nonce)), isSigner: false, isWritable: true }, { pubkey: a, isSigner: false, isWritable: false }, { pubkey: l, isSigner: false, isWritable: false }, { pubkey: C(a, s, r), isSigner: false, isWritable: true }, { pubkey: C(a, l, r), isSigner: false, isWritable: true }, { pubkey: p, isSigner: false, isWritable: false }, { pubkey: C(a, p, r), isSigner: false, isWritable: true }, { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, { pubkey: r, isSigner: false, isWritable: false }, { pubkey: H, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: we(n, i, a), isSigner: false, isWritable: true }, ...g.map(w => ({ pubkey: w, isSigner: false, isWritable: true }))], data: je(e, i) }); return [f, ...b, S]; }
async function Je(t, e, o) { let r = async (n) => { let a = (await t.getSignatureStatuses([e], { searchTransactionHistory: n })).value[0]; if (a?.err)
    throw new P("TRANSACTION_FAILED", `transaction ${e} failed: ${JSON.stringify(a.err)}`); return a; }, i = n => n?.confirmationStatus === "confirmed" || n?.confirmationStatus === "finalized"; let stop = Date.now() + 120000; for (let n = 1;; n++) {
    if (Date.now() > stop)
        throw new Error("Confirmation timed out. Recover this same transaction before another transfer.");
    await new Promise(s => setTimeout(s, Xe));
    let a = null;
    try {
        a = await r(!1);
    }
    catch (s) {
        if (s instanceof P)
            throw s;
    }
    if (i(a))
        return;
    if (!(a || n % Ze !== 0 || await t.getBlockHeight("confirmed").catch(() => -1) <= o)) {
        if (i(await r(true).catch(() => null)))
            return;
        throw new P("TRANSACTION_EXPIRED", `transaction ${e} expired: block height exceeded`);
    }
} }
var Xe = 2e3, Ze = 5;
function Q(t) { let { connection: e, signTransaction: o } = t; async function r(n) { let a = await e.getAccountInfo(n); if (!a)
    throw new P("MINT_NOT_FOUND", `mint ${n.toBase58()} not found`); return a.owner; } async function i(n, a) { let { blockhash: l, lastValidBlockHeight: s } = await e.getLatestBlockhash("confirmed"), p = new Transaction; p.feePayer = n, p.recentBlockhash = l, p.add(...a); let c = await o(p), g = await e.sendRawTransaction(c.serialize()); return await Je(e, g, s), g; } return { async depositSpl({ mint: n, amountRaw: a, userID: l, titleID: s, category: p }) { let c = new PublicKey(t.owner), g = new PublicKey(n), f = await r(g); return i(c, [ze({ programId: new PublicKey(t.programId), user: c, mint: g, tokenProgram: f, amountRaw: a, userID: l, titleID: s, category: p, titleHash: await fe(s) })]); }, async submitWithdrawal(n) { if (!n.ProgramID || !n.Mint || !n.WalletAddress)
        throw new P("BAD_VOUCHER", "the voucher has no program, mint or wallet"); let a = new PublicKey(t.owner), l = new PublicKey(n.ProgramID), s = await e.getAccountInfo(I(l, Buffer.from("config"))); if (!s)
        throw new P("POOL_NOT_ON_THIS_CLUSTER", "the pool's config account is not on this cluster"); if (s.data.length !== de)
        throw new P("POOL_NOT_MIGRATED", `config is ${s.data.length} bytes, expected ${de} (migrate_config not run)`); let p = Buffer.from(s.data); if (p[Fe] === 1)
        throw new P("POOL_PAUSED", "pool withdrawals are paused"); let c = p.readBigUInt64LE(Se); if (c !== BigInt(n.SignatureEpoch || 0))
        throw new P("VOUCHER_REVOKED", `signature epoch mismatch: voucher ${n.SignatureEpoch}, on-chain ${c}`); let g = Buffer.from(M(n.Ed25519PublicKey)), f = false; for (let S = 0; S < me; S++) {
        let w = ge + S * 32;
        g.equals(p.subarray(w, w + 32)) && (f = true);
    } if (!f)
        throw new P("SIGNER_NOT_TRUSTED", "the voucher's signer is not in the pool's server_pubkeys"); let b = await r(new PublicKey(n.Mint)); return i(a, [ComputeBudgetProgram.setComputeUnitLimit({ units: Ge }), ...Ye({ sig: n, payer: a, tokenProgram: b, titleHash: await fe(n.TitleID ?? "") })]); } }; }
export { Q as createPlatformPoolAdapter };
