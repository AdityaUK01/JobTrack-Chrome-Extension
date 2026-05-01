// content/linkedin.js — LinkedIn v1.2 (robust rewrite)

(function () {
  'use strict';

  let lastFired  = 0;
  let lastUrl    = '';
  let modalWasOpen = false;

  console.log('[JobTrack] LinkedIn script loaded on:', location.href);

  // ── Core: extract job from page ─────────────────────────────────────────
  function extract() {
    // Try every known selector LinkedIn has ever used
    const roleSelectors = [
      'h1.job-details-jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title h1',
      'h1.jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title h1',
      '.job-view-layout h1',
      '.jobs-details__main-content h1',
      'h1.t-24',
      'h1.t-24.t-bold',
      '.topcard__title',
      'h1',
    ];
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a',
      '.topcard__org-name-link',
      '.jobs-unified-top-card__subtitle-primary-grouping a',
      '[class*="company-name"] a',
      '[class*="companyName"] a',
      '.job-details-jobs-unified-top-card__primary-description-container a',
    ];
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
      '.jobs-unified-top-card__workplace-type',
      '[class*="location"]',
    ];

    const role     = firstText(roleSelectors);
    const company  = firstText(companySelectors);
    const location = firstText(locationSelectors);
    const url      = window.location.href.split('?')[0];

    console.log('[JobTrack] Extracted:', { role, company, location });
    return { role, company, location, url, source: 'LinkedIn' };
  }

  function firstText(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) return el.innerText.replace(/\s+/g,' ').trim();
      } catch(e) {}
    }
    return '';
  }

  // ── Fire: dedupe and send ────────────────────────────────────────────────
  function fire(reason) {
    const now = Date.now();
    if (now - lastFired < 8000) {
      console.log('[JobTrack] Skipping - debounce active');
      return;
    }
    const data = extract();
    if (!data.role || !data.company) {
      console.log('[JobTrack] Missing role/company - not logging');
      return;
    }
    lastFired = now;
    console.log('[JobTrack] Firing! reason:', reason, data);
    chrome.runtime.sendMessage({ type: 'JOB_APPLIED', data }, (res) => {
      if (chrome.runtime.lastError) {
        console.log('[JobTrack] sendMessage error:', chrome.runtime.lastError);
        return;
      }
      console.log('[JobTrack] Background response:', res);
    });
    showToast(data.role, data.company);
  }

  // ── Strategy 1: click listener on document ───────────────────────────────
  document.addEventListener('click', function(e) {
    const el = e.target.closest('button, a, [role="button"]');
    if (!el) return;

    const txt = (el.textContent || el.innerText || '').trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const combined = txt + ' ' + aria;

    console.log('[JobTrack] Click detected on:', txt.slice(0, 40));

    // External apply button
    if (
      combined === 'apply' ||
      combined.includes('apply on company') ||
      combined.includes('apply now') ||
      (combined.includes('apply') && !combined.includes('easy') && !combined.includes('not'))
    ) {
      console.log('[JobTrack] External apply clicked');
      setTimeout(() => fire('external-apply'), 800);
      return;
    }

    // Easy Apply modal open
    if (combined.includes('easy apply')) {
      console.log('[JobTrack] Easy Apply button clicked - waiting for submit');
      modalWasOpen = true;
      return;
    }

    // Inside Easy Apply modal: submit / done
    if (
      combined.includes('submit application') ||
      combined === 'submit' ||
      (combined === 'done' && modalWasOpen)
    ) {
      console.log('[JobTrack] Submit/Done clicked inside modal');
      setTimeout(() => fire('easy-apply-submit'), 1000);
      modalWasOpen = false;
    }
  }, true);

  // ── Strategy 2: MutationObserver watches for success text ────────────────
  const SUCCESS_PHRASES = [
    'your application was sent',
    'application was submitted',
    'applied to',
    'you applied',
  ];

  let lastBodyText = '';
  const observer = new MutationObserver(() => {
    const bodyText = (document.body.innerText || '').toLowerCase();
    if (bodyText === lastBodyText) return;
    lastBodyText = bodyText;

    for (const phrase of SUCCESS_PHRASES) {
      if (bodyText.includes(phrase)) {
        console.log('[JobTrack] Success phrase found:', phrase);
        fire('mutation-' + phrase.slice(0, 20));
        break;
      }
    }

    // Detect modal closing after being open
    const modalOpen = !!document.querySelector(
      '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], [aria-label="Easy Apply"]'
    );
    if (modalWasOpen && !modalOpen) {
      console.log('[JobTrack] Easy Apply modal closed');
      setTimeout(() => fire('modal-closed'), 500);
      modalWasOpen = false;
    }
    if (modalOpen) modalWasOpen = true;
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // ── Strategy 3: patch History API for SPA navigation ─────────────────────
  function onUrlChange() {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    console.log('[JobTrack] URL changed to:', url);
    modalWasOpen = false;
    lastBodyText = '';
  }

  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = (...a) => { _push(...a);    setTimeout(onUrlChange, 300); };
  history.replaceState = (...a) => { _replace(...a); setTimeout(onUrlChange, 300); };
  window.addEventListener('popstate', () => setTimeout(onUrlChange, 300));

  // Polling fallback for URL changes
  setInterval(() => {
    if (location.href !== lastUrl) onUrlChange();
  }, 1000);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(role, company) {
    const old = document.getElementById('jt-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'jt-toast';
    t.innerHTML = `<b style="color:#4ecca3">✓ JobTrack</b> &nbsp;logged <i>${esc(role)}</i> at <i>${esc(company)}</i>`;
    Object.assign(t.style, {
      position:'fixed', bottom:'28px', right:'28px', zIndex:'2147483647',
      background:'#13141a', color:'#e8eaf2',
      border:'1px solid #6c63ff', borderRadius:'10px',
      padding:'13px 18px', fontSize:'13px',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      boxShadow:'0 8px 32px rgba(0,0,0,0.7)',
      lineHeight:'1.5', maxWidth:'320px',
    });
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 5000);
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  lastUrl = location.href;
  console.log('[JobTrack] Ready. Watching:', lastUrl);

})();
