// Sends mono microphone audio in batches without playing it through the speakers.
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.size = 0;
    this.stopped = false;
    this.port.onmessage = () => {
      this.send();
      this.port.postMessage({ done: true });
      this.stopped = true;
    };
  }

  // Transfers the buffered samples, including the final partial batch.
  send() {
    if (!this.size) return;
    const samples = this.buffer.slice(0, this.size);
    this.port.postMessage({ samples }, [samples.buffer]);
    this.size = 0;
  }

  // Copies each render block into a bounded buffer.
  process(inputs) {
    if (this.stopped) return false;
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (let offset = 0; offset < samples.length;) {
      const count = Math.min(samples.length - offset, this.buffer.length - this.size);
      this.buffer.set(samples.subarray(offset, offset + count), this.size);
      this.size += count;
      offset += count;
      if (this.size === this.buffer.length) this.send();
    }
    return true;
  }
}
registerProcessor("capture", Capture);
