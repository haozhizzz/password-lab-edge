import { analyzePassword, demoConfig, generateDemo, formatDuration, estimateAverageSeconds } from './core.js';

const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('zh-CN');
let demo = null;
let worker = null;
let started = 0;
let lastUpdate = null;

function renderEstimate(result = analyzePassword($('password').value)) {
  if (result.length && result.findings.length) {
    $('estimate-time').textContent = '存在可预测模式';
    $('estimate-details').textContent = '此输入不满足独立随机生成假设，因此不展示容易高估强度的随机模型耗时。请参考上方观察与建议。';
    return;
  }
  const seconds = result.bits === null ? null : estimateAverageSeconds(result.bits, Number($('assumed-rate').value));
  $('estimate-time').textContent = !result.length ? '输入示例后查看' : seconds === null ? '此字符集不提供估算' : formatDuration(seconds);
  $('estimate-details').textContent = !result.length || seconds === null
    ? '平均时间 =（字符池大小 ^ 长度 + 1）÷（2 × 每秒尝试次数）'
    : `假设 ${result.length} 个字符在 ${result.pool} 种字符中独立随机选取；此模型不扣除上方发现的人为模式。`;
}

function renderStrength() {
  const result = analyzePassword($('password').value);
  $('strength-result').dataset.tone = result.tone;
  $('strength-label').textContent = result.label;
  $('score').textContent = result.length ? result.score : '—';
  $('strength-meter').value = result.score;
  $('length').textContent = result.length || '—';
  $('kind-count').textContent = result.length ? result.kinds.length : '—';
  $('bits').textContent = result.bits === null ? '—' : `${result.bits.toFixed(1)} bit`;
  $('kinds').replaceChildren(...(result.kinds.length ? result.kinds : ['输入后显示字符结构']).map(text => {
    const span = document.createElement('span'); span.className = 'chip'; span.textContent = text; return span;
  }));
  $('advice-list').replaceChildren(...[...result.findings, ...result.tips].map(text => {
    const li = document.createElement('li'); li.textContent = text; return li;
  }));
  renderEstimate(result);
}

function setError(message = '') { $('demo-error').hidden = !message; $('demo-error').textContent = message; }

function setRunning(running) {
  $('start').disabled = running || !demo;
  $('stop').disabled = !running;
  for (const id of ['generate', 'preset', 'demo-length', 'pace']) $(id).disabled = running;
}

function resetStats() {
  lastUpdate = null;
  $('attempts').textContent = '0'; $('elapsed').textContent = '0.000 s'; $('rate').textContent = '—';
  $('candidate').textContent = '••••'; $('demo-progress').value = 0; $('progress-label').textContent = '0.00%';
  $('demo-status').textContent = '准备就绪，点击开始演示。'; $('terminal-state').textContent = 'READY';
}

function newDemo() {
  if (worker) return;
  setError(); resetStats();
  try {
    demo = generateDemo($('preset').value, Number($('demo-length').value));
    $('target').textContent = demo.target; $('search-space').textContent = number(demo.total);
  } catch (error) {
    demo = null; $('target').textContent = '—'; $('search-space').textContent = '—'; setError(error.message);
    $('demo-status').textContent = '请调整测试配置。'; $('terminal-state').textContent = 'CONFIG';
  }
  setRunning(false);
}

function renderProgress(data) {
  lastUpdate = data;
  $('attempts').textContent = number(data.attempts);
  $('elapsed').textContent = data.elapsed < 1 ? '< 0.001 s' : `${(data.elapsed / 1000).toFixed(3)} s`;
  $('rate').textContent = data.elapsed > 0 ? `${number(Math.round(data.attempts / (data.elapsed / 1000)))} /s` : '—';
  $('candidate').textContent = data.candidate || '••••';
  $('demo-progress').value = data.attempts / data.total * 100;
  $('progress-label').textContent = `${(data.attempts / data.total * 100).toFixed(2)}%`;
}

function stopDemo(silent = false) {
  if (!worker) return;
  worker.terminate(); worker = null;
  if (!silent) {
    if (lastUpdate) renderProgress({ ...lastUpdate, elapsed: performance.now() - started });
    else $('elapsed').textContent = `${((performance.now() - started) / 1000).toFixed(3)} s`;
    $('demo-status').textContent = '已停止，可重新开始。'; $('terminal-state').textContent = 'STOPPED';
  }
  setRunning(false);
}

function startDemo() {
  if (!demo || worker) return;
  resetStats(); setError();
  try {
    demoConfig(demo.preset, demo.length);
    const instance = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker = instance; started = performance.now(); setRunning(true);
    $('demo-status').textContent = '正在逐个比较候选…'; $('terminal-state').textContent = 'RUNNING';
    instance.onmessage = ({ data }) => {
      if (worker !== instance) return;
      if (data.status === 'error') {
        stopDemo(true); setError(data.message); $('demo-status').textContent = '演示未能运行。'; $('terminal-state').textContent = 'ERROR'; return;
      }
      renderProgress(data);
      if (data.status !== 'running') {
        worker.terminate(); worker = null; setRunning(false);
        const labels = {
          found: ['已找到匹配的测试密码。', 'MATCHED'],
          limit: ['已达到 12 秒上限；可减小长度或切换快速运行。', 'TIME LIMIT'],
          exhausted: ['已遍历完整测试空间。', 'COMPLETE'],
        };
        const label = labels[data.status];
        $('demo-status').textContent = label[0]; $('terminal-state').textContent = label[1];
      }
    };
    instance.onerror = event => {
      if (worker !== instance) return;
      event.preventDefault(); stopDemo(true); setError('本地计算线程启动失败，请重新加载插件页面。');
      $('demo-status').textContent = '演示未能运行。'; $('terminal-state').textContent = 'ERROR';
    };
    instance.postMessage({ preset: demo.preset, length: demo.length, target: demo.target, pace: $('pace').value });
  } catch (error) { stopDemo(true); setRunning(false); setError(error.message); }
}

function hidePassword() {
  $('password').type = 'password'; $('toggle-password').textContent = '显示';
  $('toggle-password').setAttribute('aria-pressed', 'false'); $('toggle-password').setAttribute('aria-label', '显示密码');
}

$('password').addEventListener('input', renderStrength);
$('assumed-rate').addEventListener('change', () => renderEstimate());
$('toggle-password').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password'; $('toggle-password').textContent = show ? '隐藏' : '显示';
  $('toggle-password').setAttribute('aria-pressed', String(show)); $('toggle-password').setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
});
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => {
  const samples = { weak: 'Password123!', phrase: 'river lantern meadow orbit' };
  if (button.dataset.sample === 'random') {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?';
    const byte = new Uint8Array(1);
    const limit = 256 - (256 % alphabet.length);
    let sample = '';
    while (sample.length < 24) {
      crypto.getRandomValues(byte);
      if (byte[0] < limit) sample += alphabet[byte[0] % alphabet.length];
    }
    $('password').value = sample;
  } else $('password').value = samples[button.dataset.sample];
  hidePassword(); renderStrength();
}));
$('preset').addEventListener('change', newDemo);
$('demo-length').addEventListener('change', newDemo);
$('generate').addEventListener('click', newDemo);
$('start').addEventListener('click', startDemo);
$('stop').addEventListener('click', () => stopDemo());
$('clear-all').addEventListener('click', () => {
  stopDemo(true); $('password').value = ''; hidePassword(); renderStrength();
  demo = null; resetStats(); $('target').textContent = '已清空'; $('search-space').textContent = '—';
  $('demo-status').textContent = '点击“换一个”生成新的测试密码。'; setError(); setRunning(false);
});
window.addEventListener('pagehide', () => { stopDemo(true); $('password').value = ''; demo = null; $('target').textContent = '已清空'; });
window.addEventListener('pageshow', event => { if (event.persisted) { hidePassword(); renderStrength(); newDemo(); } });
renderStrength(); newDemo();
