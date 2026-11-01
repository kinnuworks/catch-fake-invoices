# Catch fake invoices before paying

A supplier's agent sends a signed invoice, and your agent checks it before any money moves. If you approve, the invoice is paid through HSP, and the supplier's agent confirms the payment with the gateway before it delivers.

It needs HSP because the supplier's agent can check a payment for itself, with no one's word for it. The check asks whether the money is on-chain, sent to its wallet and attributed to the team. A small contract on HSK Chain keeps a public record of each decision.

## Try it in 30 seconds

1. Run `pnpm install && pnpm dev` in `app/`, then open http://localhost:3100.
2. Press "Change the payment wallet" and watch the payment stop.
3. Under "Check a PDF invoice", press "Invoice with hidden instructions". White text on that page tells any AI agent to approve the payment. The agent reports it and approves nothing.

No wallet or signup is needed for these steps. Reading a PDF with AI needs `ANTHROPIC_API_KEY` in `app/.env`. Without it, fixed rules read the PDF, and the page says so.

## What it checks

- The supplier really signed this invoice, and nobody edited it afterwards.
- The wallet is the one you have paid before.
- The invoice matches an agreed order and its amount.
- This invoice hasn't already been paid.
- The PDF has no hidden text or instructions aimed at software.

The AI reads the invoice and can raise concerns. It can't clear a warning or approve anything, and a person approves every payment. Before anyone is asked to sign, the HSP quote must match the checked invoice's wallet and amount.

## Current state

- Working: signed invoices, the checks, the demo page and the PDF review, with tests.
- Tested only against a stand-in: the HSP payment sequence. No real HSP payment has run yet.
- Not deployed yet: the `InvoiceLedger` contract in `contracts/`.
- Sample invoices and demo keys are illustrations. Hidden text tricks beyond the ones listed in `app/lib/pdf.ts` depend on the AI read, which can miss things.

## Tests

```bash
cd app && pnpm test
```

```bash
cd contracts && forge test
```
