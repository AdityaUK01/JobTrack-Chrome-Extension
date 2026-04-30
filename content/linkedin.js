// content/linkedin.js — LinkedIn Apply Detector (SPA-aware)
// LinkedIn never does a full page reload. This script watches for URL changes
// and re-attaches listeners every time a new job page is navigated to.

(function () {
  'use strict';

  let lastFired   = 0;
  let lastUrl     = '';
  let observing   = false;

  // ── Main init — runs on every URL change ──────────────────────────────────
  function init() {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;

    // Only care about job detail pages
    if (!url.includes('/jobs/view/') && !url.includes('/jobs/collections/') && !url.includes('/jobs/search/')) return;

    attachButtonWatcher();
    attachMutationWatcher();
  }

  // ── Watch for Apply / Easy Apply / Submit clicks ─────────────────────────
  function attachButtonWatcher() {
    // Remove old listener to avoid duplicates then re-add
    document.removeEventListener('click', onClickCapture, true);
    document.addEventListener('click', onClickCapture, true);
  }

  function onClickCapture(e) {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const txt = (btn.innerText || '').trim().toLowerCase();
    const cls = (btn.className || '');

    // Easy Apply first click — we track when user submits, not here.
    // But if they click the external "Apply" that opens company site, log it now.
    const isExternalApply = (
      (txt === 'apply' || txt.includes('apply on company')) &&
      !txt.includes('easy')
    );
    if (isExternalApply) {
      setTimeout(() => fire('external'), 800);
      return;
    }

    // Easy Apply — final submit button inside the modal
    const isSubmit = (
      txt === 'submit application' ||
      txt.includes('submit application') ||
      (txt === 'done' && isInsideEasyApplyModal())
    );
    if (isSubmit) {
      setTimeout(() => fire('easy-apply-submit'), 1000);
    }
  }

  function isInsideEasyApplyModal() {
    return !!document.querySelector(
      '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]'
    );
  }

  // ── MutationObserver — catch success screens ──────────────────────────────
  function attachMutationWatcher() {
    if (observing) return;
    observing = true;

    const observer = new MutationObserver(() => {
      // "Your application was sent" confirmation
      const body = document.body.innerText || '';
      if (
        body.includes('Your application was sent') ||
        body.includes('application was submitted') ||
        document.querySelector(
          '.jobs-post-apply-modal, ' +
          '[class*="post-apply"], ' +
          '[class*="application-submitted"]'
        )
      ) {
        fire('mutation-success');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Extract job data from DOM ─────────────────────────────────────────────
  function extract() {
    // Try multiple selector patterns — LinkedIn updates their DOM often
    const role =
      t('h1.job-details-jobs-unified-top-card__job-title') ||
      t('.job-details-jobs-unified-top-card__job-title h1') ||
      t('h1.jobs-unified-top-card__job-title') ||
      t('.jobs-unified-top-card__job-title h1') ||
      t('h1.t-24.t-bold') ||
      t('.job-title h1') ||
      t('h1') || '';

    const company =
      t('.job-details-jobs-unified-top-card__company-name a') ||
      t('.jobs-unified-top-card__company-name a') ||
      t('.topcard__org-name-link') ||
      t('[class*="company-name"] a') ||
      t('[class*="companyName"] a') || '';

    const location =
      t('.job-details-jobs-unified-top-card__primary-description-container .tvm__text') ||
      t('.jobs-unified-top-card__bullet') ||
      t('.topcard__flavor--bullet') ||
      t('[class*="workplace-type"]') || '';

    const url = location.href ? location.href.split('?')[0] : window.location.href.split('?')[0];

    return {
      role:     clean(role),
      company:  clean(company),
      location: clean(location),
      url,
      source: 'LinkedIn',
    };
  }

  // ── Fire ─────────────────────────────────────────────────────────────────
  function fire(reason) {
    const now = Date.now();
    if (now - lastFired < 8000) return; // debounce

    const data = extract();
    if (!data.role || !data.company) {
      // Role/company missing — try again in 1s (DOM may still be rendering)
      if (now - lastFired > 15000) {
        setTimeout(() => {
          const d2 = extract();
          if (d2.role && d2.company) {
            lastFired = Date.now();
            send(d2);
          }
        }, 1000);
      }
      return;
    }

    lastFired = now;
    send(data);
  }

  function send(data) {
    chrome.runtime.sendMessage({ type: 'JOB_APPLIED', data }, () => {
      if (chrome.runtime.lastError) return; // extension context gone
    });
    showToast(data.role, data.company);
  }

  // ── SPA navigation watcher ────────────────────────────────────────────────
  // LinkedIn uses History API — pushState/replaceState don't fire popstate
  // We patch them + also listen to popstate for back/forward.
  function watchNavigation() {
    const _push    = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);

    history.pushState = function (...args) {
      _push(...args);
      setTimeout(init, 400); // slight delay for DOM to update
    };
    history.replaceState = function (...args) {
      _replace(...args);
      setTimeout(init, 400);
    };

    window.addEventListener('popstate', () => setTimeout(init, 400));

    // Also poll as a fallback every 1.5s (cheap, just checks URL string)
    setInterval(() => {
      if (location.href !== lastUrl) init();
    }, 1500);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(role, company) {
    const old = document.getElementById('jt-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'jt-toast';
    t.innerHTML = `<b style="color:#4ecca3">✓ JobTrack</b> &mdash; logged <i>${htmlEsc(role)}</i> at <i>${htmlEsc(company)}</i>`;
    Object.assign(t.style, {
      position: 'fixed', bottom: '28px', right: '28px', zIndex: '2147483647',
      background: '#13141a', color: '#e8eaf2',
      border: '1px solid #6c63ff', borderRadius: '10px',
      padding: '12px 18px', fontSize: '13px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', lineHeight: '1.5',
      maxWidth: '300px', cursor: 'pointer',
    });
    t.onclick = () => t.remove();
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 5000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function t(sel) {
    const el = document.querySelector(sel);
    return el ? el.innerText || '' : '';
  }
  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }
  function htmlEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  watchNavigation();
  init(); // run once immediately for the current page

})();
