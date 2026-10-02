# AGENTS.md or CLAUDE.md

## Code

Write the least code that works. Reuse what is already here before adding anything new.

- Read the existing file before writing a new one. 
- Extend it if it already fits.
- Keep a thing in one file until a second caller needs it.
- Write it so it reads plainly on the first pass. Boring over clever.
- An abstraction earns its place at the second caller, not the first.

### Naming

Use short names. One word. Two only when one is genuinely ambiguous.

Applies to variables, functions, components, types, files and folders.

- Use a real word, never a single letter. `plan`, not `p`. `row`, not `r`.
- The one word must name the thing it holds: `plan`, `rows`, `slug`, `user`.
- When no single word is meaningful, take two: `bookingId`, `authGate`. Stop at two.
- Prefer `header.tsx` over `site-header.tsx`, `plans.ts` over `memberships-data.ts`.
- Prefer `plan` over `membershipPlan`, `rows` over `serviceRowsList`.
- The name must still read clearly on its own. Short beats clever; clear beats short.

### Comments

Make sure to only write comments when they are necessary. If It is Function Write a Short One Line Comment of What It Does Similarly For Others Too

## Commits

One word for the name. Around five words for the description.
