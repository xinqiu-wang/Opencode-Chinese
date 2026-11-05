'use strict';

// Layout of the PE .bun graph in the supported OpenCode 2.2.5 x64 build.
// The manifest pins the full binary hash before any of these offsets are used.
const fs = require('node:fs');
const path = require('node:path');

function readGraph(data) {
  const pe = data.readUInt32LE(0x3c);
  if (data.readUInt16LE(0) !== 0x5a4d || data.readUInt32LE(pe) !== 0x4550) throw new Error('不是 PE 文件。');
  const count = data.readUInt16LE(pe + 6);
  const table = pe + 24 + data.readUInt16LE(pe + 20);
  let base;
  let graphEnd;
  for (let i = 0; i < count; i++) {
    const section = table + i * 40;
    if (data.toString('ascii', section, section + 8) !== '.bun\0\0\0\0') continue;
    const start = data.readUInt32LE(section + 20);
    base = start + 8;
    graphEnd = base + Number(data.readBigUInt64LE(start));
    if (graphEnd > start + data.readUInt32LE(section + 16)) throw new Error('Bun 载荷超出区段范围。');
    break;
  }
  const trailer = '\n---- Bun! ----\n';
  const footer = graphEnd - trailer.length - 32;
  if (!base || !Number.isSafeInteger(footer) || footer <= base || graphEnd > data.length ||
      data.toString('ascii', footer + 32, graphEnd) !== trailer) throw new Error('找不到受支持的 Bun 载荷。');

  const first = base + data.readUInt32LE(footer + 8);
  const size = data.readUInt32LE(footer + 12);
  const flags = data.readUInt32LE(footer + 28);
  if (first < base || size % 52 || first + size + size / 52 * 4 > footer || flags !== 4083) {
    throw new Error('Bun 模块表布局不匹配。');
  }
  const modules = new Map();
  for (let offset = 0; offset < size; offset += 52) {
    const record = first + offset;
    const nameStart = base + data.readUInt32LE(record);
    const nameEnd = nameStart + data.readUInt32LE(record + 4);
    if (nameEnd > footer) throw new Error('Bun 模块名越界。');
    const name = data.toString('utf8', nameStart, nameEnd);
    modules.set(path.posix.basename(name), { record, hash: first + size + offset / 52 * 4 });
  }
  return { base, first, modules };
}

function relocate(data, graph, name, replacements) {
  const info = graph.modules.get(name);
  if (!info) throw new Error('缺少界面模块：' + name);
  const { record, hash } = info;
  const { base, first } = graph;
  const source = base + data.readUInt32LE(record + 8);
  const sourceLength = data.readUInt32LE(record + 12);
  const bytecode = data.readUInt32LE(record + 24);
  const capacity = data.readUInt32LE(record + 28);
  const destination = base + bytecode;
  const encoding = ['utf8', 'latin1', 'utf16le'][data[record + 48]];
  if (!encoding || !sourceLength || source + sourceLength > first ||
      !capacity || destination + capacity > first || destination % 2) {
    throw new Error('界面模块范围不匹配：' + name);
  }
  let code = data.toString(encoding, source, source + sourceLength);
  let labels = 0;
  for (const { from, to, count } of replacements) {
    const parts = code.split(from);
    if (parts.length !== count + 1) throw new Error('界面文本位置不匹配：' + name + ' ' + from);
    code = parts.join(to);
    labels += count;
  }
  const updated = Buffer.from(code, 'utf16le');
  if (updated.length + 2 > capacity) throw new Error('界面模块空间不足：' + name);
  // Reuse only this module's bytecode area. Bun reads the translated source
  // because the bytecode and cached module metadata pointers are cleared.
  updated.copy(data, destination);
  data.writeUInt16LE(0, destination + updated.length);
  data.writeUInt32LE(bytecode, record + 8);
  data.writeUInt32LE(updated.length, record + 12);
  data.fill(0, record + 24, record + 40);
  data[record + 48] = 2;
  data.writeUInt32LE(0, hash);
  return labels;
}

function applyBundle(data, rules) {
  const graph = readGraph(data);
  let labels = 0;
  for (const [name, replacements] of Object.entries(rules)) labels += relocate(data, graph, name, replacements);
  return labels;
}

module.exports = { applyBundle, readGraph };
