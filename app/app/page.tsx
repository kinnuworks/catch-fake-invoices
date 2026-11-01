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
        <p className="lede">A supplier's agent sends an invoice. Your agent checks it before any money moves. In this example, someone changed the wallet.</p>

        <div className="window">
          <div className="rail">
            <span className="who">Try other ways to fool it:</span>
            <div className="rows">
              {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
                <button key={key} className={key === "clean" ? "honest" : undefined} onClick={() => setScenario(key)} aria-pressed={scenario === key}>
                  {SCENARIOS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="pane">
            {error && <p role="alert">{error}</p>}
            {!result && !error && <div className="sheet waiting">Checking the invoice…</div>}
            {result && rows && (
              <div key={result.scenario}>
                <div className={`band ${result.pass ? "clear" : "stop"}`} role="status">
                  <span className="who">Your agent's decision</span>
                  <strong>{result.pass ? "Ready for your approval" : "Payment stopped"}</strong>
                  {result.pass ? (
                    <p>Signature, wallet, order and history all match. Nothing is paid until you approve it.</p>
                  ) : (
                    <ul>
                      {result.findings.map((f) => <li key={f.reason}>{f.message}</li>)}
                    </ul>
                  )}
                </div>
                <div className="sheet">
                  <p className="who">Invoice from the supplier's agent</p>
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
                <p className="next">If you approve a clean invoice, your agent pays it through HSP, HashKey's payment gateway. The supplier's agent then asks HSP whether the money reached its wallet, and delivers only if it did.</p>
                <p className="note">This demo uses a sample invoice and throwaway keys, and no money moves. The checks are the real ones.</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
