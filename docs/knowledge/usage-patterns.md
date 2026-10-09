# Usage patterns worth detecting

Compositions are data with canonical forms, so the patterns below can be found by matching structure (see [principles](../principles.md): structure only, never images). Each pattern is a signal for product design and, in the app, a **suggestion**: "this looks like X; switch to Y?". Detect them in the background on compositions saved to the cloud, and live in the editor.

| Pattern (structure) | What it suggests the person wants | Suggestion |
|---|---|---|
| Variations whose children repeat to make counts match (A B C A B C for 6 photos) | Cycling | `one-variant-per-image(in-turn)` |
| Variations, then Pick of one member per photo | Each photo gets its own variant | `one-variant-per-image` or `one-image-per-variant` |
| Variations with as many children as photos, used once each | A one-to-one pairing | `one-image-per-variant` |
| Spread, Expand, then hand edits to a few values | A spread with different ends or division | Edit the spread's range, Count or Skip by instead |
| Variations of one operation differing in one numeric setting | A spread written out by hand | Convert to Spread |
| Several identical step chains across compositions | A reusable idea | Save as a recipe |
| Tile, then Crop or Scale to a paper shape | A page | Layout on a page frame (Sheet) |
| Copies, then Tile filling a page | Today's print set | Layout `one-image-per-cell(in-turn)` on a page |
| Layout, then a geometry step (crop, rotate) on a page | Probably unintended; breaks the page | Flag it |
| Two shuffled steps with different seeds the person keeps rerolling together | Wants them linked | Share one seed |
| A layout of mixed shapes with Contain and large bands | Wants rows that fit together | Fit: Justified |
| Effects after a Layout that would read the same before it (tone, color) | Cheaper and sharper before the layout | Move the effect before the layout (same result) |

Add patterns here as they are noticed; each new row should name the structure, the intent, and the suggestion.
