# InvoiceGuard

Catch fake invoices before paying.

A supplier's agent sends a signed invoice, and InvoiceGuard, your agent, checks it before any money moves. If you approve, your agent pays through HSP, HashKey's payment gateway. The supplier's agent then asks HSP whether the money reached its wallet, and delivers only if it did.

The two agents don't have to trust each other: HSP settles the payment and either side can check it. A small contract on HSK Chain keeps a public record of each decision, so anyone can see why an invoice was paid or stopped.

## Try it in 30 seconds

1. Open https://useinvoiceguard.vercel.app.
2. Press "Change the payment wallet" and watch the payment stop.
3. Under "Check a PDF invoice", press "Invoice with hidden instructions". White text on that page tells any AI agent to approve the payment. The agent reports it and approves nothing.

No wallet or signup is needed for these steps. Fixed rules answer first. When an API key is set, the AI read adds to the result, within a limit per visitor. To run it yourself, add `ANTHROPIC_API_KEY` to `app/.env` and run `pnpm install && pnpm dev` in `app/`.

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
