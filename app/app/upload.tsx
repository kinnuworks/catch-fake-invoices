"use client";

import { useEffect, useRef, useState } from "react";
import type { InvoiceRead } from "../lib/readInvoice";

type Review = InvoiceRead & { doubts: string[]; aiRead: "ok" | "off" | "failed" };

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
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (review) resultRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [review]);

  async function send(file: Blob, wallet: string, total: string) {
    setBusy(true);
    setError("");
    setReview(null);
    const form = new FormData();
    form.set("file", file, "invoice.pdf");
    form.set("payTo", wallet);
    form.set("amount", total);
    try {
      const res = await fetch("/api/review", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setReview(body);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The check didn't run. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sample(name: string) {
    setPayTo(KNOWN);
    setAmount("450");
    const blob = await fetch(`/samples/${name}.pdf`).then((r) => r.blob());
    await send(blob, KNOWN, "450");
  }

  const hidden = review?.warnings.find((w) => w.kind === "hidden-text");
  const hiddenText = hidden?.message.match(/"(.*)"/s)?.[1];
  const stop = !!review && (review.warnings.length > 0 || review.doubts.length > 0);

  return (
    <section className="pdf" id="pdf">
      <h2>Check a PDF invoice</h2>
      <p>Try a sample, or upload your own. It isn't saved.</p>
      <div className="controls" style={{ marginBottom: 16 }}>
        {SAMPLES.map(([name, label]) => <button key={name} disabled={busy} onClick={() => sample(name)}>{label}</button>)}
      </div>
      <div className="fields">
        <label className="field">Wallet you've paid before (optional)
          <input value={payTo} onChange={(e) => setPayTo(e.target.value)} />
        </label>
        <label className="field">Amount you agreed (optional)
          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">Your invoice (PDF)
          <input type="file" accept="application/pdf" disabled={busy}
            onChange={(e) => e.target.files?.[0] && send(e.target.files[0], payTo, amount)} />
        </label>
      </div>

      {busy && <div className="sheet waiting">Reading the invoice…</div>}
      {error && <p role="alert">{error}</p>}
      {review && (
        <div className="result dark" ref={resultRef}>
          <div className={`band ${stop ? "stop" : "clear"}`} role="status">
            <span className="who">Satya's decision</span>
            <strong>{stop ? "Don't pay this yet" : "No problems found in these checks"}</strong>
            {review.warnings.length > 0 && (
              <ul>
                {review.warnings.filter((w) => !(w.kind === "hidden-text" && hiddenText)).map((w) => <li key={w.kind}>{w.message}</li>)}
              </ul>
            )}
          </div>
          {hiddenText && (
            <div className="reveal">
              <span>Hidden text a person can't see:</span>
              {hiddenText}
            </div>
          )}
          {review.doubts.length > 0 && (
            <div className="detail">
              Also worth checking:
              <ul>{review.doubts.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          )}
          {!review.warnings.length && !payTo && <p className="detail">Add the wallet you've paid before, so a changed wallet can be caught.</p>}
          {review.aiRead !== "ok" && <p className="detail">The AI read didn't run, so this used fixed rules only and can miss things.</p>}
          <p className="detail">
            Read from the invoice: {review.invoiceNumber ?? "no number"}, {review.supplierName ?? "no supplier"}, {review.amount ?? "no total"}, {review.payTo ?? "no wallet"}.
          </p>
        </div>
      )}
    </section>
  );
}
