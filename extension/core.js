// Pure, local calculations. No browser permissions or network APIs.
export const PRESETS = Object.freeze({
  digits: { label: '数字 0–9', alphabet: '0123456789' },
  hex: { label: '十六进制 0–f', alphabet: '0123456789abcdef' },
  letters: { label: '字母 a–d', alphabet: 'abcd' },
});

export const MAX_COMBINATIONS = 100_000;
export const MAX_DEMO_MS = 12_000;

export function demoConfig(preset, length) {
  const definition = Object.hasOwn(PRESETS, preset) ? PRESETS[preset] : null;
  if (!definition || !Number.isInteger(length) || length < 2 || length > 5) {
    throw new Error('请选择 2–5 位的内置测试配置。');
  }
  const total = definition.alphabet.length ** length;
  if (total > MAX_COMBINATIONS) {
    throw new Error('演示最多 100,000 种组合，请减小长度或字符集。');
  }
  return { alphabet: definition.alphabet, length, total };
}

export function candidateAt(index, alphabet, length) {
  if (!Number.isInteger(index) || index < 0 || index >= alphabet.length ** length) {
    throw new RangeError('候选索引超出范围。');
  }
  let result = '';
  for (let position = 0; position < length; position += 1) {
    result = alphabet[index % alphabet.length] + result;
    index = Math.floor(index / alphabet.length);
  }
  return result;
}

// Rejection sampling avoids modulo bias, including for the 10-character preset.
export function generateDemo(preset, length, random = globalThis.crypto) {
  const config = demoConfig(preset, length);
  const byte = new Uint8Array(1);
  const limit = 256 - (256 % config.alphabet.length);
  let target = '';
  while (target.length < length) {
    random.getRandomValues(byte);
    if (byte[0] < limit) target += config.alphabet[byte[0] % config.alphabet.length];
  }
  return { ...config, target, preset };
}

const COMMON = new Set([
  'password', 'passw0rd', 'admin', 'administrator', 'welcome', 'letmein',
  'qwerty', 'abc', 'abcd', 'abcdef', 'iloveyou', 'monkey', 'dragon',
  'login', 'test', 'changeme', 'woaini', 'mima', 'hello',
]);

export function analyzePassword(password) {
  const chars = Array.from(password);
  const length = chars.length;
  if (!length) return { length: 0, score: 0, label: '等待输入', tone: 'empty', kinds: [], pool: 0, bits: null, findings: [], tips: ['使用较长、独特的密码或随机口令短语。'] };
  const kinds = [];
  let pool = 0;
  for (const [pattern, label, size] of [
    [/[a-z]/, '小写字母', 26], [/[A-Z]/, '大写字母', 26],
    [/[0-9]/, '数字', 10], [/[!-/:-@\[-`{-~]/, '符号', 32], [/ /, '空格', 1],
  ]) {
    if (pattern.test(password)) { kinds.push(label); pool += size; }
  }
  const nonAscii = /[^\x20-\x7e]/u.test(password);
  if (nonAscii) kinds.push('其他字符');
  let score = Math.min(65, length * 3) + Math.min(25, Math.max(0, kinds.length - 1) * 8) + (length >= 16 ? 10 : 0);
  const findings = [];
  const tips = [];
  const normalized = password.toLowerCase().replace(/[013457@$]/g, c => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' })[c]);
  const stems = [normalized.replace(/[^a-z]/g, ''), password.toLowerCase().replace(/[^a-z]/g, '')];
  if (COMMON.has(password.toLowerCase()) || stems.some(stem => COMMON.has(stem))) {
    findings.push('含常见口令或其简单变体'); score = Math.min(score, 15);
    tips.push('避开常见单词加年份、数字或符号的组合。');
  }
  if (/^(.)\1+$/u.test(password) || /^(.{1,16})\1+$/u.test(password)) {
    findings.push('存在整段重复'); score = Math.min(score, 20);
    tips.push('重复相同字符或片段不会带来同等的随机性。');
  }
  const sequences = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const lower = password.toLowerCase();
  const sequential = sequences.some(sequence => {
    for (let i = 0; i <= sequence.length - 4; i += 1) if (lower.includes(sequence.slice(i, i + 4))) return true;
    return false;
  });
  if (sequential) { findings.push('含连续字符或键盘顺序'); score = Math.min(score, 35); tips.push('避免键盘顺序和连续数字。'); }
  if (/(?:19|20)\d{2}/.test(password)) { findings.push('含年份形式'); score = Math.max(0, score - 8); }
  if (/^\d+$/u.test(password) && length < 12) { score = Math.min(score, 25); findings.push('较短的纯数字组合'); }
  if (length < 14) tips.push('优先增加长度，例如使用 16 位以上的随机密码。');
  tips.push('每个账号使用独立密码；可用密码管理器生成并保存。');
  score = Math.min(100, Math.max(0, Math.round(score)));
  const tier = score <= 25 ? ['很弱', 'weak'] : score <= 50 ? ['较弱', 'fair'] : score <= 75 ? ['中等', 'medium'] : ['较强', 'strong'];
  return { length, score, label: tier[0], tone: tier[1], kinds, pool: nonAscii ? null : pool, bits: nonAscii ? null : length * Math.log2(pool), findings, tips };
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '超出估算范围';
  if (seconds < 1) return '不足 1 秒';
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} 分钟`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} 小时`;
  if (seconds < 31557600) return `${(seconds / 86400).toFixed(1)} 天`;
  const years = seconds / 31557600;
  return years >= 1e6 ? `${years.toExponential(1)} 年` : `${years.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 年`;
}

export function estimateAverageSeconds(bits, rate) {
  if (!Number.isFinite(bits) || bits < 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return (2 ** bits + 1) / (2 * rate);
}
