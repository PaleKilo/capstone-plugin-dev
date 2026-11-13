#!/usr/bin/env node
// [테스트 전용] 대시보드 서버 기동/정지/종료 도구. Dataiku 전환 시 이 플러그인 전체를 제거한다.
//
//   status                      포트/프로세스 상태 (읽기 전용)
//   start     [--confirm]       서버 기동 (--confirm 없으면 dry-run)
//   stop      [--confirm]       이 도구가 띄운 프로세스(PID 파일)만 종료
//   terminate [--confirm]       온라인 서버를 기동 주체와 무관하게 종료 (대상 검증 후)
//
// 모든 쓰기성 동작은 사용자 승인 후 --confirm 으로만 실행된다. 출력은 JSON.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXIT = { OK: 0, USAGE: 2, PORT_CONFLICT: 20, START_TIMEOUT: 21, TARGET_MISMATCH: 22, TERMINATE_FAILED: 23, ROOT_MISSING: 24, REMOTE_TARGET: 25 };

const env = process.env;
// 배포 이식성: 절대경로 기본값 없음. 미설정이면 start 시 ROOT_MISSING(24)으로 안내한다.
const root = (env.MEETING_DASHBOARD_ROOT || env.CLAUDE_PLUGIN_OPTION_DASHBOARD_ROOT || '').trim();
const ROOT_HINT = '대시보드 폴더가 설정되지 않았거나 올바르지 않습니다. /plugin configure meeting-dev@meeting-plugin 에서 dashboard_root 를 지정하거나 환경변수 MEETING_DASHBOARD_ROOT 를 설정하세요.';
const port = Number(env.MEETING_DASHBOARD_PORT || env.CLAUDE_PLUGIN_OPTION_PORT || 3000);
const base = `http://127.0.0.1:${port}`;
const dataDir = env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.claude', 'meeting-dev');
const pidFile = path.join(dataDir, 'devserver.pid');
const logFile = path.join(dataDir, 'devserver.log');

const flags = new Set(process.argv.slice(3));
const cmd = process.argv[2];

function emit(obj, code = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
}

/**
 * meeting 플러그인의 현재 대상(환경변수 → /meeting:connect 로 저장한 연결)이 로컬이 아닌 원격(Vercel 등)이면 그 주소를 돌려준다.
 * 원격 대시보드에 연결된 상태에서 로컬 서버를 켜는 것은 의미가 없으므로 start 를 막는 데 쓴다.
 */
function remoteTarget() {
  let url = (env.MEETING_DASHBOARD_URL || '').trim();
  if (!url) {
    try {
      const dir = (env.MEETING_STATE_DIR || '').trim() || path.join(os.homedir(), '.claude', 'meeting');
      url = JSON.parse(readFileSync(path.join(dir, 'connection.json'), 'utf8')).dashboardUrl || '';
    } catch { /* 저장된 연결 없음 */ }
  }
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(host) ? null : url;
  } catch {
    return null;
  }
}

function ps(script) {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 15000 }).trim();
}

async function isOnline() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${base}/api/weeks`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    const j = await r.json();
    return r.ok && Array.isArray(j?.availableWeeks);
  } catch {
    return false;
  }
}

/** 포트를 LISTEN 중인 프로세스 정보 (없으면 null) */
function listenerOnPort() {
  try {
    const out = ps(`$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $c.OwningProcess); [pscustomobject]@{ pid = $c.OwningProcess; name = $p.Name; cmdline = $p.CommandLine } | ConvertTo-Json -Compress }`);
    return out ? JSON.parse(out) : null;
  } catch {
    return null;
  }
}

function isDashboardProcess(info) {
  if (!info?.cmdline) return false;
  const rootNorm = root.replace(/\\/g, '/').toLowerCase();
  const cl = info.cmdline.replace(/\\/g, '/').toLowerCase();
  if (!/(^|[\\/" ])node(\.exe)?"? /.test(info.cmdline.toLowerCase()) && !/^node(\.exe)?$/i.test(info.name || '')) return false;
  if (!/src\/middle\/server\.js/.test(cl)) return false;
  const abs = cl.match(/([a-z]:\/[^"]*src\/middle\/server\.js)/);
  if (abs) return rootNorm ? abs[1].startsWith(rootNorm) : true; // root 미설정이어도 server.js 경로 패턴은 이미 검증됨
  return true; // 상대 경로로 기동된 경우(npm start 등)
}

function readPid() {
  try { return Number(readFileSync(pidFile, 'utf8').trim()) || null; } catch { return null; }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitFor(fn, ms, step = 500) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

async function main() {
  if (cmd === 'status') {
    const online = await isOnline();
    const l = listenerOnPort();
    return emit({ ok: true, data: { online, base, port, root, remoteTarget: remoteTarget(), rootExists: Boolean(root) && existsSync(root), listener: l && { ...l, isDashboard: isDashboardProcess(l) }, pidFile: readPid(), logFile } });
  }

  if (cmd === 'start') {
    const remote = remoteTarget();
    if (remote) {
      return emit({ ok: false, error: { name: 'TESTKIT_REMOTE_TARGET', message: `meeting 플러그인이 원격 대시보드(${remote})에 연결되어 있어 로컬 서버를 기동하지 않습니다. 로컬 서버를 쓰려면 먼저 /meeting:connect http://127.0.0.1:${port} 로 다시 연결하거나 /meeting:connect --reset 으로 연결을 초기화하세요.`, remote } }, EXIT.REMOTE_TARGET);
    }
    if (!root || !existsSync(path.join(root, 'src', 'middle', 'server.js'))) return emit({ ok: false, error: { name: 'ROOT_MISSING', message: `${ROOT_HINT}${root ? ` (현재 값: ${root})` : ''}` } }, EXIT.ROOT_MISSING);
    if (await isOnline()) return emit({ ok: true, data: { alreadyRunning: true, base } });
    const l = listenerOnPort();
    if (l) return emit({ ok: false, error: { name: 'TESTKIT_PORT_CONFLICT', message: `포트 ${port}를 다른 프로세스가 점유 중이며 대시보드 API에 응답하지 않습니다.`, listener: l } }, EXIT.PORT_CONFLICT);
    if (!flags.has('--confirm')) return emit({ ok: true, data: { dryRun: true, wouldRun: `node ./src/middle/server.js (cwd=${root}, PORT=${port})`, note: '사용자 승인 후 --confirm 으로 재실행' } });

    mkdirSync(dataDir, { recursive: true });
    const out = openSync(logFile, 'a');
    const child = spawn(process.execPath, ['./src/middle/server.js'], { cwd: root, detached: true, stdio: ['ignore', out, out], windowsHide: true, env: { ...process.env, PORT: String(port) } });
    child.unref();
    writeFileSync(pidFile, String(child.pid));
    const up = await waitFor(isOnline, 15000);
    if (!up) {
      let tail = '';
      try { tail = readFileSync(logFile, 'utf8').split(/\r?\n/).slice(-15).join('\n'); } catch { /* ignore */ }
      return emit({ ok: false, error: { name: 'TESTKIT_START_TIMEOUT', message: '15초 내에 대시보드가 응답하지 않았습니다.', logTail: tail } }, EXIT.START_TIMEOUT);
    }
    return emit({ ok: true, data: { started: true, pid: child.pid, base, logFile } });
  }

  if (cmd === 'stop') {
    const pid = readPid();
    if (!pid || !pidAlive(pid)) {
      rmSync(pidFile, { force: true });
      return emit({ ok: true, data: { stopped: false, note: '이 도구가 기동한 실행 중 프로세스가 없습니다. (외부 기동 서버는 terminate 사용)' } });
    }
    if (!flags.has('--confirm')) return emit({ ok: true, data: { dryRun: true, targetPid: pid, note: '승인 후 --confirm' } });
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 아래 확인 */ }
    const gone = await waitFor(async () => !pidAlive(pid), 5000, 250);
    if (!gone) return emit({ ok: false, error: { name: 'TESTKIT_TERMINATE_FAILED', message: `PID ${pid} 종료 실패` } }, EXIT.TERMINATE_FAILED);
    rmSync(pidFile, { force: true });
    return emit({ ok: true, data: { stopped: true, pid } });
  }

  if (cmd === 'terminate') {
    const online = await isOnline();
    const l = listenerOnPort();
    if (!online && !l) return emit({ ok: true, data: { terminated: false, note: '이미 꺼져 있습니다.' } });
    if (!l) return emit({ ok: false, error: { name: 'TESTKIT_TARGET_MISMATCH', message: '온라인이지만 포트 소유 프로세스를 식별하지 못했습니다. 종료하지 않습니다.' } }, EXIT.TARGET_MISMATCH);
    const target = { ...l, isDashboard: isDashboardProcess(l), onlineApi: online };
    if (!target.isDashboard) return emit({ ok: false, error: { name: 'TESTKIT_TARGET_MISMATCH', message: '포트 소유 프로세스가 대시보드 서버(node src/middle/server.js)로 확인되지 않아 종료하지 않습니다.', target } }, EXIT.TARGET_MISMATCH);
    if (!flags.has('--confirm')) return emit({ ok: true, data: { dryRun: true, target, warning: '종료하면 인메모리 편집 내용이 사라집니다. 승인 후 --confirm', } });

    // 창 없는 백그라운드 node 는 /F 없이는 종료되지 않는다. 대상 PID 는 위에서 검증·승인되었고,
    // 이 서버는 디스크에 flush 할 상태가 없으므로(인메모리 전용) 강제 종료가 안전하다.
    try { execFileSync('taskkill', ['/PID', String(l.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 아래 확인 */ }
    const freed = await waitFor(async () => !listenerOnPort(), 5000, 250);
    if (!freed) return emit({ ok: false, error: { name: 'TESTKIT_TERMINATE_FAILED', message: `PID ${l.pid} 종료 후에도 포트 ${port}가 해제되지 않았습니다. 권한 문제일 수 있습니다.`, target } }, EXIT.TERMINATE_FAILED);
    rmSync(pidFile, { force: true });
    return emit({ ok: true, data: { terminated: true, pid: l.pid, portFreed: true } });
  }

  emit({ ok: false, error: { name: 'USAGE', message: '사용법: status | start | stop | terminate [--confirm]' } }, EXIT.USAGE);
}

main().catch((e) => emit({ ok: false, error: { name: 'UNEXPECTED', message: String(e?.message || e) } }, 1));
