# The Audit Sheet, dark

A quiet, dark app window with the invoice inside it. Everything stays muted, so a red verdict is the loudest thing on screen.

Signature: the audit line. A red line draws under the field that changed, so the mark always points at the evidence. For a PDF, hidden text appears in red on its own panel.

## Reference map

| Reference | Job | What changed |
| --- | --- | --- |
| Linear | Near-black surfaces, hairlines, tight type, mono labels, white-into-grey sentence | Bluer black, one verdict colour, and our own layout and content |

Linear's logo, text and imagery are not used.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#0A0C10` | Page |
| `--panel` | `#12151B` | Window and panels |
| `--raised` | `#1A1E26` | Selected row, inputs |
| `--line` | `#262B34` | Hairlines |
| `--text` | `#F4F5F7` | Primary text |
| `--soft` | `#9299A6` | Secondary text and mono labels |
| `--stop` | `#C92A2F` | Stopped panel fill |
| `--stop-text` | `#FF6B6E` | Changed values, audit line, hidden text |
| `--clear` | `#157A52` | Ready panel fill |

Red and green only appear on results. Soft text on the panel is about 6.3:1, stop text on the panel about 6.6:1, and white on the stop fill about 5.3:1.

## Type

- Inter, weight 510 for headings and 400 for text, with tight tracking on large sizes.
- Headline `clamp(30px, 4vw, 48px)`, tracking -0.022em. The second half of the opening sentence is `--soft`.
- Verdict `clamp(40px, 6.4vw, 76px)`, weight 600, tracking -0.03em.
- JetBrains Mono for wallets, labels and invoice numbers. Labels 11px uppercase with 0.08em tracking.

## Spacing and shape

Base unit 8px. Gutter 16px on phones and 32px above 720px. Content width 1120px. Window radius 12px, inner panels 8px, buttons 6px, all with 1px hairlines. No shadows except a soft lift under the window.

## Components

- Window: a 248px scenario rail and a main pane. On phones the rail becomes wrapped buttons above the pane.
- Scenario row: transparent, soft text. Hover uses `--raised`. Selected uses `--raised` with primary text and a 2px red or green left mark. Focus has a 2px outline.
- Verdict panel: filled red or green with white text, the largest thing on the page.
- Invoice panel: mono labels, hairline rows. A changed row gets stop text and the audit line.
- Reveal panel: hidden text in stop text with a red left rule.
- Input: `--raised`, hairline, the same focus outline.
- Loading: a panel of the same height with soft text, so the page doesn't jump.

## Motion

1. Verdict arrives over 260ms with a small rise.
2. Audit line draws left to right, 420ms, starting 180ms later, with a faint glow.
3. Changed value turns red as the line crosses it.

With reduced motion on, everything appears at once.

## Do and don't

- Do let the verdict be the largest and brightest thing on the page.
- Do keep every other surface muted.
- Do keep the wallet address readable, with the line under it.
- Don't add gradients behind content, glass or decorative glows.
- Don't change behaviour to suit the look.
