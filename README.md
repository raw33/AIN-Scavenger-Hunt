# AIN Scavenger Hunt 2026

Static web app for the Aberdeen Internship Network scavenger hunt.

## Files

- `index.html` - GitHub Pages entry point, redirects to the participant app.
- `ain-scavenger-hunt.html` - participant photo submission page.
- `ain-scavenger-admin.html` - admin scoring and team editor.
- `ain-scavenger-db.json` - default game/team database for GitHub hosting.
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
For this static version:

1. Participants submit photos on their device.
2. Participants use **Export team package** when finished.
3. Admin imports those JSON packages in `ain-scavenger-admin.html`.
4. Admin scores submissions and exports CSV results.
5. If teams are edited, admin can export a new `ain-scavenger-db.json` and commit it to GitHub.

For live cross-device collection without export/import, add a backend such as Google Apps Script, Firebase, or Supabase.
