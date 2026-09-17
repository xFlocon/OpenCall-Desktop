"use strict";

// OpenCall RNNoise AudioWorklet.
// O WASM bruto (ArrayBuffer) é recebido via processorOptions e compilado aqui
// dentro do AudioWorkletGlobalScope. Isso evita depender de fetch/file:// e
// evita structured-clone de WebAssembly.Module entre renderer e worklet.
let rnnoiseInstance = null;
let rnnoiseHeapFloat32 = null;

class OpenCallRNNoiseProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    try {
      const raw = options?.processorOptions?.wasmBytes;
      if (!raw) throw new Error("RNNoise WASM bytes ausentes");

      if (!rnnoiseInstance) {
        let bytes;
        if (raw instanceof ArrayBuffer) bytes = raw;
        else if (ArrayBuffer.isView(raw)) bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        else throw new Error("Formato do RNNoise WASM inválido");

        const module = new WebAssembly.Module(bytes);
        rnnoiseInstance = new WebAssembly.Instance(module).exports;
        const required = ["memory", "newState", "deleteState", "getInput", "pipe"];
        for (const name of required) {
          if (!(name in rnnoiseInstance)) throw new Error(`Export RNNoise ausente: ${name}`);
        }
        rnnoiseHeapFloat32 = new Float32Array(rnnoiseInstance.memory.buffer);
      }

      this.state = rnnoiseInstance.newState();
      if (!this.state) throw new Error("RNNoise não criou estado de processamento");
      this.alive = true;
      this.port.onmessage = ({ data }) => {
        if (data?.type === "stop" || data === false) {
          this._destroy();
          return;
        }
        if (data?.type === "status" || data === true || data === "stat") {
          let vadProb = 0;
          try {
            if (typeof rnnoiseInstance.getVadProb === "function") vadProb = rnnoiseInstance.getVadProb(this.state);
          } catch (_) {}
          this.port.postMessage({ type: "status", vadProb });
        }
      };
      this.port.postMessage({ type: "ready", sampleRate });
    } catch (err) {
      this.alive = false;
      this.port.postMessage({ type: "error", message: String(err?.message || err) });
      throw err;
    }
  }

  _destroy() {
    if (!this.alive) return;
    this.alive = false;
    try { rnnoiseInstance?.deleteState?.(this.state); } catch (_) {}
    this.state = 0;
  }

  process(inputs, outputs) {
    if (!this.alive) return false;
    const input = inputs?.[0]?.[0];
    const output = outputs?.[0]?.[0];
    if (!output) return true;
    if (!input || !input.length) {
      output.fill(0);
      return true;
    }

    try {
      // A memória pode crescer; reconstrói a view se necessário.
      if (!rnnoiseHeapFloat32 || rnnoiseHeapFloat32.buffer !== rnnoiseInstance.memory.buffer) {
        rnnoiseHeapFloat32 = new Float32Array(rnnoiseInstance.memory.buffer);
      }
      const inputPtr = rnnoiseInstance.getInput(this.state) >>> 0;
      rnnoiseHeapFloat32.set(input, inputPtr >>> 2);
      const outPtr = rnnoiseInstance.pipe(this.state, output.length) >>> 0;
      if (outPtr) output.set(rnnoiseHeapFloat32.subarray(outPtr >>> 2, (outPtr >>> 2) + output.length));
      else output.fill(0);
      return true;
    } catch (err) {
      output.set(input.subarray(0, output.length));
      this.port.postMessage({ type: "error", message: String(err?.message || err) });
      this._destroy();
      return false;
    }
  }
}

registerProcessor("opencall-rnnoise", OpenCallRNNoiseProcessor);
