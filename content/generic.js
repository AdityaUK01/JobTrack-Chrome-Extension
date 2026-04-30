// content/generic.js — Generic Apply Detector (Wellfound, Cutshort, etc.)

(function () {
  'use strict';
  let lastFired = 0;

  function extract() {
    // Try JSON-LD structured data first — most reliable
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        let d = JSON.parse(script.textContent || '');
        if (Array.isArray(d)) d = d[0];
        if (d && (d['@type'] === 'JobPosting' || d['@type'] === 'jobposting')) {
          return {
            role:     d.title || '',
            company:  (d.hiringOrganization || {}).name || '',
            location: (d.jobLocation || {}).address?.addressLocality || '',
            salary:   String((d.baseSalary || {}).value || ''),
            url:      window.location.href.split('?')[0],
            source:   window.location.hostname,
          };
        }
      } catch (_) {}
    }

    // Fallback: guess from page
    const h1 = document.querySelector('h1');
    const metaCompany =
      document.querySelector('meta[property="og:site_name"]') ||
      document.querySelector('meta[name="author"]');

    return {
      role:    h1 ? h1.innerText.trim() : document.title.split('|')[0].trim(),
      company: metaCompany?.content || document.title.split('|')[1]?.trim() || '',
      url:     window.location.href.split('?')[0],
      source:  window.location.hostname,
    };
  }

  function fire() {
    const now = Date.now();
    if (now - lastFired < 8000) return;
    const data = extract();
    if (!data.role) return;
    lastFired = now;
    chrome.runtime.sendMessage({ type: 'JOB_APPLIED', data });
    showToast(data.role, data.company);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const txt = (btn.innerText || '').trim().toLowerCase();
    const cls = (btn.className || '').toLowerCase();

    if (
      (txt === 'apply' || txt === 'apply now' || txt.includes('apply for')) &&
      !txt.includes('login') && !txt.includes('sign')
    ) {
      setTimeout(fire, 1200);
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
    t.innerHTML = `<b>✓ JobTrack</b> — logged <i>${role}</i>${company ? ` at <i>${company}</i>` : ''}`;
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
