// Dependency-free ZIP packaging using uncompressed entries (ZIP method 0).
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(project, 'extension');
const version = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8')).version;
const table = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i += 1) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function list(directory, prefix = '') {
  const output = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) output.push(...await list(path.join(directory, entry.name), `${prefix}${entry.name}/`));
    else if (entry.isFile()) output.push({ name: `${prefix}${entry.name}`, data: await readFile(path.join(directory, entry.name)) });
  }
  return output;
}
const files = await list(source);
const body = [];
const directory = [];
let offset = 0;
for (const { name, data } of files) {
  const filename = Buffer.from(name);
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6); header.writeUInt16LE(0x21, 12); // UTF-8; 1980-01-01
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8); central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
  body.push(header, filename, data); directory.push(central, filename);
  offset += header.length + filename.length + data.length;
}
const centralBytes = Buffer.concat(directory);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
const output = path.join(project, 'dist', `password-lab-edge-${version}.zip`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([...body, centralBytes, end]));
console.log(`Packaged ${files.length} extension files: ${output}`);
