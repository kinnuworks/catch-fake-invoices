import Link from "next/link";
import testset from "../../data/testset.json";
import runs from "../../data/runs.json";
import ledger from "../../data/ledger.json";
import { Logo } from "../logo";

export const metadata = { title: "Proof: InvoiceGuard" };

type Row = { kind: string; total: number; rules: number; full: number; read: number };
type Run = { label: string; status: string; attributionVerified: boolean; network: string; txUrl: string; ledgerUrl?: string };

export default function Proof() {
  const summary = testset.summary as Row[];
  const clean = summary.find((r) => r.kind === "clean");
  const attacks = summary.filter((r) => r.kind !== "clean");
  const attackTotal = attacks.reduce((n, r) => n + r.total, 0);
  const caught = attacks.reduce((n, r) => n + r.full, 0);
  const realRuns = runs as Run[];

  return (
    <main>
      <nav className="nav" aria-label="Main">
        <div className="nav__bar">
          <Link className="nav__brand" href="/"><Logo />InvoiceGuard</Link>
          <a className="btn btn-candy btn-sm" style={{ marginLeft: "auto" }} href="/#try">Try it</a>
        </div>
      </nav>
      <section className="section proof-top">
        <div className="container">
          <div className="section-head section-head--left">
            <h1>Proof.</h1>
            <p className="lead" style={{ marginTop: 16 }}>What works today, what doesn't yet, and how well the checks did.</p>
          </div>

          <h2 style={{ fontSize: 28, marginBottom: 16 }}>Status</h2>
          <ul className="status-list" style={{ marginBottom: 56 }}>
            <li><b className="done">Working</b><span>Signed invoices, the six invoice checks and the PDF review, all live on this site.</span></li>
            <li><b className="done">Working</b><span>A <a href="/api/supplier/invoice" style={{ textDecoration: "underline" }}>public supplier agent</a> that signs invoices, using a demo key with no funds.</span></li>
            <li>{realRuns.length ? <b className="done">Working</b> : <b className="todo">Not yet</b>}<span>{realRuns.length ? "Real payments through HSP, listed below." : "A real payment through HSP. The payment sequence is written and has only run against a test stand-in."}</span></li>
            <li><b className="done">Working</b><span>The record contract on {ledger.network}, with its source verified. <a href={ledger.contract} style={{ textDecoration: "underline" }}>See it</a>.</span></li>
            <li><b className="todo">Not yet</b><span>The record contract on HSK Chain mainnet, and a payment on mainnet. The organisers set test networks for payment testing during the hackathon.</span></li>
          </ul>

          <h2 style={{ fontSize: 28, marginBottom: 8 }}>Test results</h2>
          <p className="t-small" style={{ marginBottom: 24, maxWidth: 680 }}>Synthetic invoices we made ourselves, on {testset.date}, kept separate from the ones used to tune the checks. It's a small set with no real-world data, so read it as a first measure. The first run missed most text placed off the page. We fixed that and ran the same set again, so that row isn't a first attempt.</p>
          <div className="stat-row">
            <div className="stat"><strong>{caught}/{attackTotal}</strong><span className="t-small">attacks flagged</span></div>
            <div className="stat"><strong>{clean ? `${clean.full}/${clean.total}` : "n/a"}</strong><span className="t-small">clean invoices wrongly flagged</span></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="scores">
              <thead><tr><th>Case</th><th>Invoices</th><th>Fixed rules flagged</th><th>Rules and AI flagged</th></tr></thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.kind}><td>{r.kind}</td><td className="num">{r.total}</td><td className="num">{r.rules}</td><td className="num">{r.full}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {realRuns.length > 0 && (
            <>
              <h2 style={{ fontSize: 28, margin: "56px 0 16px" }}>Real payments through HSP</h2>
              <ul>
                {realRuns.map((r) => (
                  <li key={r.txUrl}>{r.label}: {r.status} on {r.network}, attribution {r.attributionVerified ? "verified" : "not verified"}. <a href={r.txUrl} style={{ textDecoration: "underline" }}>Transaction</a></li>
                ))}
              </ul>
              <h2 style={{ fontSize: 28, margin: "40px 0 16px" }}>The record on {ledger.network}</h2>
              <ul>
                {ledger.links.map((l) => (
                  <li key={l.url}><a href={l.url} style={{ textDecoration: "underline" }}>{l.step}</a></li>
                ))}
              </ul>
              <p className="t-small" style={{ marginTop: 16, maxWidth: 680 }}>The stopped entry is a test attack we ran ourselves: a signed invoice with its wallet swapped afterwards.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
