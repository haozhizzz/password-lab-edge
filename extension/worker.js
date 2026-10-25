import { demoConfig, candidateAt, MAX_DEMO_MS } from './core.js';

self.onmessage = ({ data }) => {
  try {
    const { preset, length, target, pace } = data;
    const { alphabet, total } = demoConfig(preset, length);
    if (typeof target !== 'string' || target.length !== length || !Array.from(target).every(c => alphabet.includes(c))) {
      throw new Error('测试密码不属于当前生成配置。');
    }
    let attempts = 0;
    const started = performance.now();
    const batch = pace === 'fast' ? 5000 : 80;
    function tick() {
      let candidate = '';
      let found = false;
      for (let i = 0; i < batch && attempts < total; i += 1) {
        candidate = candidateAt(attempts, alphabet, length);
        attempts += 1;
        if (candidate === target) { found = true; break; }
        if (i % 128 === 0 && performance.now() - started >= MAX_DEMO_MS) break;
      }
      const elapsed = performance.now() - started;
      const status = found ? 'found' : attempts >= total ? 'exhausted' : elapsed >= MAX_DEMO_MS ? 'limit' : 'running';
      self.postMessage({ status, attempts, total, candidate, elapsed });
      if (status === 'running') setTimeout(tick, pace === 'fast' ? 0 : 30);
      else self.close();
    }
    tick();
  } catch (error) { self.postMessage({ status: 'error', message: error.message }); self.close(); }
};
