// content/naukri.js — Naukri.com Apply Detector

(function () {
  'use strict';
  let lastFired = 0;

  function extract() {
    const role =
      text('.jd-header-title') ||
      text('h1.title') ||
      text('[class*="jobTitle"] h1') ||
      text('h1') || '';

    const company =
      text('.jd-header-comp-name a') ||
      text('.comp-name a') ||
      text('[class*="companyInfo"] a') ||
      text('[class*="companyName"]') || '';

    const location =
      text('.loc span') ||
      text('[class*="location"] span') ||
      text('[class*="loc"]') || '';

    const salary =
      text('.salary-container .salary') ||
      text('[class*="salary"]') || '';

    const exp =
      text('.exp span') ||
      text('[class*="exp"] span') || '';

    const url = window.location.href.split('?')[0];

    return { role, company, location, salary, notes: exp ? `Exp: ${exp}` : '', url, source: 'Naukri' };
  }

  function fire() {
    const now = Date.now();
    if (now - lastFired < 8000) return;
    const data = extract();
    if (!data.role || !data.company) return;
    lastFired = now;
    chrome.runtime.sendMessage({ type: 'JOB_APPLIED', data });
    showToast(data.role, data.company);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const txt = (btn.innerText || '').trim().toLowerCase();
    const cls = (btn.className || '').toLowerCase();
    const id  = (btn.id || '').toLowerCase();

    if (
      txt === 'apply' ||
      txt === 'apply now' ||
      cls.includes('apply-btn') ||
      cls.includes('applybtn') ||
      id.includes('apply')
    ) {
      setTimeout(fire, 1500);
    }
  }, true);

  // Watch for "Applied Successfully" modal/banner
  const observer = new MutationObserver(() => {
    const body = document.body.innerText || '';
    if (
      body.includes('applied successfully') ||
      body.includes('Application submitted') ||
      document.querySelector('[class*="successMsg"], [class*="success-modal"]')
    ) {
      fire();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

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
