// background.js — JobTrack Service Worker
// Receives job data from content scripts, deduplicates, stores, notifies

const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'JOB_APPLIED') {
    handleApply(msg.data, sender.tab).then(sendResponse);
    return true; // keep port open for async
  }
  if (msg.type === 'GET_JOBS') {
    getJobs(msg.filter).then(sendResponse);
    return true;
  }
  if (msg.type === 'UPDATE_JOB') {
    updateJob(msg.id, msg.data).then(sendResponse);
    return true;
  }
  if (msg.type === 'DELETE_JOB') {
    deleteJob(msg.id).then(sendResponse);
    return true;
  }
  if (msg.type === 'EXPORT_CSV') {
    exportCSV().then(sendResponse);
    return true;
  }
});

async function handleApply(data, tab) {
  const jobs = await loadJobs();

  // Deduplicate: same company + role applied in last 10 minutes = skip
  const isDupe = jobs.some(j =>
    normalize(j.company) === normalize(data.company) &&
    normalize(j.role)    === normalize(data.role) &&
    (Date.now() - j._timestamp) < DEDUPE_WINDOW_MS
  );
  if (isDupe) return { ok: false, reason: 'duplicate' };

  const job = {
    id:           genId(),
    company:      clean(data.company),
    role:         clean(data.role),
    status:       'Applied',
    location:     clean(data.location),
    salary:       clean(data.salary),
    url:          data.url || tab?.url || '',
    source:       data.source || 'Unknown',
    notes:        clean(data.notes),
    date_applied: today(),
    followup:     '',
    recruiter:    '',
    _timestamp:   Date.now(),
  };

  jobs.unshift(job);
  await saveJobs(jobs);

  // Show browser notification
  chrome.notifications.create(`jt_${job.id}`, {
    type:    'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title:   '✓ JobTrack — Application logged!',
    message: `${job.role} at ${job.company}`,
    buttons: [{ title: 'View all jobs' }],
  });

  // Update badge
  updateBadge(jobs.length);

  return { ok: true, job };
}

// Badge shows total count
async function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#6c63ff' });
}

async function getJobs(filter = {}) {
  let jobs = await loadJobs();
  if (filter.status) jobs = jobs.filter(j => j.status === filter.status);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    jobs = jobs.filter(j =>
      [j.company, j.role, j.location, j.notes].some(f => (f||'').toLowerCase().includes(q))
    );
  }
  return jobs;
}

async function updateJob(id, data) {
  const jobs = await loadJobs();
  const i = jobs.findIndex(j => j.id === id);
  if (i > -1) {
    jobs[i] = { ...jobs[i], ...data };
    await saveJobs(jobs);
    return { ok: true };
  }
  return { ok: false };
}

async function deleteJob(id) {
  const jobs = await loadJobs();
  const filtered = jobs.filter(j => j.id !== id);
  await saveJobs(filtered);
  updateBadge(filtered.length);
  return { ok: true };
}

async function exportCSV() {
  const jobs = await loadJobs();
  const keys = ['role','company','status','location','salary','date_applied','url','recruiter','followup','notes','source'];
  const header = keys.join(',');
  const rows = jobs.map(j => keys.map(k => `"${(j[k]||'').replace(/"/g,'""')}"`).join(','));
  return [header, ...rows].join('\n');
}

// ─── Storage helpers ───────────────────────────────────────────────────────
function loadJobs() {
  return new Promise(resolve => {
    chrome.storage.local.get(['jt_jobs'], r => resolve(r.jt_jobs || []));
  });
}
function saveJobs(jobs) {
  return new Promise(resolve => {
    chrome.storage.local.set({ jt_jobs: jobs }, resolve);
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────
function genId() {
  return 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}
function normalize(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Notification click → open popup
chrome.notifications.onButtonClicked.addListener(() => {
  chrome.action.openPopup();
});

// On install
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobTrack installed');
});
