import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

// Execute the actual browser worker module, adapting only its message/timer host.
function createWorker(input, options = {}) {
  return new Worker(new URL('./worker-host.mjs', import.meta.url), { workerData: { input, ...options } });
}
async function run(input, options) {
  const worker = createWorker(input, options);
  const messages = [];
  try {
    return await new Promise((resolve, reject) => {
      worker.on('message', message => { messages.push(message); if (message.status !== 'running') resolve({ message, messages }); });
      worker.on('error', reject);
      worker.on('exit', code => { if (code !== 0) reject(new Error(`Worker exited ${code}`)); });
    });
  } finally { await worker.terminate(); }
}

test('actual worker finds first and last candidate with exact attempt counts', async () => {
  const first = await run({ preset: 'digits', length: 2, target: '00', pace: 'fast' });
  assert.equal(first.message.status, 'found'); assert.equal(first.message.attempts, 1);
  const last = await run({ preset: 'digits', length: 2, target: '99', pace: 'fast' });
  assert.equal(last.message.status, 'found'); assert.equal(last.message.attempts, 100); assert.equal(last.message.candidate, '99');
});
test('worker rejects external or malformed targets and excessive spaces', async () => {
  for (const input of [
    { preset: 'digits', length: 2, target: 'aa' },
    { preset: 'digits', length: 2, target: '000' },
    { preset: 'hex', length: 5, target: 'fffff' },
    { preset: 'url', length: 4, target: 'test' },
  ]) assert.equal((await run(input)).message.status, 'error');
});
test('real worker enforces time budget with a controlled monotonic clock', async () => {
  const { message } = await run({ preset: 'digits', length: 5, target: '99999', pace: 'fast' }, { clockStep: 1000 });
  assert.equal(message.status, 'limit'); assert.ok(message.elapsed >= 12000); assert.ok(message.attempts < 100000);
});
test('worker can be terminated during visual enumeration', async () => {
  const worker = createWorker({ preset: 'digits', length: 5, target: '99999', pace: 'visual' });
  await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
  const code = await worker.terminate(); assert.equal(typeof code, 'number');
});
