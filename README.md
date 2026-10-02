# Locus

Private AI chat that runs entirely in your browser. [LFM2.5 230M](https://huggingface.co/LiquidAI/LFM2.5-230M-GGUF) (QAD Q4_0, 149 MB) runs on WebGPU through [wllama](https://github.com/ngxson/wllama), with a CPU fallback. Nothing leaves your machine.

## Features

- Streaming replies with Markdown, KaTeX math and code highlighting
- Chats saved to localStorage, with rename, fork, edit, retry and incognito mode
- Voice dictation through the Web Speech API
- Export and import backups
- Light and dark themes

## Stack

React 19, Vite, Tailwind CSS 4 (+ typography), stock shadcn/ui on Base UI, Hugeicons, wllama. Fonts: Bricolage Grotesque and JetBrains Mono.

## Develop

```bash
bun install
bun dev          # http://localhost:5173
bun run check    # typecheck
bun src/lib/store.test.ts
```

The dev and preview servers send `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers so wllama can use threads. Set the same headers on any host you deploy to.

## License

MIT
