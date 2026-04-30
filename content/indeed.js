// content/indeed.js — Indeed Apply Detector

(function () {
  'use strict';
  let lastFired = 0;

  function extract() {
    const role =
      text('.jobsearch-JobInfoHeader-title') ||
      text('[class*="jobTitle"] h1') ||
      text('h1') || '';

    const company =
      text('[data-company-name="true"]') ||
      text('[class*="companyName"]') ||
      text('.jobsearch-InlineCompanyRating-companyHeader a') || '';

    const location =
      text('[class*="companyLocation"]') ||
      text('.jobsearch-JobInfoHeader-subtitle div:nth-child(2)') || '';

    const salary =
      text('#salaryInfoAndJobType span') ||
      text('[class*="salary"]') || '';

    const url = window.location.href.split('?')[0];
    return { role, company, location, salary, url, source: 'Indeed' };
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
    const id  = (btn.id || '').toLowerCase();
    const cls = (btn.className || '').toLowerCase();

    if (
      id.includes('apply') ||
      txt === 'apply now' ||
      txt === 'apply' ||
      cls.includes('apply-btn') ||
      (txt.includes('apply') && !txt.includes('not'))
    ) {
      setTimeout(fire, 1200);
    }
  }, true);

  // Watch for Indeed's application submitted confirmation
  const observer = new MutationObserver(() => {
    const done =
      document.querySelector('[class*="applicationSubmitted"]') ||
      document.querySelector('[class*="postApply"]') ||
      (document.body.innerText || '').includes('application has been submitted');
    if (done) fire();
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
