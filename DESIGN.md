# Satya: the Audit Sheet

Satya means truth in Sanskrit. Tagline: Catch fake invoices before paying.

A calm, warm page with a quiet serif headline and one dark app window as the centrepiece. The page feels trustworthy, and the window draws every eye to the invoice and the verdict.

Signature: the audit line. A red line draws under the field that changed, so the mark always points at the evidence. For a PDF, hidden text appears in red on its own panel. The logo is the same idea: lines of an invoice, with the last one underlined in red.

## Reference map

| Reference | Job | What changed |
| --- | --- | --- |
| Antimetal (main) | Warm page against a dark window, quiet serif headline, pill buttons, small section labels | Our own colours and layout, red and green in place of orange and olive, and a verdict at the centre |
| Linear (second) | Rail and pane inside the window, hairlines, tight spacing, mono labels | Warm black in place of blue-black |

No logo, text or imagery from either site is used.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#F4F3EE` | Page |
| `--ink` | `#1B1816` | Page text, pill buttons |
| `--ink-soft` | `#5F5B56` | Secondary page text |
| `--page-line` | `#D9D6CD` | Hairlines on the page |
| `--panel` | `#1B1816` | Window |
| `--raised` | `#26221F` | Selected row |
| `--line` | `#35302C` | Hairlines in the window |
| `--text` | `#F6F4EF` | Window text |
| `--soft` | `#A29C93` | Secondary window text, labels |
| `--stop` | `#C92A2F` | Stopped panel |
| `--stop-text` | `#FF6B6E` | Changed values, audit line, hidden text |
| `--clear` | `#157A52` | Ready panel |

Red and green only appear on results and in the logo's single line.

## Type

- Headline: Newsreader, weight 400, `clamp(38px, 5.4vw, 64px)`, tracking -0.02em, centred.
- Section headings: Newsreader, weight 400, `clamp(26px, 3vw, 34px)`. Wordmark: Newsreader, 24px.
- Verdict: Geist, weight 600, `clamp(40px, 6.4vw, 76px)`, tracking -0.035em.
- Interface: Geist, 14 to 16px.
- Wallets and labels: Geist Mono. Labels 11px uppercase with 0.08em tracking.

## Spacing and shape

Base unit 8px. Gutter 16px on phones and 32px from 860px. Content width 1120px. Window radius 14px, inner panels 8px, page buttons are full pills, rows inside the window 6px. A soft, static warm blur sits behind the window only, never behind text.

## Components

- Menu bar: sticky, 60px, logo and wordmark on the left, links and a "Try it" pill on the right. On phones only the pill stays.
- Hero: tagline as the headline and one plain sentence.
- Window: 248px scenario rail and a main pane. On phones the rail becomes wrapped buttons above the pane.
- Scenario row: transparent, soft text. Hover uses `--raised`. Selected uses `--raised` with primary text and a 2px red or green left mark.
- Verdict panel: filled red or green with white text, the largest thing on the page.
- Invoice panel: mono labels, hairline rows. A changed row gets stop text and the audit line.
- PDF result: a dark panel matching the window.
- How it works: four numbered cells with hairlines.
- Focus: 2px outline offset by 2px.

## Motion

1. Verdict arrives over 260ms with a small rise.
2. Audit line draws left to right, 420ms, starting 180ms later.
3. Changed value turns red as the line crosses it.

With reduced motion on, everything appears at once.

## Do and don't

- Do let the verdict be the largest and brightest thing on the page.
- Do keep the page quiet, so the window carries the demo.
- Do keep the wallet address readable, with the line under it.
- Don't use the warm blur behind text.
- Don't change behaviour to suit the look.
