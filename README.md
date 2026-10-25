# SB Truckin · Wharf Invoices

Weekly cartage invoices for wharf work. Pick a company from the list and its details copy onto the invoice, add one line per con note, and the app works out the rate from the rate card, demurrage and fuel levy. Download each invoice as a PDF, and edit, copy to next week, mark paid or delete it later.

It runs as a website on any computer, and on iPhone it installs to the home screen like a normal app (see "iPhone app" below). The same invoices show on every device you log in on.

## What it does

- **Companies:** saved bill-to companies. Choosing one on an invoice copies its name, ABN, address, email and phone in.
- **Invoice lines:** date, con note, customer, suburb, pieces, weight, time in, time out, demurrage, rate and amount. "Add Mon–Sun" adds a line for each day of the week ending.
- **Rate card (Settings):** zones of suburbs separated by `/` with a rate each. Typing a suburb on a line fills its rate.
- **Pricing (Settings):** per tonne with a minimum (default 24 t) or per load; demurrage per hour after free time (default $60/hr after 90 min, charged in full 15-minute blocks); fuel levy % on cartage plus demurrage (default 15%); GST.
- **Columns (Settings):** rename, add, remove and reorder the invoice columns. Each invoice keeps the columns it was made with.
- **PDF:** A4 tax invoice with the SB logo, bill-to details, the lines, cartage, demurrage, fuel levy, GST and total, and your bank details.
- **Backup (Settings):** download everything as one file, and restore it on this or another copy of the app.

## Free hosting: GitHub Pages + Firebase (recommended)

The `docs/` folder is the app as a plain web page. GitHub Pages hosts it for free, and Firebase (free Spark plan, no expiry) stores the data and handles the login.

1. **Firebase:** create a project at console.firebase.google.com. Turn on **Authentication → Email/Password** and add your login under **Users**. Create a **Firestore Database** (production mode, australia-southeast1). Paste `firestore.rules` into **Firestore → Rules** with your login email filled in, and Publish.
2. **Config:** in **Project settings → Your apps**, add a Web app and copy its `firebaseConfig` values into `docs/config.js` as `window.WHARF_FIREBASE = { ... }`.
3. **GitHub Pages:** repo **Settings → Pages → Deploy from a branch → main → /docs**. The app is at `https://<your-user>.github.io/sbt-wharf-invoices/`.

Until `docs/config.js` is filled in, the Pages version saves to the browser only.

To stop anyone else making a Firebase login, turn off **Authentication → Settings → User actions → Enable create (sign-up)**. The rules already block other logins from the data.

## Changing the app

The app itself is `app/app.html`. After editing it, run `npm run build` to update `docs/index.html` and `public/index.html`, then commit all three.

## Server version (optional)

The same app can instead run on its own Node server with its data in SQLite (needs a host such as Railway).

### Run it

Needs Node.js 22.13 or newer.

```bash
npm install
npm start            # http://localhost:3000
```

The first time the app is opened it asks you to create the login (email and password). Or set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first start and that login is created for you.

Tests: `npm test`

All data lives in one SQLite file in `./data` (or `DATA_DIR`). Back that folder up, or use Settings → Download backup.

### Putting it online (Railway)

1. Sign in at railway.com with GitHub, **New Project → Deploy from GitHub repo → sbt-wharf-invoices**. It builds from the `Dockerfile`.
2. Right-click the service box on the canvas → **Attach volume** → mount path `/data`. This keeps your invoices across restarts and deploys.
3. Click the service → **Settings → Networking → Generate Domain**. That https link is the app.
4. Open the link straight away and create your login. Until you do, anyone who opens the link first could create it. To avoid that, add the variables `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the service before generating the domain.
5. Optional: **Settings → Serverless** on, so it sleeps when idle.

## iPhone app

1. Open the link in **Safari** and log in.
2. Tap **Share** (square with the arrow) → **Add to Home Screen** → **Add**.

It opens full screen with the SBT icon. On iPhone, "Download PDF" opens the share sheet so you can save the invoice to Files or send it by Mail or Messages.

On Android, open the link in Chrome and choose **Install app**.
