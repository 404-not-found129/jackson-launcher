// Jackson Launcher: one-click install and setup for every project at github.com/404-not-found129.
const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { USER, APK_URL, PROJECTS, PKG, RECIPES } = require('./recipes');

const HOME = os.homedir();
const expand = p => path.resolve(String(p).replace(/^~(?=$|\/)/, HOME));
const CFG_FILE = path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, '.config'), 'jackson-launcher', 'config.json');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); };

let cfg = readJSON(CFG_FILE, {});
let DEST = expand(cfg.dest || process.env.JACKSON_DIR || '~/jackson-projects');
const BY = Object.fromEntries(PROJECTS.map(p => [p.folder, p]));
const recordFile = () => path.join(DEST, '.jackson-launcher.json');
let records = readJSON(recordFile(), {});
const saveRecords = () => { try { writeJSON(recordFile(), records); } catch {} };

// ---------------------------------------------------------------- this computer
const has = cmd => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
function detectEnv() {
  const osr = {};
  try { for (const l of fs.readFileSync('/etc/os-release', 'utf8').split('\n')) { const m = l.match(/^(\w+)=(.*)$/); if (m) osr[m[1]] = m[2].replace(/^"|"$/g, ''); } } catch {}
  const like = `${osr.ID || ''} ${osr.ID_LIKE || ''}`.toLowerCase();
  const desk = `${process.env.XDG_CURRENT_DESKTOP || ''} ${process.env.DESKTOP_SESSION || ''}`.toLowerCase();
  return {
    linux: process.platform === 'linux', macos: process.platform === 'darwin',
    arch: /\barch\b/.test(like), steamos: osr.ID === 'steamos',
    kde: desk.includes('kde') || desk.includes('plasma'), gnome: desk.includes('gnome'),
    hyprland: desk.includes('hyprland') || !!process.env.HYPRLAND_INSTANCE_SIGNATURE,
    pm: has('pacman') ? 'pacman' : has('apt-get') ? 'apt' : has('dnf') ? 'dnf' : null,
    distro: osr.PRETTY_NAME || osr.NAME || process.platform,
  };
}
const ENV = detectEnv();
const NEED_TEXT = { linux: 'Needs Linux', arch: 'Needs Arch Linux', steamos: 'Needs SteamOS', macos: 'macOS app', kde: 'Needs KDE Plasma', gnome: 'Needs GNOME', hyprland: 'Needs Hyprland' };
const blocker = r => { for (const n of (r.needs || [])) if (!ENV[n]) return NEED_TEXT[n] || `Needs ${n}`; return null; };

function missingPkgs(names) {
  if (!ENV.pm) return [];
  const list = names.flatMap(n => (PKG[n]?.[ENV.pm] || '').split(' ').filter(Boolean));
  const check = { pacman: p => ['pacman', ['-Q', p]], apt: p => ['dpkg', ['-s', p]], dnf: p => ['rpm', ['-q', p]] }[ENV.pm];
  return [...new Set(list)].filter(p => { const [c, a] = check(p); return spawnSync(c, a, { stdio: 'ignore' }).status !== 0; });
}
const pkgCmd = pk => ({
  pacman: `sudo pacman -S --needed --noconfirm ${pk.join(' ')}`,
  apt: `sudo apt-get update && sudo apt-get install -y ${pk.join(' ')}`,
  dnf: `sudo dnf install -y ${pk.join(' ')}`,
})[ENV.pm];

// ---------------------------------------------------------------- window + events
let win;
const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };
let stateTimer = null;
const pushState = () => { if (!stateTimer) stateTimer = setTimeout(() => { stateTimer = null; send('state', state()); }, 80); };

const jobs = {};          // folder -> {kind, state, phase, pct, msg, error}
const queue = [];
let running = null;
const sessions = new Map(); // id -> {proc, folder, title}
let sessionSeq = 0;
const log = [];
const addLog = text => { log.push({ t: new Date().toTimeString().slice(0, 8), text }); log.splice(0, Math.max(0, log.length - 80)); pushState(); };

function statusOf(p) {
  const dir = path.join(DEST, p.folder);
  const present = fs.existsSync(path.join(dir, '.git')) || (fs.existsSync(dir) && fs.readdirSync(dir).length > 0);
  if (!present) return 'missing';
  const rec = records[p.folder];
  const r = RECIPES[p.folder] || {};
  const needsSetup = (r.steps?.length || r.pkgs?.length || r.inputs || r.pickFolder || r.apk) && !blocker(r);
  if (needsSetup && rec?.setup !== 'done') return 'needs-setup';
  return 'ready';
}

function state() {
  return {
    dest: DEST, env: ENV, log: log.slice(-30), version: app.getVersion(), user: USER,
    busy: !!running || queue.length > 0,
    sessions: [...sessions.entries()].map(([id, s]) => ({ id, title: s.title, folder: s.folder, live: !!s.proc })),
    projects: PROJECTS.map(p => {
      const r = RECIPES[p.folder] || {};
      const j = jobs[p.folder];
      let st = statusOf(p);
      if (j && j.kind === 'install' && (j.state === 'queued' || j.state === 'running')) st = 'missing';
      return {
        ...p, status: st, job: j || null, blocked: blocker(r), guided: !!r.guided, note: r.note || null,
        confirm: r.confirm || null, inputs: r.inputs || null, after: r.after || null, pickFolder: !!r.pickFolder,
        launch: r.launch ? { type: r.launch.type, label: r.launch.label || 'Launch' } : null,
        setupError: records[p.folder]?.setup === 'failed' ? records[p.folder].error : null,
      };
    }),
  };
}

// ---------------------------------------------------------------- terminals
// Commands run under `script` so they get a real terminal: sudo, colours and prompts behave normally.
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\r/g;
const PW_PROMPT = /(\[sudo\] password for [^:\n]*:|^Password:|password for \S+:)\s*$/im;

function startTerminal({ cmd, cwd, folder, title, answers = [], job, env = {} }) {
  const id = ++sessionSeq;
  const proc = spawn('script', ['-qfec', `stty cols 120 rows 32 2>/dev/null; ${cmd}`, '/dev/null'], {
    cwd, detached: true, env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', JACKSON_LAUNCHER: '1', ...env },
  });
  const s = { proc, folder, title, cancelled: false };
  s.kill = () => { try { process.kill(-proc.pid, 'SIGTERM'); } catch { try { proc.kill('SIGTERM'); } catch {} } };
  sessions.set(id, s);
  send('term-open', { id, title, folder, focus: !job });
  let tail = '';
  let pwWaiting = false;
  proc.stdout.on('data', d => {
    const text = d.toString();
    send('term-data', { id, data: text });
    tail = (tail + text.replace(ANSI, '')).slice(-500);
    const lines = tail.split('\n').map(l => l.trim()).filter(Boolean);
    if (job && lines.length) { jobs[job].msg = lines[lines.length - 1].slice(0, 90); pushState(); }
    if (/Sorry, try again|incorrect password/i.test(tail) && job) delete jobPw[job];
    if (!pwWaiting && PW_PROMPT.test(tail)) {
      tail = ''; pwWaiting = true;
      askPassword(folder, job).then(pw => {
        pwWaiting = false;
        if (pw == null) { s.cancelled = true; s.kill(); return; }
        proc.stdin.write(pw + '\n');
      });
      return;
    }
    for (const [re, ans] of answers) {
      if (re.test(tail)) { tail = ''; proc.stdin.write(ans + '\n'); break; }
    }
  });
  proc.stderr.on('data', d => send('term-data', { id, data: d.toString() }));
  const done = new Promise(res => proc.on('close', rawCode => {
    const code = s.cancelled ? 130 : rawCode;
    s.proc = null;
    send('term-data', { id, data: `\r\n\x1b[2m[${code === 0 ? 'finished' : 'exited with ' + code}]\x1b[0m\r\n` });
    send('term-exit', { id, code }); pushState(); res(code);
  }));
  pushState();
  return { id, done };
}

// Password: asked in the app's own dialog, kept in memory only while one install runs, never saved.
const jobPw = {};
let pwSeq = 0;
const pwWaiters = new Map();
function askPassword(folder, job) {
  if (job && jobPw[job]) return Promise.resolve(jobPw[job]);
  if (job) { jobs[job].phase = 'Waiting for your password'; pushState(); }
  const id = ++pwSeq;
  send('ask-password', { id, project: folder, user: os.userInfo().username });
  if (win && !win.isFocused()) win.flashFrame(true);
  return new Promise(res => pwWaiters.set(id, pw => {
    if (job && pw != null) jobPw[job] = pw;
    if (job) { jobs[job].phase = 'Setting up'; pushState(); }
    res(pw);
  }));
}
ipcMain.on('password', (_e, { id, pw }) => { const w = pwWaiters.get(id); if (w) { pwWaiters.delete(id); w(typeof pw === 'string' ? pw : null); } });
ipcMain.on('term-input', (_e, { id, data }) => { const s = sessions.get(id); if (s?.proc && typeof data === 'string') s.proc.stdin.write(data); });
ipcMain.on('term-close', (_e, { id }) => { const s = sessions.get(id); if (s) { if (s.proc) { s.cancelled = true; s.kill(); } sessions.delete(id); pushState(); } });

// ---------------------------------------------------------------- jobs
const setJob = (folder, patch) => { jobs[folder] = { ...(jobs[folder] || {}), ...patch }; pushState(); };

function enqueue(kind, folder, extra = {}) {
  const j = jobs[folder];
  if (j && (j.state === 'queued' || j.state === 'running')) return;
  setJob(folder, { kind, state: 'queued', phase: 'Waiting', pct: null, msg: '', error: null });
  queue.push({ kind, folder, ...extra });
  pump();
}

async function pump() {
  if (running || !queue.length) return;
  running = queue.shift();
  const { kind, folder } = running;
  setJob(folder, { state: 'running', phase: 'Starting', pct: 0 });
  try {
    if (kind === 'install') { await download(folder); await setup(folder, running.inputs); }
    else if (kind === 'download') await download(folder);
    else if (kind === 'setup') await setup(folder, running.inputs);
    else if (kind === 'update') { await update(folder); await setup(folder, null, true); }
    else if (kind === 'apk') await getApk(folder);
    const note = { install: 'Installed', download: 'Downloaded', setup: 'Set up', update: 'Updated', apk: 'APK saved' }[kind];
    setJob(folder, { state: 'done', phase: note, pct: 1, msg: '' });
    addLog(`${note}: ${folder}`);
    notify(`${folder} is ready`, RECIPES[folder]?.after || note);
  } catch (e) {
    setJob(folder, { state: 'error', pct: null, error: String(e.message || e).slice(0, 300) });
    addLog(`Failed: ${folder} (${String(e.message || e).slice(0, 80)})`);
  } finally {
    delete jobPw[folder];
    running = null; pushState(); pump();
  }
}

function runGit(args, folder, cwd) {
  return new Promise((res, rej) => {
    const p = spawn('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let tail = '';
    p.stderr.on('data', d => {
      const t = d.toString(); tail = (tail + t).slice(-400);
      const m = t.match(/(Receiving|Resolving) objects:\s+(\d+)%/g);
      if (m) {
        const last = m[m.length - 1].match(/(Receiving|Resolving) objects:\s+(\d+)%/);
        const n = +last[2] / 100;
        setJob(folder, { pct: last[1] === 'Receiving' ? 0.03 + 0.4 * n : 0.43 + 0.05 * n, msg: `${last[1]} files` });
      }
    });
    p.on('close', code => code === 0 ? res() : rej(new Error(tail.trim().split('\n').pop() || `git exited with ${code}`)));
    p.on('error', rej);
  });
}

async function download(folder) {
  const p = BY[folder];
  const dir = path.join(DEST, folder);
  if (fs.existsSync(path.join(dir, '.git'))) return;
  if (!has('git')) {
    setJob(folder, { phase: 'Installing git' });
    const t = startTerminal({ cmd: pkgCmd(['git']), cwd: HOME, folder, title: 'Installing git', job: folder });
    if (await t.done) throw new Error('Could not install git');
  }
  fs.mkdirSync(DEST, { recursive: true });
  setJob(folder, { phase: 'Downloading', pct: 0.02 });
  try {
    await runGit(['clone', '--progress', '--depth', '1', '--branch', p.branch, `https://github.com/${USER}/${p.repo}.git`, dir], folder);
  } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
}

async function update(folder) {
  const dir = path.join(DEST, folder);
  setJob(folder, { phase: 'Updating', pct: 0.2 });
  await runGit(['pull', '--ff-only'], folder, dir);
}

async function setup(folder, inputs, isUpdate) {
  const r = RECIPES[folder] || {};
  const dir = path.join(DEST, folder);
  if (blocker(r)) return;                     // download-only on this computer
  if (r.guided) return;                       // these run interactively from the Start button
  setJob(folder, { phase: 'Setting up', pct: 0.5 });

  if (inputs && r.inputs) {
    const lines = Object.entries(inputs).filter(([k, v]) => r.inputs.some(i => i.key === k) && v && /^[\x20-\x7e]{1,300}$/.test(v)).map(([k, v]) => `${k}=${v}`);
    if (lines.length) { fs.writeFileSync(path.join(dir, '.env'), lines.join('\n') + '\n', { mode: 0o600 }); }
  }

  if (r.pkgs?.length) {
    const need = missingPkgs(r.pkgs);
    if (need.length) {
      setJob(folder, { phase: `Installing ${need.length} system package${need.length > 1 ? 's' : ''}`, pct: 0.55 });
      const t = startTerminal({ cmd: pkgCmd(need), cwd: dir, folder, title: `${folder}: packages`, job: folder });
      const code = await t.done;
      if (code) {
        const msg = code === 130 ? 'Setup cancelled. Click Finish setup to try again.' : `Couldn't install ${need.join(', ')}. See the terminal tab.`;
        records[folder] = { setup: 'failed', error: msg }; saveRecords();
        throw new Error(msg);
      }
    }
  }

  const steps = r.steps || [];
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    setJob(folder, { phase: steps.length > 1 ? `Setting up (${i + 1} of ${steps.length})` : 'Setting up', pct: 0.65 + 0.3 * (i / steps.length) });
    const t = startTerminal({ cmd: st.cmd, cwd: dir, folder, title: `${folder}: setup`, answers: st.answers, job: folder });
    const code = await t.done;
    if (code && (!st.optional || code === 130)) {
      const msg = code === 130 ? 'Setup cancelled. Click Finish setup to try again.' : `Setup stopped (exit ${code}). See the terminal tab for details.`;
      records[folder] = { setup: 'failed', error: msg }; saveRecords();
      throw new Error(msg);
    }
  }

  if (r.pickFolder && !isUpdate) {
    setJob(folder, { phase: 'Choose a game folder' });
    const res = await dialog.showOpenDialog(win, { title: r.pickFolder.title, properties: ['openDirectory'] });
    if (res.canceled || !res.filePaths[0]) throw new Error('No game folder chosen. Use "Add to a game" to try again.');
    const to = path.join(res.filePaths[0], r.pickFolder.into);
    fs.mkdirSync(to, { recursive: true });
    fs.copyFileSync(path.join(dir, r.pickFolder.file), path.join(to, r.pickFolder.file));
    addLog(`Copied ${r.pickFolder.file} to ${to}`);
  }

  if (r.apk) { try { await getApk(folder); } catch (e) { addLog(`APK skipped: ${e.message}`); } }

  records[folder] = { setup: 'done', at: new Date().toISOString() }; saveRecords();
  setJob(folder, { pct: 0.98 });
}

async function getApk(folder) {
  const out = path.join(DEST, 'aura-chatbot-apk', path.basename(APK_URL));
  if (fs.existsSync(out)) return;
  setJob(folder, { phase: 'Downloading Android APK' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const res = await fetch(APK_URL);
  if (!res.ok) throw new Error(`APK download failed (${res.status})`);
  fs.writeFileSync(out + '.part', Buffer.from(await res.arrayBuffer()));
  fs.renameSync(out + '.part', out);
}

function launch(folder) {
  const r = RECIPES[folder] || {};
  const dir = path.join(DEST, folder);
  const L = r.launch;
  if (!L) return shell.openPath(dir);
  if (L.type === 'open') return shell.openPath(path.join(dir, L.path));
  if (L.type === 'gui') {
    const p = spawn('sh', ['-c', L.cmd], { cwd: dir, detached: true, stdio: 'ignore' });
    p.on('error', () => {}); p.unref();
    addLog(`Started ${folder}`);
    return;
  }
  if (L.type === 'term') startTerminal({ cmd: L.cmd, cwd: dir, folder, title: folder });
}

function notify(title, body) {
  try { const { Notification } = require('electron'); if (Notification.isSupported() && win && !win.isFocused()) new Notification({ title, body: body || '' }).show(); } catch {}
}

// ---------------------------------------------------------------- actions from the window
ipcMain.handle('state', () => state());
ipcMain.handle('act', async (_e, { action, folder, inputs, dest }) => {
  if (folder != null && !BY[folder]) throw new Error('Unknown project');
  switch (action) {
    case 'install': return enqueue(blocker(RECIPES[folder] || {}) ? 'download' : 'install', folder, { inputs });
    case 'setup': return enqueue('setup', folder, { inputs });
    case 'update': return enqueue('update', folder);
    case 'apk': return enqueue('apk', folder);
    case 'launch': return launch(folder);
    case 'open': return shell.openPath(path.join(DEST, folder));
    case 'github': return shell.openExternal(`https://github.com/${USER}/${encodeURIComponent(BY[folder].repo)}`);
    case 'remove': {
      const j = jobs[folder];
      if (j && (j.state === 'queued' || j.state === 'running')) throw new Error('Wait for it to finish first');
      const dir = path.join(DEST, folder);
      if (path.dirname(dir) !== DEST) throw new Error('Bad path');
      fs.rmSync(dir, { recursive: true, force: true });
      delete records[folder]; saveRecords(); delete jobs[folder];
      addLog(`Removed: ${folder}`); return;
    }
    case 'installAll':
      for (const p of PROJECTS) {
        const r = RECIPES[p.folder] || {};
        if (statusOf(p) === 'missing' && !r.confirm && !r.inputs && !r.pickFolder) enqueue(blocker(r) ? 'download' : 'install', p.folder);
      }
      return;
    case 'updateAll':
      for (const p of PROJECTS) if (statusOf(p) !== 'missing') enqueue('update', p.folder);
      return;
    case 'openDest': fs.mkdirSync(DEST, { recursive: true }); return shell.openPath(DEST);
    case 'setDest': {
      if (running || queue.length) throw new Error('Wait for installs to finish first');
      const d = expand(String(dest || '').trim());
      if (!path.isAbsolute(d)) throw new Error('Use a full path, like ~/jackson-projects');
      DEST = d; cfg.dest = d; writeJSON(CFG_FILE, cfg);
      records = readJSON(recordFile(), {}); for (const k in jobs) delete jobs[k];
      addLog(`Install folder: ${d}`); return;
    }
    default: throw new Error('Unknown action');
  }
});

// ---------------------------------------------------------------- app menu entry (AppImage)
function integrate() {
  // Runs from an AppImage or an installed copy; skipped when started with `npm start` during development.
  const appimage = process.env.APPIMAGE || (app.isPackaged ? process.execPath : null);
  if (!appimage || process.platform !== 'linux') return;
  // Installed by a package manager (e.g. the AUR package): the package ships its own menu entry.
  if (!process.env.APPIMAGE && /^\/(opt|usr)\//.test(process.execPath)) return;
  const data = process.env.XDG_DATA_HOME || path.join(HOME, '.local/share');
  const icon = path.join(data, 'icons/hicolor/512x512/apps/jackson-launcher.png');
  const entry = path.join(data, 'applications/jackson-launcher.desktop');
  const text = `[Desktop Entry]\nType=Application\nName=Jackson Launcher\nComment=Install and set up Jackson's projects in one click\nExec="${appimage}" %U\nIcon=jackson-launcher\nTerminal=false\nCategories=Utility;\nStartupWMClass=jackson-launcher\n`;
  try {
    if (!fs.existsSync(entry) || fs.readFileSync(entry, 'utf8') !== text) {
      fs.mkdirSync(path.dirname(icon), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'build', 'icon.png'), icon);
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      fs.writeFileSync(entry, text);
      spawn('update-desktop-database', [path.dirname(entry)], { stdio: 'ignore' }).on('error', () => {});
    }
  } catch {}
}

// ---------------------------------------------------------------- start
app.setName('Jackson Launcher');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  integrate();
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 900, minHeight: 600,
    title: 'Jackson Launcher', backgroundColor: '#121a0c', autoHideMenuBar: true,
    icon: nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('focus', () => win.flashFrame(false));
});

app.on('before-quit', e => {
  if ((running || queue.length) && !app._forceQuit) {
    const c = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Keep installing', 'Quit anyway'], defaultId: 0, message: 'An install is still running.', detail: 'Quitting now stops it. You can finish it later with "Finish setup".' });
    if (c === 0) { e.preventDefault(); return; }
    app._forceQuit = true;
  }
  for (const s of sessions.values()) if (s.proc) s.kill();
});
app.on('window-all-closed', () => app.quit());
