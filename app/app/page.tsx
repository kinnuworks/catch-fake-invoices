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
    <main>
      <div className="wrap">
        <h1>Catch fake invoices before paying</h1>
        <p className="lede">A supplier's agent sends an invoice. Your agent checks it before any money moves. In this example, someone changed the wallet. Try other ways to fool it:</p>

        <div className="controls">
          {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
            <button key={key} onClick={() => setScenario(key)} aria-pressed={scenario === key}>
              {SCENARIOS[key]}
            </button>
          ))}
        </div>

        {error && <p role="alert">{error}</p>}
      </div>

      {!result && !error && <div className="wrap"><div className="sheet waiting">Checking the invoice…</div></div>}
      {result && rows && (
        <div key={result.scenario}>
          <div className={`band ${result.pass ? "clear" : "stop"}`} role="status">
            <div className="wrap">
              <strong>{result.pass ? "Ready for your approval" : "Payment stopped"}</strong>
              {result.pass ? (
                <p>Signature, wallet, order and history all match. Nothing is paid until you approve it.</p>
              ) : (
                <ul>
                  {result.findings.map((f) => <li key={f.reason}>{f.message}</li>)}
                </ul>
              )}
            </div>
          </div>
          <div className="wrap">
            <div className="sheet">
              <table>
                <tbody>
                  {rows.map(([label, value, changed]) => (
                    <tr key={label} className={changed ? "changed" : undefined}>
                      <th>{label}</th>
                      <td className={label === "Pay to" ? "mono" : undefined}>
                        {changed ? <span className="mark">{value} (changed)</span> : value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">This demo uses a sample invoice and throwaway keys, and no money moves. The checks are the real ones.</p>
          </div>
        </div>
      )}

      <div className="wrap">
        <Upload />

        {(runs as Run[]).length > 0 && (
          <section className="runs">
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
      </div>
      <footer className="end" />
    </main>
  );
}
