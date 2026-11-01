"use client";

import { useState } from "react";
import type { InvoiceRead } from "../lib/readInvoice";

type Review = InvoiceRead & { doubts: string[] };

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

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 4 }}>Check a PDF invoice</h2>
      <p style={{ marginTop: 0 }}>Try a sample, or upload your own. It isn't saved.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {SAMPLES.map(([name, label]) => <button key={name} disabled={busy} onClick={() => sample(name)} style={{ padding: "8px 12px" }}>{label}</button>)}
      </div>
      <label style={{ display: "block", marginBottom: 8 }}>Wallet you've paid before (optional)
        <input value={payTo} onChange={(e) => setPayTo(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 6 }} />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>Amount you agreed (optional)
        <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 6 }} />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>Your invoice (PDF)
        <input type="file" accept="application/pdf" disabled={busy} style={{ display: "block" }}
          onChange={(e) => e.target.files?.[0] && send(e.target.files[0], payTo, amount)} />
      </label>

      {busy && <p>Reading the invoice…</p>}
      {error && <p role="alert">{error}</p>}
      {review && (
        <div style={{ border: "2px solid", padding: 12 }} role="status">
          <strong style={{ fontSize: 20 }}>{review.warnings.length ? "Don't pay this yet" : "Nothing wrong found"}</strong>
          {review.warnings.length > 0 && (
            <ul style={{ paddingLeft: 20 }}>
              {review.warnings.map((w) => <li key={w.kind} style={{ overflowWrap: "anywhere" }}>{w.message}</li>)}
            </ul>
          )}
          {review.doubts.length > 0 && (
            <>
              <p style={{ marginBottom: 0 }}>Also worth checking:</p>
              <ul style={{ paddingLeft: 20, marginTop: 0 }}>{review.doubts.map((d) => <li key={d}>{d}</li>)}</ul>
            </>
          )}
          <p style={{ marginBottom: 0, overflowWrap: "anywhere" }}>
            Read from the invoice: {review.invoiceNumber ?? "no number"}, {review.supplierName ?? "no supplier"}, {review.amount ?? "no total"}, {review.payTo ?? "no wallet"}.
          </p>
        </div>
      )}
    </section>
  );
}
