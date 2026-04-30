// content/unstop.js — Unstop (formerly Dare2Compete) Apply Detector

(function () {
  'use strict';
  let lastFired = 0;

  function extract() {
    const role =
      text('.opportunity-title h1') ||
      text('[class*="title"] h1') ||
      text('h1') || '';

    const company =
      text('.organizer-name') ||
      text('[class*="organizer"] a') ||
      text('[class*="company"]') || '';

    const location =
      text('[class*="location"]') || 'Remote/Online';

    const url = window.location.href.split('?')[0];
    return { role, company, location, url, source: 'Unstop' };
  }

  function fire() {
    const now = Date.now();
    if (now - lastFired < 8000) return;
    const data = extract();
    if (!data.role) return;
    lastFired = now;
    chrome.runtime.sendMessage({ type: 'JOB_APPLIED', data });
    showToast(data.role, data.company || 'Unstop');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const txt = (btn.innerText || '').trim().toLowerCase();
    if (txt.includes('apply') || txt.includes('register now')) {
      setTimeout(fire, 1500);
    }
  }, true);

  function text(sel) {
    const el = document.querySelector(sel);
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
  }

  function showToast(role, company) {
    const old = document.getElementById('jt-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'jt-toast';
    t.innerHTML = `<b>✓ JobTrack</b> — logged <i>${role}</i> at <i>${company}</i>`;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: '999999',
      background: '#1a1c24', color: '#e8eaf2', border: '1px solid #6c63ff',
      borderRadius: '10px', padding: '12px 18px', fontSize: '13px',
      fontFamily: 'sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      maxWidth: '320px', lineHeight: '1.4',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
})();
