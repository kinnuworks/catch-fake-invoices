"use client";

import { useEffect, useState } from "react";
import { WithAddresses } from "./address";
import type { InvoiceRead } from "../lib/readInvoice";

type Review = InvoiceRead & { doubts: string[]; notes?: string[]; aiRead: "ok" | "off" | "failed" | "limited" | "unavailable" };

const KNOWN = "0x18Eb2D9DDfBBE58F66ee7f19899E783d3FA7E840";
const SAMPLES = [
  ["poisoned", "Invoice with hidden instructions"],
  ["changed-wallet", "Invoice with a new wallet"],
  ["correct", "Correct invoice"],
] as const;

export function Upload() {
  const [payTo, setPayTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);

  // Show a real result straight away, so this section is never empty.
  useEffect(() => {
    sample("poisoned", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(file: Blob, wallet: string, total: string, ai: boolean): Promise<Review> {
    const form = new FormData();
    form.set("file", file, "invoice.pdf");
    form.set("payTo", wallet);
    form.set("amount", total);
    if (ai) form.set("ai", "1");
    const res = await fetch("/api/review", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    return body;
  }

  // Fixed rules answer at once, then the AI read adds to the result.
  async function send(file: Blob, wallet: string, total: string, ai = true) {
    setBusy(true);
    setError("");
    setReview(null);
    try {
      setReview(await post(file, wallet, total, false));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The check didn't run. Try again.");
      return;
    } finally {
      setBusy(false);
    }
    if (!ai) return;
    setAiBusy(true);
    try {
      setReview(await post(file, wallet, total, true));
    } catch {
      setReview((r) => (r ? { ...r, aiRead: "failed" } : r));
    } finally {
      setAiBusy(false);
    }
  }

  async function sample(name: string, ai = true) {
    setPayTo(KNOWN);
    setAmount("450");
    const blob = await fetch(`/samples/${name}.pdf`).then((r) => r.blob());
    await send(blob, KNOWN, "450", ai);
  }

  const hidden = review?.warnings.find((w) => w.kind === "hidden-text");
  const hiddenText = hidden?.message.match(/"(.*)"/s)?.[1];
  const stop = !!review && (review.warnings.length > 0 || review.doubts.length > 0);

  return (
    <section className="section section--alt">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Hidden instructions</span>
          <h2>Some invoices talk to your AI. <span className="t-muted">This one reports them.</span></h2>
          <p className="lead">A PDF can hide white text telling an AI agent to approve a payment. Try a sample, or upload your own. It isn't saved.</p>
        </div>
        <div className="try">
          <div className="card">
            <p className="t-title">Check a PDF invoice</p>
            <div className="samples">
              {SAMPLES.map(([name, label]) => <button key={name} className="chip" disabled={busy || aiBusy} onClick={() => sample(name)}>{label}</button>)}
            </div>
            <label className="field">Wallet you've paid before (optional)
              <input value={payTo} onChange={(e) => setPayTo(e.target.value)} />
            </label>
            <label className="field">Amount you agreed (optional)
              <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">Your invoice (PDF)
              <input type="file" accept="application/pdf" disabled={busy || aiBusy}
                onChange={(e) => e.target.files?.[0] && send(e.target.files[0], payTo, amount)} />
            </label>
          </div>

          <div className="stage">
            <div className="window window--dark">
              <div className="window__bar"><span className="lights" aria-hidden="true"><i /><i /><i /></span><span className="window__title">invoice.pdf</span></div>
              <div className="app-result result-pane" style={{ background: "var(--app-bg)", color: "var(--app-text)" }}>
                {busy && <div className="sheet waiting">Reading the invoice…</div>}
                {error && <p role="alert" style={{ color: "var(--app-stop-text)" }}>{error}</p>}
                {review && !busy && (
                  <>
                    <div className={`verdict ${stop ? "stop" : "clear"}`} role="status">
                      <span className="who">InvoiceGuard's decision</span>
                      <strong style={{ fontSize: "clamp(30px,3.6vw,46px)" }}>{stop ? "Don't pay this yet" : "No problems found in these checks"}</strong>
                      {review.warnings.some((w) => !(w.kind === "hidden-text" && hiddenText)) && (
                        <ul>
                          {review.warnings.filter((w) => !(w.kind === "hidden-text" && hiddenText)).map((w) => <li key={w.kind}><WithAddresses text={w.message} /></li>)}
                        </ul>
                      )}
                    </div>
                    {hiddenText && (
                      <div className="reveal-box">
                        <span>Hidden text a person can't see</span>
                        {hiddenText}
                      </div>
                    )}
                    {review.doubts.length > 0 && (
                      <div className="detail">
                        The AI also flagged:
                        <ul>{review.doubts.map((d) => <li key={d}><WithAddresses text={d} /></li>)}</ul>
                      </div>
                    )}
                    {review.notes && review.notes.length > 0 && (
                      <div className="detail">
                        Also worth checking:
                        <ul>{review.notes.map((d) => <li key={d}><WithAddresses text={d} /></li>)}</ul>
                      </div>
                    )}
                    {!review.warnings.length && !payTo && <p className="detail">Add the wallet you've paid before, so a changed wallet can be caught.</p>}
                    {aiBusy && <p className="detail">The AI is reading the page too…</p>}
                    {!aiBusy && review.aiRead === "off" && <p className="detail">This first result used fixed rules. Press a sample or upload a PDF to run the full check.</p>}
                    {!aiBusy && review.aiRead === "unavailable" && <p className="detail">The AI read is off on this site right now, so this used fixed rules only and can miss things.</p>}
                    {!aiBusy && review.aiRead === "failed" && <p className="detail">The AI read didn't finish, so this used fixed rules only and can miss things.</p>}
                    {!aiBusy && review.aiRead === "limited" && <p className="detail">You've reached the limit for AI reads. This used fixed rules only. Try again in a few minutes.</p>}
                    {!aiBusy && review.aiRead === "ok" && <p className="detail">Read with fixed rules and AI. A person still approves every payment.</p>}
                    <p className="detail">Read from the invoice: {review.invoiceNumber ?? "no number"}, {review.supplierName ?? "no supplier"}, {review.amount ?? "no total"}, {review.payTo ? <WithAddresses text={review.payTo} /> : "no wallet"}.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
