declare module "sanotts-web" {
  type Sound = { samples: Float32Array; sampleRate: number };
  export class SanoTTS {
    static load(options: { assetBase: string }): Promise<SanoTTS>;
    loadVoice(key: string): Promise<{ front: Uint8Array; dec: Uint8Array }>;
    synthesize(text: string, options: { voice: string; maxSeconds: number }): Promise<Sound>;
  }
  export function playAudio(sound: Sound, options: { audioContext: AudioContext }): AudioBufferSourceNode;
}
