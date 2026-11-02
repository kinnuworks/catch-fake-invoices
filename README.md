# InvoiceGuard

Catch fake invoices before paying.

InvoiceGuard is an AI agent that checks a supplier's invoice before any money moves, then pays through HSP once a person approves.

It needs HSP and HSK Chain so that neither agent has to trust the other: the supplier's agent asks HSP itself whether the money arrived before it delivers, and each decision goes on a public record on HSK Chain mainnet.

![An invoice with a swapped wallet and hidden instructions, stopped before payment](docs/core-loop.gif)

**Live:** https://useinvoiceguard.vercel.app · **Video:** https://youtu.be/I7WhzoVGQ6w · **Proof:** https://useinvoiceguard.vercel.app/proof

## Try it in 30 seconds

1. Open https://useinvoiceguard.vercel.app.
2. Press "Change the payment wallet" and watch the payment stop.
3. Under "Check a PDF invoice", press "Invoice with hidden instructions". White text on that page tells any AI agent to approve the payment. The agent reports it and approves nothing.

No wallet or signup is needed for these steps. Fixed rules answer first, then an AI read adds anything they missed, within a limit per visitor. To run it yourself, add `ANTHROPIC_API_KEY` to `app/.env` and run `pnpm install && pnpm dev` in `app/`.

## How it works

A supplier's agent sends a signed invoice, and InvoiceGuard, your agent, checks it before any money moves. If you approve, your agent pays through HSP, HashKey's payment gateway. The supplier's agent then asks HSP whether the money reached its wallet, and delivers only if it did. If a supplier disputes a stopped payment, or an auditor asks why one went out, anyone can check the record without trusting the buyer's own logs.

## For other agents

Call `POST /api/v1/check` with a signed invoice before paying. It returns pass or the reasons to stop, and it never approves anything. The agent card is at `/.well-known/agent-card.json`.

## What it checks

- The supplier really signed this invoice, and nobody edited it afterwards.
- The wallet is the one you have paid before.
- The invoice matches an agreed order and its amount.
- This invoice hasn't already been paid.
- The PDF has no hidden text or instructions aimed at software.

The AI reads the invoice and can raise concerns. It can't clear a warning or approve anything, and a person approves every payment. Before anyone is asked to sign, the HSP quote must match the checked invoice's wallet and amount.

## Current state

- Working: signed invoices, the checks, the demo page and the PDF review, with tests.
- Working: payment through HSP. [First payment](https://sepolia.etherscan.io/tx/0xe8531415552f5b10a4afc5e861b91cf2136284be68e5bbca490e81a2a9cdc072): a $1.00 invoice on Ethereum Sepolia with test USDC, the network the organisers set for payment testing. It reached `payment-safe`, not yet final, with attribution verified, and the supplier agent delivered only after asking HSP itself.
- Working: 30 payments in all, to 3 supplier wallets, all `payment-safe` and none final yet, listed at `/proof`. They use our own wallets and test tokens.
- The page's demo buttons don't move money. "Start a real payment" does, for 5 cents of test USDC, while the machine running `app/scripts/relay.ts` is on. A person approves twice.
- Working: the `InvoiceLedger` contract [on HSK Chain mainnet](https://hsk.blockscout.com/address/0xA9b9E3aD6C5997c0522151bCC05783Bc794eFe23), source verified, holding each payment's approval, payment and delivery, and 10 stopped test attacks of four kinds. The contract only records and holds no tokens. The live button writes to the [testnet contract](https://testnet-explorer.hskchain.net/address/0x75466970EB671dF7fA84B1c00f7a00629def0239).
- Working: 5 real HSK payments on mainnet after the same checks, sent straight to our supplier wallets without HSP, listed at `/proof`.
- Not done yet: a payment through HSP on mainnet. HSP's live networks are all test networks.
- Sample invoices and demo keys are illustrations. Hidden text tricks beyond the ones listed in `app/lib/pdf.ts` depend on the AI read, which can miss things.

## Tests

```bash
cd app && pnpm test
```

```bash
cd contracts && forge test
```
