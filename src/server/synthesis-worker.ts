import { computeSynthesis, type SynthesisJob } from './synthesis-compute';
self.onmessage = (event: MessageEvent<SynthesisJob>) => {
  try { self.postMessage({ result: computeSynthesis(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
