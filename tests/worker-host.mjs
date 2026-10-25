import { workerData, parentPort } from 'node:worker_threads';
if (workerData.clockStep) {
  let elapsed = 0;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => { elapsed += workerData.clockStep; return elapsed; } } });
}
globalThis.self = { postMessage: data => parentPort.postMessage(data), close: () => parentPort.close() };
await import('../extension/worker.js');
self.onmessage({ data: workerData.input });
