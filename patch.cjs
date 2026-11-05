'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const profiles = require('./profiles.json');
const home = process.env.USERPROFILE;
if (!home || !path.isAbsolute(home)) throw new Error('找不到 Windows 用户目录。');
const store = path.join(home, 'OpencodeChinesePortable');
const managed = path.join(store, 'bin', 'opencode.exe');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const token = () => crypto.randomBytes(8).toString('hex');

function reportProgress(progress, phase) {
  if (process.env.OPENCODE_ZH_PROGRESS === '1') {
    process.stderr.write(JSON.stringify({ progress, phase }) + '\n');
  }
}

function inspect(file) {
  const absolute = fs.realpathSync.native(file);
  if (path.basename(absolute).toLowerCase() !== 'opencode.exe' || !fs.statSync(absolute).isFile()) {
    throw new Error('请选择实际的 opencode.exe，不能选择 npm 的 .cmd 或桌面客户端。');
  }
  const data = fs.readFileSync(absolute);
  const hash = sha(data);
  const profile = profiles.find(p => p.original === hash || p.patched === hash || Object.hasOwn(p.previous ?? {}, hash));
  if (!profile) throw new Error('这个 OpenCode 发行包暂不支持。原文件没有改动。SHA-256: ' + hash);
  return { absolute, data, hash, profile, patched: hash !== profile.original };
}

function stage(target, data) {
  const tmp = path.join(path.dirname(target), '.opencode-zh-' + token() + '.exe');
  try {
    fs.writeFileSync(tmp, data, { flag: 'wx', flush: true });
    return tmp;
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function patch(info) {
  const { profile, data } = info;
  reportProgress(50, '正在生成中文界面资源');
  const labels = require('./bundle.cjs').applyBundle(data, profile.modules);
  if (labels !== profile.labels) throw new Error('翻译条目数量不匹配。');
  if (sha(data) !== profile.patched) throw new Error('注入结果校验失败，已取消。');
  return data;
}

function checkedReplace(target, data, expectedHash, verify) {
  reportProgress(60, '正在写入临时副本');
  const tmp = stage(target, data);
  try {
    if (verify) {
      const env = { ...process.env, NO_COLOR: '1' };
      reportProgress(70, '正在验证程序版本');
      const version = spawnSync(tmp, ['--version'], { encoding: 'utf8', timeout: 45000, windowsHide: true, env });
      reportProgress(82, '正在验证中文帮助');
      const help = spawnSync(tmp, ['--help'], { encoding: 'utf8', timeout: 45000, windowsHide: true, env });
      if (version.status !== 0 || version.stdout?.trim() !== verify.versionOutput ||
          help.status !== 0 || !help.stdout?.includes(verify.helpMarker)) {
        throw new Error('汉化副本未通过版本和中文帮助检查，已取消。版本：' + (version.error?.code ?? version.status) + '；帮助：' + (help.error?.code ?? help.status) + '。');
      }
    }
    reportProgress(92, '正在核对目标文件');
    if (sha(fs.readFileSync(target)) !== expectedHash) throw new Error('文件在操作期间发生变化，请重新检查。');
    reportProgress(96, '正在替换已验证的程序');
    fs.renameSync(tmp, target);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function backupPath(profile) {
  return path.join(store, 'backup', profile.original, 'opencode.exe');
}

function verifiedBackup(profile) {
  const file = backupPath(profile);
  if (!fs.existsSync(file)) throw new Error('没有找到原版备份，无法恢复。');
  const data = fs.readFileSync(file);
  if (sha(data) !== profile.original) throw new Error('原版备份校验失败，无法恢复。');
  return data;
}

function saveBackup(info) {
  reportProgress(30, '正在保存并核对英文原版备份');
  const file = backupPath(info.profile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const tmp = stage(file, info.data);
    try {
      try { fs.linkSync(tmp, file); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  verifiedBackup(info.profile);
}

function status(file) {
  const info = inspect(file);
  return { file: info.absolute, version: info.profile.version, variant: info.profile.variant,
    patched: info.patched, updateAvailable: info.patched && info.hash !== info.profile.patched,
    edits: info.profile.previous?.[info.hash] ?? info.profile.labels, backup: backupPath(info.profile) };
}

function mutate(action, input) {
  const target = fs.realpathSync.native(input);
  const lock = path.join(path.dirname(target), '.opencode-zh.lock');
  let fd;
  try {
    fd = fs.openSync(lock, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('这个目录已有汉化操作在进行。请关闭其他工具窗口；如上次操作被强制中断，确认无操作运行后删除 .opencode-zh.lock。');
    throw error;
  }
  try {
    reportProgress(10, '正在核对 OpenCode 发行文件');
    const info = inspect(target);
    if (action === 'apply' && info.hash !== info.profile.patched) {
      if (!info.patched) saveBackup(info);
      const original = info.patched ? verifiedBackup(info.profile) : info.data;
      checkedReplace(target, patch({ ...info, data: original }), info.hash, info.profile);
    } else if (action === 'restore' && info.patched) {
      checkedReplace(target, verifiedBackup(info.profile), info.hash);
    }
    return status(target);
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}

function importOriginal(input) {
  reportProgress(10, '正在核对独立副本的原版来源');
  const info = inspect(input);
  const original = info.patched ? verifiedBackup(info.profile) : info.data;
  fs.mkdirSync(path.dirname(managed), { recursive: true });
  const tmp = stage(managed, original);
  try {
    try { fs.linkSync(tmp, managed); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('独立目录已经有 OpenCode。请在工具中直接使用，或先自行移出旧文件。');
      throw error;
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return status(managed);
}

try {
  const [action, file = managed] = process.argv.slice(2);
  let result;
  if (action === 'managed') result = { file: managed, store };
  else if (action === 'status') result = status(file);
  else if (action === 'import') result = importOriginal(file);
  else if (action === 'apply' || action === 'restore') result = mutate(action, file);
  else throw new Error('可用操作：managed、status、import、apply、restore。');
  reportProgress(100, '操作完成');
  console.log(JSON.stringify(result));
} catch (error) {
  const locked = ['EBUSY', 'EACCES', 'EPERM'].includes(error.code);
  console.log(JSON.stringify({ error: locked ? '文件正在使用或当前账号没有写权限。请退出 OpenCode 后重试。' : error.message }));
  process.exitCode = 1;
}
