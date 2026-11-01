# The Audit Sheet

The invoice is real paperwork on a calm page. When something is wrong, a red auditor's line draws under the changed field, so the evidence stays readable and a full-width band says so.

Signature: the audit line. It only appears on a field that changed, so the mark always points at the evidence. For a PDF, hidden text is shown in red on its own sheet.

## Reference map

| Reference | Job | What changed |
| --- | --- | --- |
| Kelp | Document panel and serif voice | Square paper with a hard edge, a cooler page and no curved section |
| Control | Red rules on a document | One animated line that means something, in place of a decorative grid |
| Decide AI | Huge full-width band | Holds a verdict, not a wordmark, and uses red or green on a calm page |
| Ramp | One accent at a time, tidy data rows | The accent is earned by the verdict, and buttons stay ink |

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#E4E9EC` | Page |
| `--paper` | `#FBFAF6` | Invoice sheet |
| `--ink` | `#14233A` | Text, buttons |
| `--ink-soft` | `#4E5B6C` | Secondary text |
| `--rule` | `#C9D1D7` | Hairlines on paper and page |
| `--stop` | `#C4231C` | Stopped band, audit line, changed values |
| `--clear` | `#14704A` | Ready band |

Red and green only appear on results. White on `--stop` is about 5.8:1 and on `--clear` about 6.1:1.

## Type

- Display and verdict: Source Serif 4, weight 600. Headline `clamp(36px, 5vw, 56px)`, verdict `clamp(44px, 7.5vw, 88px)`.
- Interface: Instrument Sans, 16 to 18px.
- Wallets, invoice numbers and labels: JetBrains Mono. Labels 12px uppercase with 0.08em tracking.

## Spacing and shape

Base unit 8px. Page gutter 16px on phones, 32px above 720px, content width 960px. Paper and bands have square corners. Buttons have a 2px radius. The sheet has a 1px rule and a soft offset shadow, `0 18px 40px -24px rgba(20,35,58,.45)`.

## Components

- Tamper button: paper fill, 1px ink border. Hover lifts by 1px. Pressed fills with ink and turns text paper. Focus has a 3px ink outline offset by 2px. Disabled is 50% opacity.
- Verdict band: full-bleed, red or green. It slams in with `transform` over 280ms.
- Invoice sheet: mono labels, serif values, hairline rows. A changed row gets red text and the audit line.
- Reveal sheet: hidden text set in red on paper, with a red rule on its left.
- Input: paper fill, 1px ink border, the same focus outline.
- Loading: the sheet stays in place at half opacity, so the page doesn't jump.

## Motion

1. Band slams in, 280ms, `cubic-bezier(.2,.9,.3,1.2)`.
2. Audit line draws left to right under the value, 420ms, starting 180ms after the band.
3. Changed value turns red as the line crosses it.

With reduced motion on, everything appears at once.

## Do and don't

- Do let the verdict be the largest thing on the page.
- Do keep the sheet looking like a document, with no card chrome or icons.
- Do keep red for failures only.
- Don't add gradients, glass or glows.
- Don't change any words or behaviour to suit the look.
