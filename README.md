# MediaVault
# 🎬 MediaVault

MediaVault is a media progress tracking platform that automatically saves and manages your watch progress across anime, movies, TV series, and K-dramas.

## Features

### ✅ Automatic Progress Tracking

Tracks:

* Anime title
* Episode number
* Watch progress
* Last watched timestamp
* Video URL

### ✅ Continue Watching

Resume content from where you left off.

### ✅ Watch History Dashboard

View all watched content in a modern dashboard.

### ✅ Search Functionality

Instantly search your watch history.

### Library organization

Titles can be marked Plan to watch, Watching, Completed, Paused, or Dropped. Add ratings, favorites, personal notes, genres, release details, and sort or filter the collection.

### Watch history and recommendations

The API records progress checkpoints and keeps them under the authenticated account. It provides explainable recommendations based on genres, media type, favorites, and ratings, with an optional AI mode for natural-language requests such as “a tense thriller under two hours.” Configure `OPENAI_API_KEY` on the backend to enable it; `OPENAI_MODEL` defaults to `gpt-5-mini`. Without a key, taste-based recommendations continue to work.

AI receives a limited profile of titles, genres, ratings, favorites, statuses, and the user's short request, plus the recommendation catalog. Personal notes, watch URLs, passwords, and tokens are not sent. AI results are restricted to catalog candidates and fall back to the explainable ranking if the service is unavailable. New manually added anime can be matched to AniList IDs and metadata.

### ✅ Progress Visualization

Track episode completion using dynamic progress bars.

### ✅ Featured Continue Watching Section

Quickly resume your most recently watched content.

### ✅ Responsive UI

Modern dashboard built with HTML, CSS, and JavaScript.

---

## Tech Stack

### Frontend

* HTML
* CSS
* JavaScript
* Vite

### Backend

* Node.js
* Express.js
* PostgreSQL (`pg`) for accounts, libraries, and watch history

## Run locally on Windows

Use two Command Prompt windows. Node.js 20.19+ is recommended.

1. Install PostgreSQL locally and create a database named `mediavault`. In the first window, start the API:

   ```bat
   cd backend
   npm install
   copy .env.example .env
   ```

   Edit `backend\.env` and set `DATABASE_URL` to your PostgreSQL connection URL (see `.env.example`) and set a private random `JWT_SECRET` with at least 32 characters. Then run:

   ```bat
   npm start
   ```

2. In a second window, start the frontend:

   ```bat
   cd frontend
   npm install
   copy .env.example .env.local
   npm run dev
   ```

3. Open the local URL Vite prints (usually `http://localhost:5173`). Check API readiness at `http://localhost:5000/health`.

## Deployment settings

* **Render PostgreSQL:** create a PostgreSQL database in Render in the same region as the API service. Copy its **internal database URL** from the database's Connect page. Render's internal URL is intended for services in the same region and uses its private network: https://render.com/docs/postgresql-creating-connecting.
* **Render API:** set the service root directory to `backend`, build command to `npm install`, start command to `npm start`, and health check path to `/health`. Configure `DATABASE_URL` (the PostgreSQL internal URL), `JWT_SECRET` (a new private random value of at least 32 characters), and `FRONTEND_ORIGIN` (the exact deployed frontend origin) in Render's Environment settings. To enable AI picks, also add `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Keep the key in Render's backend environment only; never add it to Vercel or frontend environment variables. Use `DATABASE_SSL=true` only if your PostgreSQL provider specifically requires TLS for that connection.
* **Vercel frontend:** set the project root directory to `frontend`, build command to `npm run build`, output directory to `dist`, and `VITE_API_URL` to the Render API origin (for example, `https://your-service.onrender.com`, without a trailing slash).
* **Secret rotation:** credentials were present in older Git commits. Rotate any exposed credentials and replace Render's `JWT_SECRET` with a fresh random value of at least 32 characters. Redeploy the API and sign in again; replacing `JWT_SECRET` invalidates existing login tokens. Removing secrets from the current checkout alone does not erase Git history.

* **API additions:** authenticated `GET /api/progress/:id/events` returns a title's recent watch events. `GET /api/recommendations` returns ranked picks and their match reasons; `POST /api/recommendations/dismiss` hides a pick for that account. Existing records receive one snapshot on their first API read because historical episodes cannot be reconstructed retroactively.

The API exposes `/health` for deployment health checks and only accepts browser requests from local development plus the configured `FRONTEND_ORIGIN`. Set that origin to the production Vercel domain in Render.

The PostgreSQL database starts with an empty schema. Existing records in the unavailable MongoDB database are not copied automatically; export them from a reachable MongoDB instance before switching if you need to preserve them.

### Browser Extension

* Chrome / Opera Manifest V3 extension
* Saves playback progress locally and syncs to MediaVault when signed in
* Supports AniDoor, VidNest, HiAnime, Crunchyroll, AnimePahe, and YouTube
* Restores the saved position for the same title and episode

#### Install the unpacked extension

1. Open `chrome://extensions` in Chrome or `opera://extensions` in Opera.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the repository's `extension` folder.
4. Open a supported site, start a video, and sign in from the MediaVault extension popup to sync progress.

Progress remains in browser storage while signed out or while the backend is unavailable. The extension requests access to supported streaming sites and the MediaVault API.

### APIs

* AniList GraphQL API

---

## Roadmap

### Future Work

* Broader playback-site support
* Improved episode matching for multi-season series
* Chrome Web Store release

---

## Project Status

Current Version: MVP v1.0

Development Progress: 90%

---

## Author

Prit Bhatt

GitHub: https://github.com/KozmikLojik
