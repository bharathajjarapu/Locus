# Wllama runtime

These are the official wllama maintainer's browser binaries from [Space revision 8b2815b](https://huggingface.co/spaces/ngxson/wllama/tree/8b2815b9db3261ca26469d1cd1052087789bccd9), built from [wllama 1a5687e](https://github.com/ngxson/wllama/commit/1a5687ef7c8b349a8bded4db334ae9c687c09b8c), with llama.cpp `5c8854fd88319125125dc4b836c98b1b215b0f23`.

The npm 3.6.1 and 3.8.1 binaries predate [Bonsai's model transforms](https://github.com/ggml-org/llama.cpp/pull/29600). They load Q2_0 but generate gibberish. Keep the existing npm wrapper and use this newer runtime through its supported assets API. Vite fingerprints the assets; compatibility files load only on browsers that need them. No runtime files come from a CDN.

| Local file | Official Space asset | SHA-256 |
| --- | --- | --- |
| engine.wasm | assets/wllama-DwTQiXOw.wasm | 473e1bb663fd8f83b9b0676fb2125534e82ec6170381d1c946217bbf8ed45297 |
| compat.wasm | assets/wllama-Mnl-XCp4.wasm | bc8723314a83575c28fb20ddaf93ad0040650ea90468e38255cb272f09bf8ac9 |
| worker.js | The compatibility worker string `u0` in assets/index-CCQLvAue.js | c6c72728521e663d31de6be6ef81381c66407552ca3ee887d16f3f5cc8465fb9 |

Replace these assets with the npm build once a release includes that fix. Recheck chat, tools, image input and embeddings whenever changing the wrapper or binaries. The generated worker is upstream code and should not be edited.
