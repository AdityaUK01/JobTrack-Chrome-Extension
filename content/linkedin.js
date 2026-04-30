// content/linkedin.js — LinkedIn Apply Detector
// Watches for: Easy Apply modal submit + external apply button clicks

(function () {
  'use strict';
  let lastFired = 0;

  // ─── Extract job data from current page ──────────────────────────────────
  function extract() {
    const role =
      text('.job-details-jobs-unified-top-card__job-title h1') ||
      text('h1.jobs-unified-top-card__job-title') ||
      text('h1.t-24') || '';

    const company =
      text('.job-details-jobs-unified-top-card__company-name a') ||
      text('.topcard__org-name-link') ||
      text('.jobs-unified-top-card__company-name a') || '';

    const location =
      text('.job-details-jobs-unified-top-card__primary-description-container .tvm__text:first-child') ||
      text('.topcard__flavor--bullet') ||
      text('.jobs-unified-top-card__bullet') || '';

    const url = window.location.href.split('?')[0];

    return { role, company, location, url, source: 'LinkedIn' };
  }

  // ─── Fire event ──────────────────────────────────────────────────────────
  function fire() {
    const now = Date.now();
    if (now - lastFired < 8000) return; // debounce 8s
    const data = extract();
    if (!data.role || !data.company) return;
    lastFired = now;
    chrome.runtime.sendMessage({ type: 'JOB_APPLIED', data });
    showToast(data.role, data.company);
  }

  // ─── Watch for button clicks ──────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const txt = (btn.innerText || '').trim().toLowerCase();
    const cls = (btn.className || '').toLowerCase();

    // Easy Apply final submit
    if (
      txt === 'submit application' ||
      txt === 'done' ||
      cls.includes('artdeco-button--primary') && txt.includes('submit')
    ) {
      setTimeout(fire, 1000); // wait for confirmation screen
      return;
    }

    // Easy Apply button (first click starts flow — log at start too)
    if (
      txt === 'easy apply' ||
      (cls.includes('jobs-apply-button') && txt.includes('apply'))
    ) {
      // Don't log yet — wait for final submit. But note the job.
      return;
    }

    // External apply (opens new tab on company site)
    if (txt === 'apply' || (txt.includes('apply') && !txt.includes('easy'))) {
      setTimeout(fire, 600);
    }
  }, true);

  // ─── MutationObserver: detect success modal ──────────────────────────────
  // LinkedIn shows "Your application was sent" inside a modal
  const observer = new MutationObserver(() => {
    const successModal = document.querySelector(
      '.jobs-easy-apply-modal .artdeco-inline-feedback--success,' +
      '[class*="success-banner"],' +
      '.jobs-post-apply-modal'
    );
    const successText = document.body.innerText || '';
    if (
      successModal ||
      successText.includes('Your application was sent') ||
      successText.includes('application was submitted')
    ) {
      fire();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ─── Utils ───────────────────────────────────────────────────────────────
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
