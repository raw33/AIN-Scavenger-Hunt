# AIN Scavenger Hunt 2026

Web app for the Aberdeen Internship Network scavenger hunt.

This repo includes its own backend. Participants can submit photos, the server saves them under the correct team, and admins can approve finds with a checkbox so points calculate automatically.

## Files

- `index.html` - entry point, redirects to the participant app.
- `ain-scavenger-hunt.html` - participant photo submission page.
- `ain-scavenger-admin.html` - admin scoring and team editor.
- `ain-scavenger-db.json` - default game/team database.
- `backend-config.js` - optional backend URL override.
- `server.js` - internal Node backend and static file server.
- Replit PostgreSQL - production database when `DATABASE_URL` is present.
- `data/submissions.json` - local fallback database, created automatically and ignored by git.
- `data/uploads/` - local fallback photo storage, created automatically and ignored by git.

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Admin code:

```text
605
```

## How Submissions Work

1. Participant chooses a team.
2. Participant chooses a clue number and submits a photo.
3. `server.js` saves the photo to `data/uploads/`.
4. `server.js` stores the submission row in `data/submissions.json`.
5. Admin opens the admin page and clicks **Sync shared database**.
6. Admin checks **Qualifies for base points**.
7. The app awards the base clue points automatically and recalculates the leaderboard.

Listed bonus and extra-person bonus points can be entered beside the checkbox.

## Replit Database Setup

Use Replit's built-in Database tool and production database.

1. Import this GitHub repo into Replit.
2. Open the Replit **Database** tool.
3. Add/enable the SQL database.
4. Confirm Replit provides `DATABASE_URL`.
5. Publish/deploy the app and choose/create the **production database**.
6. Run the app with:

```bash
npm start
```

When `DATABASE_URL` exists, `server.js` automatically creates the `submissions` table and stores photo data plus scoring records in PostgreSQL. No GitHub token is exposed to the browser.

Replit has separate development and production databases. Use the production database for the actual scavenger hunt so test data does not mix with live submissions.

## Deployment

GitHub Pages alone cannot save uploaded files or write to a database. Deploy this as a Node app. Replit is the intended host for this version.

Other compatible hosts:

- Render with a persistent disk
- Railway with a volume
- Fly.io with a volume
- a VPS

Start command:

```bash
npm start
```

If the frontend and backend are deployed together with `server.js`, leave `backend-config.js` blank:

```js
window.AIN_BACKEND_URL = "";
```

If the frontend is hosted somewhere else, set `backend-config.js` to the backend URL:

```js
window.AIN_BACKEND_URL = "https://your-node-backend.example.com";
```

## Admin Features

- add/delete teams
- rename teams
- add/remove team members
- sync submitted photos from the internal database
- approve/reject photos
- checkbox scoring for base points
- listed bonus and extra-person bonus scoring
- export score CSV
- export an updated `ain-scavenger-db.json`
