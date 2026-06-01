# AIN Scavenger Hunt 2026

Static web app for the Aberdeen Internship Network scavenger hunt.

## Files

- `index.html` - GitHub Pages entry point, redirects to the participant app.
- `ain-scavenger-hunt.html` - participant photo submission page.
- `ain-scavenger-admin.html` - admin scoring and team editor.
- `ain-scavenger-db.json` - default game/team database for GitHub hosting.
- `backend-config.js` - shared database endpoint configuration.
- `apps-script-backend.gs` - Google Apps Script backend for photo/database storage.
- `preview.html` - local launcher kept for compatibility.

## Admin

Admin code: `605`

Admins can:

- add/delete teams
- rename teams
- add/remove team members
- import team submission packages
- approve/reject photos
- award listed bonus and extra-person bonus points
- export score CSV
- export an updated `ain-scavenger-db.json`

## GitHub Pages

Enable GitHub Pages for the repository and use the root folder on `main`.
The public URL will open `index.html`, which sends participants to `ain-scavenger-hunt.html`.

## Data Model

GitHub Pages can host files but cannot write back to the repository from a visitor's browser.
For live photo submission and admin scoring, use the included Google Apps Script backend.

## Shared Database Setup

1. Create a Google Sheet named `AIN Scavenger Hunt 2026`.
2. In the Sheet, go to **Extensions > Apps Script**.
3. Paste the contents of `apps-script-backend.gs`.
4. Deploy it as a **Web app**.
5. Set **Execute as** to yourself.
6. Set **Who has access** to anyone with the link.
7. Copy the Web App URL.
8. Paste that URL into `backend-config.js`:

```js
window.AIN_BACKEND_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
```

9. Commit and push `backend-config.js`.

After that:

- participants submit photos to the shared Google Sheet/Drive backend
- admin uses **Sync shared database**
- admin checks **Qualifies for base points**
- scores calculate automatically

For offline fallback:

1. Participants submit photos on their device.
2. Participants use **Export team package** when finished.
3. Admin imports those JSON packages in `ain-scavenger-admin.html`.
4. Admin scores submissions and exports CSV results.
5. If teams are edited, admin can export a new `ain-scavenger-db.json` and commit it to GitHub.
