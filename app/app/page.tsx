"use client";

import { useEffect, useState } from "react";
import type { DemoResult, Scenario } from "../lib/demo";
import { SCENARIOS } from "../lib/demo-labels";
import runs from "../data/runs.json";
import ledger from "../data/ledger.json";
import { WithAddresses } from "./address";
import { Logo } from "./logo";
import { LivePayment } from "./live";
import { Challenge } from "./challenge";
import { Upload } from "./upload";

type Run = { label: string; status: string; attributionVerified: boolean; network: string; txUrl: string; ledgerUrl?: string };

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("wallet");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");
  const [statuses, setStatuses] = useState<Partial<Record<Scenario, boolean>>>({});

  useEffect(() => {
    (Object.keys(SCENARIOS) as Scenario[]).forEach((key) => {
      fetch("/api/check", { method: "POST", body: JSON.stringify({ scenario: key }) })
        .then((r) => r.json())
        .then((r: DemoResult) => setStatuses((s) => ({ ...s, [key]: r.pass })))
        .catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    setResult(null);
    setError("");
    fetch("/api/check", { method: "POST", body: JSON.stringify({ scenario }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResult)
      .catch(() => setError("The check didn't run. Try again."));
  }, [scenario]);

  const realRun = (runs as Run[])[0];
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
      <nav className="nav" aria-label="Main">
        <div className="nav__bar">
          <a className="nav__brand" href="#top"><Logo />InvoiceGuard</a>
          <div className="nav__links">
            <a href="#try">Demo</a>
            <a href="#check">Check a PDF</a>
            <a href="#how">How it works</a>
            <a href="#beat">Beat it</a>
            <a href="/proof">Proof</a>
          </div>
          <a className="btn btn-candy btn-sm" href="#try">Try it</a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="container">
          <span className="badge badge--dot">Built for HSK Chain and HSP, HashKey's payment gateway</span>
          <h1>Catch <span className="hl">fake invoices</span> before paying.</h1>
          <p className="lead">InvoiceGuard is an AI agent that checks a supplier's invoice before any money moves. It's for businesses that let agents pay their suppliers. Try to fool it.</p>
          <div className="trust"><span>No wallet</span><span>No signup</span><span>Sample data, no money moves</span></div>
          <p className="t-small" style={{ marginTop: 12 }}>It has also run for real: <a href="#live" style={{ textDecoration: "underline" }}>make a real 5-cent payment through HSP</a>, no wallet needed.</p>

          <div className="hero__visual stage stage--hero" id="try">
            <div className="window window--dark">
              <div className="window__bar"><span className="lights" aria-hidden="true"><i /><i /><i /></span><span className="window__title">InvoiceGuard</span></div>
              <div className="app">
                <div className="rail">
                  <span className="rail__label">Try to fool it</span>
                  <div className="rows">
                    {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
                      <button key={key} className={key === "clean" ? "honest" : undefined} onClick={() => setScenario(key)} aria-pressed={scenario === key}>
                        <span className="row-label">{SCENARIOS[key]}</span>
                        {statuses[key] !== undefined && <span className={`row-status ${statuses[key] ? "ok" : "bad"}`}>{statuses[key] ? "Ready" : "Stopped"}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pane">
                  {error && <p role="alert">{error}</p>}
                  {!result && !error && <div className="sheet waiting">Checking the invoice…</div>}
                  {result && rows && (
                    <div key={result.scenario}>
                      <div className={`verdict ${result.pass ? "clear" : "stop"}`} role="status">
                        <span className="who">InvoiceGuard's decision</span>
                        <strong>{result.pass ? "Ready for your approval" : "Payment stopped"}</strong>
                        {result.pass ? (
                          <p>Signature, wallet, order and history all match. Nothing is paid until you approve it.</p>
                        ) : (
                          <ul>{result.findings.map((f) => <li key={f.reason}><WithAddresses text={f.message} /></li>)}</ul>
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
                                  {changed ? <span className="mark"><WithAddresses text={value} /> (changed)</span> : <WithAddresses text={value} />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="app-note">This demo uses a sample invoice and throwaway keys. The checks are the real ones.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="real">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Checkable on-chain</span>
            <h2>One real invoice, paid through HSP. <span className="t-muted">One attack, stopped.</span></h2>
          </div>
          <LivePayment />
          <div className="grid grid-2">
            {realRun && (
              <div className="tile"><span className="icon-tile step-no">$1</span><div><p className="t-title">HSP settled the payment</p><p>{realRun.status} on {realRun.network}, attribution {realRun.attributionVerified ? "verified" : "not verified"}. <a href={realRun.txUrl} style={{ textDecoration: "underline" }}>See the transaction</a></p></div></div>
            )}
            {ledger.links.slice(0, 3).concat(ledger.links.filter((l) => l.step === "Attack stopped").slice(0, 1)).map((l, i) => (
              <div className="tile" key={l.url}><span className="icon-tile step-no">{`0${i + 1}`}</span><div><p className="t-title">{l.step}</p><p>Written to the record contract on {ledger.network}. <a href={l.url} style={{ textDecoration: "underline" }}>See the entry</a></p></div></div>
            ))}
          </div>
          <p className="t-small" style={{ marginTop: 24 }}>These use test tokens, on the test networks the organisers set for this hackathon. <a href={ledger.contract} style={{ textDecoration: "underline" }}>Contract source</a> · <a href="/proof" style={{ textDecoration: "underline" }}>All {(runs as Run[]).length} payments, and everything that doesn't work yet</a></p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why it matters</span>
            <h2>AI agents will pay invoices. <span className="t-muted">Some invoices lie.</span></h2>
          </div>
          <div className="grid grid-2">
            <div className="card card--flat">
              <h3>Without a check</h3>
              <p>An invoice arrives with a new wallet. It looks normal, so the agent pays it, and a crypto payment is hard to get back.</p>
            </div>
            <div className="card card--chosen">
              <h3>With InvoiceGuard</h3>
              <p>The agent compares the invoice with the supplier's signature, the agreed order and past payments. If anything is off, the payment stops and you see why.</p>
            </div>
          </div>
        </div>
      </section>

      <div id="check"><Upload /></div>

      <Challenge />

      <section className="section section--alt" id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>Two agents, one invoice. <span className="t-muted">You approve.</span></h2>
          </div>
          <div className="grid grid-2">
            <div className="tile"><span className="icon-tile step-no">01</span><div><p className="t-title">The supplier's agent signs an invoice</p><p>It sets the amount and the wallet to pay.</p></div></div>
            <div className="tile"><span className="icon-tile step-no">02</span><div><p className="t-title">InvoiceGuard checks it</p><p>Signature, wallet, order, amount, history and hidden text.</p></div></div>
            <div className="tile"><span className="icon-tile step-no">03</span><div><p className="t-title">You approve</p><p>InvoiceGuard can stop a payment. Only you can approve one.</p></div></div>
            <div className="tile"><span className="icon-tile step-no">04</span><div><p className="t-title">HSP settles it</p><p>HSP is HashKey's payment gateway. The supplier's agent asks it whether the money arrived, then delivers.</p></div></div>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <div className="section-head"><h2>Questions.</h2></div>
          <div className="faq">
            <details><summary>Can the AI approve a payment?</summary><p>No. It reads the invoice and raises concerns. It can't clear a warning, and a person approves every payment.</p></details>
            <details><summary>Does this page move real money?</summary><p>No. The demo uses sample invoices and throwaway keys. The real payments shown above run separately, with test tokens, and a person approves each one.</p></details>
            <details><summary>Why does it use HSP and HSK Chain?</summary><p>HSP lets either agent check a payment for itself, so they don't have to trust each other. A small contract keeps a public record of each decision. It's live on HSK Chain testnet.</p></details>
            <details><summary>Is my PDF saved?</summary><p>No. It's read to run the check and then discarded.</p></details>
            <details><summary>What can it miss?</summary><p>Fixed rules can miss unusual layouts and some ways of hiding text. The AI read catches more, and it can still be wrong. Treat "no problems found" as a result of these checks, and keep checking large payments yourself.</p></details>
          </div>
        </div>
      </section>

      <section className="section final">
        <div className="container">
          <Logo />
          <h2>Try to fool it. <span className="t-muted">It takes a minute.</span></h2>
          <div className="cta-row"><a className="btn btn-candy btn-lg" href="#try">Open the demo</a><a className="btn btn-outline btn-lg" href="#check">Check a PDF</a></div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span className="footer__brand"><Logo />InvoiceGuard</span>
          <span>Catch fake invoices before paying.</span>
        </div>
      </footer>
    </main>
  );
}
