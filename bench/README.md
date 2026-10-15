# Performance measurements

Measured on 2026-10-15 against production builds, starting at commit `0cf3fc6`. The main gap was mounting every saved reply and its controls. Existing `content-visibility` skipped off-screen layout and paint, but React still mounted every row and parsed its Markdown. Loading boundaries also delayed already-downloaded formatting and document views.

Five runs per checkpoint, medians below. Hardware: AMD Ryzen 3 3200G, four cores; Linux; headless Chrome 152 through agent-browser 0.38.1; Bun 1.4.0. Each run uses a fresh browser with 1,000 synthetic messages containing Markdown, code and math. Warm interactions use a 1280 × 800 iframe. The host allowlist blocks external fonts and model downloads. Source benchmarks add an 80-paragraph saved document and a citation. Timings include two animation frames after the expected content appears; these are local test timings, not field INP or Core Web Vitals.

| Measurement | Before | Final |
| --- | ---: | ---: |
| Cold chat startup | 1,328.1 ms | 531.5 ms |
| Warm chat startup | 1,177.0 ms | 174.6 ms |
| Reopen 1,000 messages | 483.5 ms | 83.4 ms |
| Typing, all history expanded | 117.2 ms | 28.6 ms |
| Open Settings | 232.9 ms | 114.8 ms |
| Scroll frame, 95th percentile | 17.3 ms | 17.6 ms |
| Worst scroll frame | 33.1 ms | 26.1 ms |
| Initial DOM elements | 56,639.0 | 2,403.0 |
| Entry JavaScript | 852.37 kB | 536.25 kB |
| Entry JavaScript, gzip | 315.71 kB | 174.68 kB |

The initial DOM shrank by about 96%. Steady scrolling was already near a 60 Hz frame before the changes, and remains there. The larger gain is avoiding a full history mount when opening a chat and avoiding old-row renders while typing or streaming.

Each change was measured separately. Raw samples are linked below.

| Change | Target measurement | Before | After | Samples |
| --- | --- | ---: | ---: | --- |
| Open the latest 40 messages | Reopen history | 483.5 ms | 83.4 ms | [baseline](baseline.json), [history](history.json) |
| Memoize rows with stable actions | Input after expanding all history | 99.5 ms | 28.2 ms | [history](history.json), [memo](memo.json) |
| Prepend 20 messages before reaching the top | Worst scroll frame | 40.3 ms | 28.4 ms | [memo](memo.json), [scroll](scroll.json) |
| Share a formatter loaded outside Suspense | Warm formatted content | 419.8 ms | 178.2 ms | [runtime](runtime.json), [format](format.json) |
| Reveal the document in a transition | First document and highlight | 389.1 ms | 100.1 ms | [source-before](source-before.json), [source](source.json) |
| Apply fonts after their stylesheet loads | Cold content with a 1-second font response | 1492.9 ms | 461.9 ms | [fonts-before](fonts-before.json), [fonts](fonts.json) |

The model runtime split removes roughly 318 kB from the entry chunk and keeps engine creation lazy and independent for chat, embeddings and vision. Its isolated local rich-content startup timing did not improve beyond run-to-run noise. Its measured benefit is a smaller initial payload. See [before](scroll.json) and [after](runtime.json). The runtime still loads when required.

Memoizing rows initially exposed the formatter's fallback delay. The formatter change removes that delay while retaining immediate readable text and a retry button if formatting fails. A lazy Settings experiment increased first opening from about 131 ms to 386 ms, so Settings stays eager. [Exploratory rejected result](settings-rejected.json).

Settings tabs were also checked. Differences of a few milliseconds are within the variation of this local test.

| Tab | Before | Final |
| --- | ---: | ---: |
| General | 107.1 ms | 98.0 ms |
| Persona | 101.8 ms | 111.2 ms |
| Skills | 68.6 ms | 73.4 ms |
| Models | 100.6 ms | 88.3 ms |
| Tools | 98.7 ms | 67.5 ms |
| Files | 95.7 ms | 96.1 ms |

Run a production preview in one terminal:

```sh
bun run build
bun run preview --host 127.0.0.1
```

Run the benchmark in another terminal. It requires agent-browser on PATH and uses private browser sessions with synthetic storage.

```sh
bun scripts/bench.ts current --check
bun scripts/bench.ts fonts --fonts
```

`--check` enforces local median budgets of 500 ms for warm startup, 150 ms for reopening history and 200 ms for the document viewer. The delayed-font mode serves the production build itself on port 4180, replacing only the external font stylesheet with a local response delayed by 1,000 ms. Use its cold measurement: the warm measurement also waits for the window load event, which includes the nonblocking stylesheet download.

Validation passed: TypeScript, production build, existing store/rank/speech/model/PDF assertions, and browser checks at 1280 × 800 and 390 × 844. Browser checks cover initial bottom positioning, scroll anchoring, all older batches, preserved storage, correct edit/fork/retry indices, skipped unchanged rows, math/code formatting, independent engines, document highlights and resizing. The UI detector returned no findings. The build still reports Vite's advisory about the entry chunk exceeding 500 kB; PDF tests emit their existing font warnings.

Some cold headless runs report an animation-frame milestone around 10 seconds even though the formatted DOM appeared in roughly 0.3–0.8 seconds. Those samples remain in the raw JSON, including separate content and frame timings. Medians do not establish reliable cold tail latency; real-browser profiling is still needed for those stalls. Model inference, weight-download throughput, voice playback and physical phones were not benchmarked.

Saved history and exports remain complete. Earlier messages mount as the reader scrolls, or with Load earlier messages. Browser find sees the mounted part of the chat. Batches remain mounted until leaving the chat; this change does not evict both ends of a fully expanded history.

## Second pass: storage and large libraries

The first fixture had one small document, which hid an avoidable library read. A second fixture contains 3,000 messages and 32 documents, each with 500 passages and 1,536-float embedding vectors. It contains 149,312,000 bytes of text and vector payload, counting text as UTF-16 and excluding object overhead. Five fresh browser sessions per checkpoint, against production builds.

| Retained change | Before | After | Samples |
| --- | ---: | ---: | --- |
| Skip unchanged history saves | 1 history write on opening | 0 | [before](storage-before.json), [history saves](storage-writes.json) |
| Read a small persisted document directory | 149,312,000 bytes of document bodies read at startup | 0 | [history saves](storage-writes.json), [directory](storage-directory.json) |
| Time spent in the startup document-body read | 128.0 ms | 0 ms | Same directory comparison |
| Open Files with the large library | 21.5 ms | 22.8 ms | Same directory comparison |

History serialization took about 1.1 ms before skipping the write and zero afterward. Completed sends also avoid a second save of the same messages. The regression check drives the completion path with a local failure, then checks that the new message and error response were saved exactly once.

Formatted-content medians for the large fixture were 285.5 ms before either change, 252.9 ms after skipping saves, and 265.0 ms after adding the directory. These timings varied between runs. The clear gain is removing document reads, allocations, and redundant writes; these samples do not establish a further startup latency improvement. Files still opens without reading the document bodies. Search loads the full library when needed and keeps its existing cache behavior afterward. Opening a citation continues to read only that document.

IndexedDB version 3 adds an `entries` store. Existing libraries populate it once during upgrade; that first upgrade still scans the existing documents. Steady-state benchmarks seed the current schema and exclude that one-time migration cost. Document and directory changes commit in the same transaction. Migration tests preserve original file bytes, vectors, and memories, check replacements and deletion, reject a partial write, and verify that adding a file does not load the whole library.

```sh
bun scripts/storage.ts current-storage --check
```

`--check` rejects any unchanged history write or document-body `getAll` during startup. Files timing waits for the actual last document name, with a 10 ms poll; it is not a paint or field interaction metric. [The regular 1,000-message regression benchmark](second-final.json) also passed its startup, history, and document-viewer budgets after these changes. TypeScript, production build, existing assertions, and desktop/narrow-browser history and source checks passed. Model inference and physical devices remain unmeasured.

A [final five-run confirmation](storage-final.json), after simplifying history persistence to remove its redundant effect, again recorded zero startup document bytes and zero history writes. Files opened in 21.6 ms and formatted content appeared in 232.2 ms. The final entry chunk is 536.80 kB, or 174.86 kB gzip; the directory adds about 0.55 kB to the first-pass build.
