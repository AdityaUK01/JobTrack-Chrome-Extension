// popup.js — JobTrack Popup Logic

const STATUS_CFG = {
  'Applied':      { color: '#6c63ff', bg: 'rgba(108,99,255,.13)' },
  'Phone Screen': { color: '#74c0fc', bg: 'rgba(116,192,252,.13)' },
  'Interview':    { color: '#ffa94d', bg: 'rgba(255,169,77,.13)'  },
  'Offer':        { color: '#69db7c', bg: 'rgba(105,219,124,.13)' },
  'Rejected':     { color: '#ff6b6b', bg: 'rgba(255,107,107,.13)' },
  'Ghosted':      { color: '#7a7f96', bg: 'rgba(122,127,150,.13)' },
};
const STATUSES = Object.keys(STATUS_CFG);

let allJobs    = [];
let currentTab = 'kanban';
let editingId  = null;
let toastTimer = null;
let pendingDel = {};

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  load();
});

function bindEvents() {
  document.getElementById('btn-add').addEventListener('click', openAdd);
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-save').addEventListener('click', saveJob);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-del-modal').addEventListener('click', handleDelModal);
  document.getElementById('q').addEventListener('input', renderContent);
  document.getElementById('filter-status').addEventListener('change', renderContent);
  document.getElementById('sort').addEventListener('change', renderContent);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderContent();
    });
  });
}

// ── Load ───────────────────────────────────────────────────────────────────
async function load() {
  allJobs = await sendMsg({ type: 'GET_JOBS' }) || [];
  renderStats();
  renderContent();
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
  const t    = allJobs.length;
  const ac   = allJobs.filter(j => !['Rejected','Ghosted'].includes(j.status)).length;
  const iv   = allJobs.filter(j => ['Interview','Offer'].includes(j.status)).length;
  const of   = allJobs.filter(j => j.status === 'Offer').length;
  const rate = t > 0 ? Math.round(iv / t * 100) : 0;
  document.getElementById('stats-bar').innerHTML = [
    ['Total',t], ['Active',ac], ['Interviews',iv], ['Offers',of], ['Rate', rate + '%']
  ].map(([l,v]) =>
    `<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`
  ).join('');
}

// ── Filter / Sort ──────────────────────────────────────────────────────────
function getFiltered() {
  const q  = document.getElementById('q').value.toLowerCase().trim();
  const fs = document.getElementById('filter-status').value;
  const so = document.getElementById('sort').value;
  let r = allJobs.filter(j => {
    const mq = !q || [j.company,j.role,j.location,j.notes].some(f => (f||'').toLowerCase().includes(q));
    const ms = !fs || j.status === fs;
    return mq && ms;
  });
  if (so === 'newest') r.sort((a,b) => (b.date_applied||'').localeCompare(a.date_applied||''));
  else if (so === 'oldest') r.sort((a,b) => (a.date_applied||'').localeCompare(b.date_applied||''));
  else if (so === 'company') r.sort((a,b) => (a.company||'').localeCompare(b.company||''));
  return r;
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderContent() {
  const c    = document.getElementById('content');
  const jobs = getFiltered();
  if (currentTab === 'kanban') renderKanban(c, jobs);
  else renderList(c, jobs);
}

// ── Kanban ─────────────────────────────────────────────────────────────────
function renderKanban(c, jobs) {
  const by = {};
  STATUSES.forEach(s => { by[s] = []; });
  jobs.forEach(j => { if (by[j.status]) by[j.status].push(j); });

  const cols = STATUSES.map(s => {
    const cfg = STATUS_CFG[s];
    const cj  = by[s];
    const cards = cj.length === 0
      ? `<div class="k-empty">none</div>`
      : cj.map(j => makeCard(j, cfg)).join('');
    return `<div class="k-col">
      <div class="k-head">
        <div class="k-label">
          <div class="k-dot" style="background:${cfg.color}"></div>
          ${esc(s)}
        </div>
        <span class="k-count">${cj.length}</span>
      </div>
      ${cards}
    </div>`;
  }).join('');

  c.innerHTML = `<div class="kanban">${cols}</div>`;

  // Bind card events after render
  c.querySelectorAll('.job-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', () => openEdit(id));
  });
  c.querySelectorAll('.jc-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openEdit(btn.dataset.id); });
  });
  c.querySelectorAll('.jc-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDel(btn.dataset.id, btn); });
  });
  c.querySelectorAll('.jc-link-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); chrome.tabs.create({ url: btn.dataset.url }); });
  });
}

function makeCard(j, cfg) {
  const loc  = j.location ? `<span class="jc-tag">📍 ${esc(j.location.slice(0,14))}</span>` : '';
  const sal  = j.salary   ? `<span class="jc-tag">₹ ${esc(j.salary.slice(0,12))}</span>` : '';
  const src  = j.source   ? `<span class="jc-tag">${esc(j.source)}</span>` : '';
  const link = j.url      ? `<button class="jc-btn jc-link-btn" data-url="${esc(j.url)}">↗</button>` : '';
  return `<div class="job-card" style="--card-color:${cfg.color}" data-id="${j.id}">
    <div class="jc-company">${esc(j.company)}</div>
    <div class="jc-role">${esc(j.role)}</div>
    <div class="jc-meta">${loc}${sal}${src}</div>
    <div class="jc-footer">
      <span class="jc-date">${esc(j.date_applied || '')}</span>
      <div class="jc-actions">
        <button class="jc-btn jc-edit-btn" data-id="${j.id}">Edit</button>
        <button class="jc-btn del jc-del-btn" data-id="${j.id}">Del</button>
        ${link}
      </div>
    </div>
  </div>`;
}

// ── List ───────────────────────────────────────────────────────────────────
function renderList(c, jobs) {
  if (!jobs.length) {
    c.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">No results</div></div>`;
    return;
  }
  const rows = jobs.map(j => {
    const cfg = STATUS_CFG[j.status] || { color: '#888', bg: 'rgba(0,0,0,.1)' };
    return `<tr data-id="${j.id}">
      <td style="font-weight:500">${esc(j.role)}</td>
      <td style="color:var(--muted);font-family:monospace;font-size:11px">${esc(j.company)}</td>
      <td>
        <span class="status-pill" style="color:${cfg.color};background:${cfg.bg}">
          <span class="pill-dot" style="background:${cfg.color}"></span>${esc(j.status)}
        </span>
      </td>
      <td style="font-family:monospace;font-size:11px;color:var(--muted)">${esc(j.date_applied || '—')}</td>
    </tr>`;
  }).join('');

  c.innerHTML = `
    <div class="result-count">${jobs.length} result${jobs.length !== 1 ? 's' : ''}</div>
    <div class="list-wrap">
      <table class="list-table">
        <thead><tr>
          <th>Role</th><th>Company</th><th>Status</th><th>Applied</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  c.querySelectorAll('tbody tr').forEach(row => {
    row.addEventListener('click', () => openEdit(row.dataset.id));
  });
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openEdit(id) {
  const j = allJobs.find(x => x.id === id);
  if (!j) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Application';
  setF('company',  j.company  || '');
  setF('role',     j.role     || '');
  setF('status',   j.status   || 'Applied');
  setF('date',     j.date_applied || '');
  setF('location', j.location || '');
  setF('salary',   j.salary   || '');
  setF('recruiter',j.recruiter|| '');
  setF('followup', j.followup || '');
  setF('url',      j.url      || '');
  document.getElementById('f-notes').value = j.notes || '';
  document.getElementById('btn-del-modal').style.display = 'block';
  document.getElementById('f-err').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('open');
}

function openAdd() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Application';
  ['company','role','location','salary','recruiter','url'].forEach(k => setF(k, ''));
  document.getElementById('f-status').value = 'Applied';
  document.getElementById('f-date').value   = today();
  document.getElementById('f-followup').value = '';
  document.getElementById('f-notes').value  = '';
  document.getElementById('btn-del-modal').style.display = 'none';
  document.getElementById('f-err').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('f-company').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

async function saveJob() {
  const company = document.getElementById('f-company').value.trim();
  const role    = document.getElementById('f-role').value.trim();
  const errEl   = document.getElementById('f-err');
  if (!company || !role) { errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const data = {
    company, role,
    status:       document.getElementById('f-status').value,
    date_applied: document.getElementById('f-date').value,
    location:     document.getElementById('f-location').value.trim(),
    salary:       document.getElementById('f-salary').value.trim(),
    recruiter:    document.getElementById('f-recruiter').value.trim(),
    followup:     document.getElementById('f-followup').value,
    url:          document.getElementById('f-url').value.trim(),
    notes:        document.getElementById('f-notes').value.trim(),
  };

  if (editingId) {
    await sendMsg({ type: 'UPDATE_JOB', id: editingId, data });
    showToast('Updated', '✓');
  } else {
    // Add via storage directly
    const jobs   = await getStorage('jt_jobs') || [];
    const newJob = { ...data, id: genId(), source: 'Manual', _timestamp: Date.now() };
    jobs.unshift(newJob);
    await setStorage({ jt_jobs: jobs });
    showToast('Added', '✓');
  }
  closeModal();
  await load();
}

async function handleDelModal() {
  if (!editingId) return;
  await sendMsg({ type: 'DELETE_JOB', id: editingId });
  closeModal();
  showToast('Deleted', '✕');
  await load();
}

async function confirmDel(id, btn) {
  if (pendingDel[id]) {
    delete pendingDel[id];
    await sendMsg({ type: 'DELETE_JOB', id });
    showToast('Deleted', '✕');
    await load();
  } else {
    Object.keys(pendingDel).forEach(k => delete pendingDel[k]); // reset others
    pendingDel[id]    = true;
    btn.textContent   = 'Sure?';
    btn.style.color   = 'var(--danger)';
    setTimeout(() => {
      if (pendingDel[id]) {
        delete pendingDel[id];
        btn.textContent = 'Del';
        btn.style.color = '';
      }
    }, 3000);
  }
}

// ── Export ─────────────────────────────────────────────────────────────────
async function exportCSV() {
  const csv = await sendMsg({ type: 'EXPORT_CSV' });
  if (!csv) return;
  const a = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'job-applications-' + today() + '.csv';
  a.click();
  showToast('CSV downloaded', '↓');
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(m, icon) {
  clearTimeout(toastTimer);
  document.getElementById('toast-msg').textContent  = m;
  document.getElementById('toast-icon').textContent = icon || '✓';
  const t = document.getElementById('toast');
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Chrome helpers ─────────────────────────────────────────────────────────
function sendMsg(data) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(data, response => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(response);
    });
  });
}
function getStorage(key) {
  return new Promise(resolve => {
    chrome.storage.local.get([key], r => resolve(r[key] || null));
  });
}
function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

// ── Utils ──────────────────────────────────────────────────────────────────
function setF(k, v) {
  const el = document.getElementById('f-' + k);
  if (el) el.value = v;
}
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function genId() {
  return 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
}

// ── Manual "Log current tab" ───────────────────────────────────────────────
document.getElementById('btn-log-tab').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const url = tab.url || '';
  const title = tab.title || '';

  // Parse "Role at Company" or "Role - Company | LinkedIn"
  let role = '', company = '';
  const atMatch    = title.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*[\|\-]|$)/i);
  const dashMatch  = title.match(/^(.+?)\s*[-–]\s*(.+?)(?:\s*[\|\-]\s*LinkedIn)?$/i);

  if (atMatch)   { role = atMatch[1].trim();   company = atMatch[2].trim(); }
  else if (dashMatch) { role = dashMatch[1].trim(); company = dashMatch[2].replace(/linkedin/i,'').trim(); }
  else           { role = title.replace(/[\|\-].*$/,'').trim(); company = ''; }

  // Open add modal pre-filled
  openAdd();
  setTimeout(() => {
    if (role)    document.getElementById('f-role').value    = role;
    if (company) document.getElementById('f-company').value = company;
    document.getElementById('f-url').value = url;
    document.getElementById('f-notes').value = 'Manually logged from tab';
  }, 50);
});
