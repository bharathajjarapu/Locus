# Security

## Model

- Inference, embedding, document parsing and storage run in the browser
- No backend, accounts or telemetry
- Network access: model weights from Hugging Face, once
- Data stays in localStorage, IndexedDB and OPFS

## Data at rest

| Data | Store |
| --- | --- |
| Chats, settings, tool rules | localStorage |
| Library chunks, vectors | IndexedDB |
| Model weights | OPFS |

- Stored unencrypted, readable by any script on the origin
- Incognito mode skips saving chats
- Clearing site data deletes everything

## Trust boundaries

| Input | Trust |
| --- | --- |
| User message | Trusted |
| Attached files, library text | Untrusted |
| Model output | Untrusted |
| Tool results | Untrusted |

Documents and tool results enter the prompt, so they can carry prompt injection. Defenses are structural: the model cannot act without a tool call, and tool calls pass a permission gate.

## Tools

- Rule per tool: `ask` (default), `allow`, `deny`
- Stop counts as deny
- At most 3 rounds, the last offers no tools
- New tools must declare their own side effects, and default to `ask`

## Rendering

- Markdown raw HTML is escaped
- Links allow `http`, `https` and `mailto` only
- Code is escaped or highlighted by Prism, math by KaTeX with `throwOnError: false`

## Isolation

- Models run as WebAssembly in workers, outside the DOM
- Cross-origin isolation through COOP `same-origin` and COEP `credentialless`
- Model files are fetched by pinned repo and filename, without hash verification
- Weights are third-party artifacts, parsed inside wasm

## Scope

In scope:

- Tool execution, permission bypass
- Prompt injection reaching tools
- Document parsing, XSS in rendered output
- Data leaving the browser

Out of scope:

- Model hallucination or unsafe text output
- Local access to the browser profile
- Vulnerabilities in wllama, AnyDoc or model weights, unless Locus makes them exploitable
