# Platform principles

Commitments that hold across features. Each links to where it came from.

1. **Analyze structure, never images.** Compositions may be studied (counted, compared, matched against patterns) to improve the product and to suggest better forms in the app. People's images are never analyzed, and findings are aggregate, never per-person profiles. Say so plainly in the sign-in and sharing copy. ([ADR 0003](adr/0003-arrangement-algebra.md), future direction 9; [usage patterns](knowledge/usage-patterns.md))
2. **Nothing is public unless shared.** Images and compositions are private; a public link is an explicit act, and source photos stay hidden from shared links unless included. ([ADR 0001](adr/0001-cloud-storage-for-images-and-formulas.md))
3. **The preview tells the truth.** What you see while editing is what you export: sizes are lengths resolved for each resolution, not raw pixels. ([ADR 0003](adr/0003-arrangement-algebra.md), Lengths)
4. **Never crop artwork without asking.** Layouts default to Contain. ([ADR 0003](adr/0003-arrangement-algebra.md), Layout)
5. **Randomness is seeded.** Every random choice is stored with its seed, so results are reproducible and Reroll is explicit. ([ADR 0003](adr/0003-arrangement-algebra.md), Randomness)
