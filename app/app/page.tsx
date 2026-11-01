"use client";

import { useEffect, useState } from "react";
import type { DemoResult, Scenario } from "../lib/demo";
import { SCENARIOS } from "../lib/demo-labels";
import runs from "../data/runs.json";
import { Upload } from "./upload";

type Run = { label: string; status: string; attributionVerified: boolean; network: string; txUrl: string; ledgerUrl?: string };

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("wallet");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setResult(null);
    setError("");
    fetch("/api/check", { method: "POST", body: JSON.stringify({ scenario }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResult)
      .catch(() => setError("The check didn't run. Try again."));
  }, [scenario]);

  const rows = result && [
    ["Invoice", result.invoice.number, false],
    ["Order", result.invoice.order, false],
    ["Supplier", result.invoice.supplier, false],
    ["For", result.invoice.description, false],
    ["Amount", result.invoice.amount, result.changed.includes("amount")],
    ["Pay to", result.invoice.payTo, result.changed.includes("payTo")],
  ] as const;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>Catch fake invoices before paying</h1>
      <p style={{ marginTop: 0 }}>A supplier's agent sends an invoice. Your agent checks it before any money moves. In this example, someone changed the wallet. Try other ways to fool it:</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
          <button key={key} onClick={() => setScenario(key)} aria-pressed={scenario === key}
            style={{ padding: "8px 12px", fontWeight: scenario === key ? 700 : 400 }}>
            {SCENARIOS[key]}
          </button>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}
      {!result && !error && <p>Checking the invoice…</p>}
      {result && rows && (
        <>
          <div style={{ border: "2px solid", padding: 12, marginBottom: 16 }} role="status">
            <strong style={{ fontSize: 24 }}>{result.pass ? "Ready for your approval" : "Payment stopped"}</strong>
            {result.pass ? (
              <p style={{ margin: "4px 0 0" }}>Signature, wallet, order and history all match. Nothing is paid until you approve it.</p>
            ) : (
              <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                {result.findings.map((f) => <li key={f.reason} style={{ overflowWrap: "anywhere" }}>{f.message}</li>)}
              </ul>
            )}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map(([label, value, changed]) => (
                <tr key={label} style={{ borderTop: "1px solid #ccc" }}>
                  <th style={{ textAlign: "left", padding: 6, width: 90 }}>{label}</th>
                  <td style={{ padding: 6, overflowWrap: "anywhere", fontWeight: changed ? 700 : 400 }}>
                    {value}{changed && " (changed)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13 }}>This demo uses a sample invoice and throwaway keys, and no money moves. The checks are the real ones.</p>
        </>
      )}

      <Upload />

      {(runs as Run[]).length > 0 && (
        <section>
          <h2>Real payments through HSP</h2>
          <ul>
            {(runs as Run[]).map((r) => (
              <li key={r.txUrl}>
                {r.label}: {r.status} on {r.network}, attribution {r.attributionVerified ? "verified" : "not verified"}.{" "}
                <a href={r.txUrl}>Transaction</a>{r.ledgerUrl && <> · <a href={r.ledgerUrl}>Ledger entry</a></>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
