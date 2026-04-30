// content/internshala.js — Internshala Apply Detector

(function () {
  'use strict';
  let lastFired = 0;

  function extract() {
    const role =
      text('.profile-overview h1') ||
      text('.heading_4_5.profile') ||
      text('h1') || '';

    const company =
      text('.company-name a') ||
      text('[class*="company_name"] a') ||
      text('.company_name') || '';

    const location =
      text('.location_name') ||
      text('[class*="location"] span') || '';

    const salary =
      text('.stipend') ||
      text('[class*="stipend"]') ||
      text('.salary') || '';

    const url = window.location.href.split('?')[0];
    return { role, company, location, salary, url, source: 'Internshala' };
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
      id === 'apply-button' ||
      cls.includes('apply_button') ||
      cls.includes('btn-apply') ||
      txt === 'apply now' ||
      txt === 'apply'
    ) {
      setTimeout(fire, 1500);
    }
  }, true);

  // Watch for success message
  const observer = new MutationObserver(() => {
    const body = document.body.innerText || '';
    const modal = document.querySelector('#confirmationModal, .success-message, [class*="application_success"]');
    if (modal || body.includes('application has been received') || body.includes('successfully applied')) {
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
