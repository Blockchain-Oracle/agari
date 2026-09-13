# Receipt card font assets

The renderer uses these local static fonts to turn deterministic receipt text into SVG paths. It does not request fonts or images from a network, or call a generative model. `sharp` converts that SVG to a 1200 × 600 PNG.

Copied from the reviewed `masayume-docs/scripts/assets/fonts` package on 2026-09-05:

| File | Source / instance | SHA-256 |
| --- | --- | --- |
| `Sora-SemiBold.ttf` | Sora variable, `wght=600` | `198f1e07ca73dd53b4cafc7a43835c16a799dca4435feda18fa4158617db48bc` |
| `Inter-Regular.ttf` | Inter variable, `wght=400`, `opsz=14` | `0b59f6b6fc9e8a9ad8032802d1797c4237d9288a3e7b7661517070627b577060` |

Upstream Google Fonts revision: [`5e35378e6bda803962ee6fd257e444a7d459660d`](https://github.com/google/fonts/tree/5e35378e6bda803962ee6fd257e444a7d459660d). Original inputs: [`ofl/sora/Sora[wght].ttf`](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/sora/Sora%5Bwght%5D.ttf) and [`ofl/inter/Inter[opsz,wght].ttf`](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf). Static instances were produced with `fonttools 4.64.0 varLib.instancer`; original copyright and SIL Open Font License notices are included here.

The mark uses the existing Masayume path `M56 120 A 88 88 0 1 0 210 120`, stroke width 34 and a circle at `(133,62)` with radius 30. The paper receipt is an original vector illustration, not a generated receipt or a bank/payout proof. A check symbol means the recorded order filled, never that its eventual market outcome won.

Call `renderReplyCardPng(presentation, { demo: true })` for review fixtures. Production delivery should use only the validated receipt formatter's presentation and the default options. This renderer does not post, upload media, place trades, or determine whether delivery is authorized.

The SVG carries accessible text labels, but those labels do not survive PNG conversion. The current X transport dependency does not expose image alt-text metadata; delivery must keep every meaningful card fact in the plain-text reply. This renderer does not claim that alt text was attached to an uploaded image.
