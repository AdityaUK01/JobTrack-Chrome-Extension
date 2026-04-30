# JobTrack Chrome Extension — True Zero-Click Job Logger

## What happens when you use it
1. You open a job on LinkedIn / Naukri / Indeed / Internshala / Unstop
2. You click Apply (or Easy Apply → Submit)
3. A toast pops up on the page: "✓ JobTrack — logged Data Engineer at Google"
4. A Chrome notification fires
5. The job is saved automatically — no typing, no forms

## Install (2 minutes, one time)

1. Unzip this folder somewhere permanent (Desktop is fine)
2. Open Chrome → go to: chrome://extensions
3. Turn ON "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `jobtrack-ext` folder
6. Done. The JobTrack icon appears in your toolbar.

## How to use
- Just apply to jobs normally on any supported site
- Click the JobTrack icon in Chrome toolbar to see your dashboard
- Edit status (Phone Screen → Interview → Offer) from the popup
- Export CSV anytime

## Supported sites (auto-detect)
| Site | How it detects |
|------|---------------|
| LinkedIn | Easy Apply submit button + "application was sent" modal |
| Naukri | Apply/Apply Now button click + success modal |
| Indeed | Apply button + application submitted confirmation |
| Internshala | Apply Now button + success message |
| Unstop | Apply/Register button click |
| Wellfound, Cutshort | Generic Apply button + JSON-LD data |

## What gets logged automatically
- Company name
- Role / job title
- Location
- Salary (if shown on the page)
- Date applied (today)
- Job URL
- Source site

## Notes
- Data is stored in Chrome's local storage — stays on your machine
- Deduplication: same company+role within 10 minutes = not logged twice
- You can manually edit any field, add recruiter name, notes, follow-up date
- Export CSV for a full backup

## Troubleshooting
- **Not logging**: Refresh the job page after installing
- **LinkedIn not working**: LinkedIn blocks scrapers; the extension reads the DOM directly (logged in = works)
- **Double logging**: The 10-minute dedupe window prevents this
- **Extension disappeared**: Go to chrome://extensions, check it's enabled

## Privacy
- No data leaves your browser
- No server, no account, no tracking
- All storage is chrome.storage.local (your machine only)
