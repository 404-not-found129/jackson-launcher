const L = window.launcher;
const $ = s => document.querySelector(s);
const CATS = { all: 'All projects', installed: 'Installed', desktop: 'Linux desktop', tools: 'Apps and tools', gaming: 'Gaming', system: 'System setup', learn: 'Learning' };
const LANG = { Python: '#3572A5', Shell: '#89e051', HTML: '#e34c26', Swift: '#F05138', CSS: '#663399', C: '#a8b9cc', Go: '#00ADD8', JavaScript: '#f1e05a', HLSL: '#aace60' };
const icon = (f, size) => `<span class="appi" style="--c:${ICOL[f] || '#3a5bc7'};--s:${size || 46}px"><svg class="ci" viewBox="0 0 64 64" aria-hidden="true">${ICONS[f] || ICONS['arch-aur-install']}</svg></span>`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const size = kb => kb < 1024 ? kb + ' KB' : (kb / 1024 >= 10 ? Math.round(kb / 1024) : (kb / 1024).toFixed(1)) + ' MB';
const busy = p => p.job && (p.job.state === 'queued' || p.job.state === 'running');
let S = null, view = 'all', query = '';

async function act(action, args) {
  try { await L.act(action, args); } catch (e) { alertBox("Couldn't do that", String(e.message || e).replace(/^Error invoking remote method 'act': (Error: )?/, '')); }
}

// ------------------------------------------------------------ rendering
function setHTML(el, html, list) {
  if (!list) { if (el._h !== html) { el._h = html; el.innerHTML = html; } return; }
  const keys = list.map(p => p.folder).join('|');
  if (el._keys !== keys) { el._keys = keys; el.innerHTML = list.map(() => '<div class="slot"></div>').join(''); }
  [...el.children].forEach((slot, i) => { const h = card(list[i]); if (slot._h !== h) { slot._h = h; slot.innerHTML = h; } });
}

function render() {
  if (!S) return;
  $('#ver').textContent = S.version;
  $('#dest').textContent = S.dest;
  $('#method').textContent = `${S.env.distro}${S.env.hyprland ? ' · Hyprland' : S.env.kde ? ' · KDE' : S.env.gnome ? ' · GNOME' : ''}`;
  const P = S.projects, inst = P.filter(p => p.status !== 'missing');
  const count = k => k === 'all' ? P.length : k === 'installed' ? inst.length : P.filter(p => p.cat === k).length;
  const navBtn = k => `<button data-view="${k}" class="${view === k ? 'on' : ''}"><span>${CATS[k]}</span><span class="n">${count(k)}</span></button>`;
  setHTML($('#nav'), `<div class="h">Library</div>${['all', 'installed'].map(navBtn).join('')}<div class="h">Categories</div>${['desktop', 'tools', 'gaming', 'system', 'learn'].map(navBtn).join('')}`);
  const auto = P.filter(p => p.status === 'missing' && !busy(p) && !p.confirm && !p.inputs && !p.pickFolder);
  $('#installAll').disabled = !auto.length;
  $('#installAll').textContent = auto.length ? `Install everything · ${size(auto.reduce((a, p) => a + p.kb, 0))}` : 'Everything installed';
  $('#updateAll').disabled = !inst.length;
  renderHero(P.find(p => p.folder === 'hypr-rice'));
  let list = P.filter(p => view === 'all' ? true : view === 'installed' ? p.status !== 'missing' : p.cat === view);
  if (query) list = list.filter(p => `${p.folder} ${p.desc} ${p.lang || ''}`.toLowerCase().includes(query));
  $('#secTitle').textContent = query ? `Results for “${query}”` : CATS[view];
  $('#secCount').textContent = `${list.length} project${list.length === 1 ? '' : 's'}`;
  setHTML($('#grid'), list.length ? null : `<div class="empty">${view === 'installed' && !query ? 'Nothing installed yet. Pick something and hit Install.' : 'No projects match.'}</div>`, list.length ? list : null);
  $('#log').innerHTML = S.log.slice().reverse().map(l => `<li><span>${l.t}</span>${esc(l.text)}</li>`).join('') || '<li>Nothing yet. Installs and setup output show up here.</li>';
  renderTabs();
}

function renderHero(p) {
  const h = $('#hero'), key = JSON.stringify([p.status, p.job, p.blocked]);
  if (h._k === key) return; h._k = key;
  h.innerHTML = `<img class="shot" src="hypr-rice.gif" alt=""><div class="txt"><div class="kick">${icon('hypr-rice', 34)}Featured · Linux desktop</div>
    <h1>Hypr<em>rice</em></h1><p>${esc(p.desc)} One click installs the packages, configs and theme switcher.</p>
    <div class="acts">${actions(p, true)}</div></div>`;
}

function tags(p) {
  const t = [];
  if (p.blocked) t.push(`<span class="tag block">${esc(p.blocked)} · download only</span>`);
  else if (p.guided) t.push('<span class="tag guided">Guided setup</span>');
  else t.push('<span class="tag auto">One-click setup</span>');
  return `<div class="tags">${t.join('')}</div>`;
}

function actions(p, big) {
  const j = p.job, f = esc(p.folder);
  if (busy(p)) {
    const pct = j.pct == null ? null : Math.round(j.pct * 100);
    const label = j.state === 'queued' ? 'Waiting in line' : (j.phase || 'Working');
    return `<div class="prog" data-showterm="${f}" title="Show the terminal"><div class="bar ${pct == null || j.phase?.startsWith('Setting') || j.phase?.startsWith('Installing') ? 'ind' : ''}"><b style="width:${pct || 0}%"></b></div><small><span>${esc(label)}${j.msg && j.state !== 'queued' ? ' · ' + esc(j.msg) : ''}</span><span>${pct == null ? '' : pct + '%'}</span></small></div>`;
  }
  const err = j && j.state === 'error' ? `<div class="err" title="${esc(j.error)}">${esc((j.error || '').slice(0, 90))}</div>` : '';
  if (p.status === 'missing') {
    return `${err}<button class="btn ${p.blocked ? '' : 'lime'}" data-act="install" data-f="${f}">${p.blocked ? 'Download' : err ? 'Try again' : 'Install'}</button>${big ? `<span class="meta">${size(p.kb)}</span>` : ''}`;
  }
  if (p.status === 'needs-setup') {
    return `${err || (p.setupError ? `<div class="err">${esc(p.setupError)}</div>` : '')}<button class="btn lime" data-act="setup" data-f="${f}">Finish setup</button><span class="sp"></span><button class="btn icon" data-more="${f}" aria-label="More">⋯</button>`;
  }
  const main = p.launch && !p.blocked ? `<button class="btn lime" data-act="launch" data-f="${f}">${esc(p.launch.label)}</button>` : `<button class="btn" data-act="open" data-f="${f}">Open folder</button>`;
  return `${err}<span class="ok">✓ ${p.blocked ? 'Downloaded' : 'Ready'}</span><span class="sp"></span>${main}<button class="btn icon" data-more="${f}" aria-label="More">⋯</button>`;
}

function card(p) {
  const showAfter = p.status === 'ready' && p.after && p.job?.state === 'done';
  return `<article class="card"><div class="art" style="--c:${ICOL[p.folder] || '#3a5bc7'}">${icon(p.folder, 78)}<span class="cat">${CATS[p.cat]}</span></div>
  <div class="body"><h3>${esc(p.folder)}</h3><p>${esc(p.desc)}</p>
  ${showAfter ? `<p class="done-note">${esc(p.after)}</p>` : p.note && p.status !== 'missing' ? `<p class="note">${esc(p.note)}</p>` : ''}
  ${tags(p)}
  <div class="meta">${p.lang ? `<span><i style="background:${LANG[p.lang] || '#888'}"></i>${p.lang}</span>` : ''}<span>${size(p.kb)}</span></div>
  <div class="acts">${actions(p)}</div></div></article>`;
}

// ------------------------------------------------------------ clicks
document.addEventListener('click', e => {
  const nv = e.target.closest('[data-view]'); if (nv) { view = nv.dataset.view; render(); $('#main').scrollTo({ top: 0 }); return; }
  const st = e.target.closest('[data-showterm]'); if (st) { showTermFor(st.dataset.showterm); return; }
  const a = e.target.closest('[data-act]'); if (a) { onAction(a.dataset.act, a.dataset.f, a); return; }
  const m = e.target.closest('[data-more]'); if (m) { openMenu(m); e.stopPropagation(); return; }
  if (!e.target.closest('#menu')) $('#menu').hidden = true;
});

async function onAction(action, folder, btn) {
  const p = S.projects.find(x => x.folder === folder);
  if ((action === 'install' || action === 'setup') && !p.blocked && (p.confirm || p.inputs || p.pickFolder)) {
    const res = await dialogBox({
      title: `${action === 'setup' ? 'Set up' : 'Install'} ${p.folder}?`,
      html: (p.confirm ? `<p class="warn">${esc(p.confirm)}</p>` : '') + (p.pickFolder ? '<p>After downloading, pick the game folder where ReShade is installed.</p>' : ''),
      fields: p.inputs, yes: action === 'setup' ? 'Set up' : 'Install',
    });
    if (!res) return;
    btn.disabled = true;
    return act(action, { folder, inputs: res.values });
  }
  btn.disabled = true;
  await act(action, { folder });
  // Launch/Open can be clicked again; Install/Setup buttons are replaced by progress anyway
  if (['launch', 'open', 'github'].includes(action)) setTimeout(() => { btn.disabled = false; }, 800);
  if (action === 'launch' && p.launch?.type === 'term') openDrawer(true);
}

function openMenu(btn) {
  const f = btn.dataset.more, p = S.projects.find(x => x.folder === f), menu = $('#menu');
  const items = [['open', 'Open folder']];
  if (!p.blocked && p.status === 'ready' && (p.inputs || p.confirm || p.pickFolder || !p.guided)) items.push(['setup', p.pickFolder ? 'Add to another game' : 'Run setup again']);
  items.push(['update', 'Update']);
  if (f === 'aura-chatbot') items.push(['apk', 'Get the Android APK']);
  items.push(['github', 'View on GitHub'], ['remove', 'Remove…']);
  menu.innerHTML = items.map(([k, t]) => `<button data-m="${k}" class="${k === 'remove' ? 'danger' : ''}">${t}</button>`).join('');
  const r = btn.getBoundingClientRect(); menu.hidden = false;
  menu.style.top = Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 10) + 'px';
  menu.style.left = Math.max(10, r.right - menu.offsetWidth) + 'px';
  menu.onclick = async ev => {
    const k = ev.target.dataset.m; if (!k) return; menu.hidden = true;
    if (k === 'remove') {
      if (await dialogBox({ title: `Remove ${f}?`, html: `<p>This deletes ${esc(S.dest)}/${esc(f)} and any changes you made in it. Anything its setup installed elsewhere (themes, packages, app-menu entries) stays. This can't be undone.</p>`, yes: 'Remove' })) act('remove', { folder: f });
    } else if (k === 'setup') onAction('setup', f, document.createElement('button'));
    else act(k, { folder: f });
  };
}

// ------------------------------------------------------------ dialogs
function dialogBox({ title, html = '', fields = null, yes = 'OK', noCancel = false }) {
  return new Promise(res => {
    const d = $('#dlg');
    $('#dTitle').textContent = title; $('#dText').innerHTML = html;
    $('#dFields').innerHTML = (fields || []).map(fl => `<label>${esc(fl.label)}<input data-key="${esc(fl.key)}" type="${fl.text ? 'text' : 'password'}" autocomplete="off" spellcheck="false" value="${esc(fl.value || '')}">${fl.hint ? `<span class="hint">${esc(fl.hint)}</span>` : ''}</label>`).join('');
    $('#dYes').textContent = yes; $('#dNo').hidden = noCancel;
    const close = ok => {
      d.close();
      const values = {}; d.querySelectorAll('#dFields input').forEach(i => values[i.dataset.key] = i.value.trim());
      res(ok ? { values } : false);
    };
    $('#dYes').onclick = () => close(true); $('#dNo').onclick = () => close(false);
    d.oncancel = e => { e.preventDefault(); close(false); };
    d.showModal();
    d.querySelector('#dFields input')?.focus();
  });
}
const alertBox = (t, x) => dialogBox({ title: t, html: `<p>${esc(x)}</p>`, noCancel: true });

const pwQueue = [];
L.onAskPassword(req => { pwQueue.push(req); if (pwQueue.length === 1) showPw(); });
function showPw() {
  const req = pwQueue[0]; if (!req) return;
  const d = $('#pw');
  $('#pwText').textContent = `Setting up ${req.project} needs administrator access (sudo) for ${req.user}.`;
  $('#pwIn').value = '';
  const done = pw => { d.close(); L.password(req.id, pw); $('#pwIn').value = ''; pwQueue.shift(); if (pwQueue.length) setTimeout(showPw, 50); };
  $('#pwYes').onclick = () => done($('#pwIn').value);
  $('#pwNo').onclick = () => done(null);
  $('#pwIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done($('#pwIn').value); } };
  d.oncancel = e => { e.preventDefault(); done(null); };
  d.showModal(); $('#pwIn').focus();
}

// ------------------------------------------------------------ terminal drawer
const terms = new Map(); // id -> {term, fit, el, title, folder, live}
let activeTab = 'log';
const TermCtor = window.Terminal?.Terminal || window.Terminal;
const FitCtor = window.FitAddon?.FitAddon || window.FitAddon;

function openDrawer(open) { $('#drawer').dataset.open = String(open); setTimeout(fitActive, 280); }
$('#dToggle').onclick = () => openDrawer($('#drawer').dataset.open !== 'true');

L.onTermOpen(({ id, title, folder, focus }) => {
  const el = document.createElement('div'); el.className = 'term'; el.hidden = true; $('#dbody').append(el);
  const term = new TermCtor({ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12.5, cursorBlink: true, scrollback: 5000, convertEol: false,
    theme: { background: '#0b1107', foreground: '#e8ead9', cursor: '#d2ff00', selectionBackground: '#3a5a1a', black: '#1b2712', green: '#9be564', brightGreen: '#d2ff00', yellow: '#ffcb47', blue: '#6cb6ff', magenta: '#c792ea', cyan: '#5fe0e6', red: '#ff6b5b' } });
  const fit = FitCtor ? new FitCtor() : null; if (fit) term.loadAddon(fit);
  term.open(el);
  term.onData(data => L.termInput(id, data));
  terms.set(id, { term, fit, el, title, folder, live: true });
  if (focus || activeTab === 'log' || terms.size === 1) selectTab(id);
  if (focus) openDrawer(true);
  renderTabs();
});
L.onTermData(({ id, data }) => terms.get(id)?.term.write(data));
L.onTermExit(({ id, code }) => {
  const t = terms.get(id); if (!t) return;
  t.live = false; renderTabs();
  // Tidy up: a setup step that worked doesn't need its own tab any more (its output stays in Activity's log line).
  if (code === 0 && /: (setup|packages)$/.test(t.title) && activeTab !== id) setTimeout(() => closeTab(id), 1500);
});
function closeTab(id) { const t = terms.get(id); L.termClose(id); t?.term.dispose(); t?.el.remove(); terms.delete(id); if (activeTab === id) selectTab('log'); else renderTabs(); }

function selectTab(id) {
  activeTab = id;
  $('#log').hidden = id !== 'log';
  for (const [k, t] of terms) t.el.hidden = k !== id;
  renderTabs(); fitActive();
  terms.get(id)?.term.focus();
}
function fitActive() { const t = terms.get(activeTab); if (t?.fit && $('#drawer').dataset.open === 'true') try { t.fit.fit(); } catch {} }
addEventListener('resize', fitActive);
function showTermFor(folder) {
  const ids = [...terms.entries()].filter(([, t]) => t.folder === folder).map(([k]) => k);
  if (ids.length) selectTab(ids[ids.length - 1]); else selectTab('log');
  openDrawer(true);
}
function renderTabs() {
  const html = `<button class="tab ${activeTab === 'log' ? 'on' : ''}" data-tab="log">Activity</button>` +
    [...terms.entries()].map(([id, t]) => `<span class="tab ${activeTab === id ? 'on' : ''}" data-tab="${id}"><i class="dot ${t.live ? 'live' : ''}"></i>${esc(t.title)}<button class="x" data-close="${id}" aria-label="Close">×</button></span>`).join('');
  setHTML($('#tabs'), html);
}
$('#tabs').addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) { closeTab(+c.dataset.close); return; }
  const t = e.target.closest('[data-tab]'); if (t) { selectTab(t.dataset.tab === 'log' ? 'log' : +t.dataset.tab); openDrawer(true); }
});

// ------------------------------------------------------------ top bar + sidebar
$('#installAll').onclick = async () => {
  const P = S.projects, auto = P.filter(p => p.status === 'missing' && !p.confirm && !p.inputs && !p.pickFolder);
  const later = P.filter(p => p.status === 'missing' && (p.confirm || p.inputs || p.pickFolder)).map(p => p.folder);
  const res = await dialogBox({ title: 'Install everything?', yes: 'Install',
    html: `<p>${auto.length} projects, about ${size(auto.reduce((a, p) => a + p.kb, 0))}, into ${esc(S.dest)}. Each one is downloaded and set up in turn. You'll be asked for your password if a setup needs it.</p>` +
      (later.length ? `<p class="note">These change your desktop or need your input, so install them one by one: ${later.map(esc).join(', ')}.</p>` : '') });
  if (res) act('installAll');
};
$('#updateAll').onclick = () => act('updateAll');
$('#openDest').onclick = () => act('openDest');
$('#changeDest').onclick = async () => {
  const r = await dialogBox({ title: 'Install folder', html: '<p>Where should projects go? Projects already in the old folder stay there.</p>', fields: [{ key: 'dest', label: 'Folder', text: true, value: S.dest }], yes: 'Save' });
  if (r && r.values.dest) act('setDest', { dest: r.values.dest });
};
$('#q').oninput = e => { query = e.target.value.trim().toLowerCase(); render(); };
addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.closest('input, .xterm')) { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape') $('#menu').hidden = true;
});

L.onState(s => { S = s; render(); });
L.state().then(s => { S = s; render(); });
