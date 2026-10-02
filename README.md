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
* MongoDB with Mongoose

## Run locally on Windows

Use two Command Prompt windows. Node.js 20.19+ is recommended.

1. In the first window, start the API:

   ```bat
   cd backend
   npm install
   copy .env.example .env
   ```

   Edit `backend\.env` and set a working MongoDB connection string and a private random `JWT_SECRET` with at least 32 characters. Then run:

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

* **Render API:** set the service root directory to `backend`, build command to `npm install`, start command to `npm start`, and health check path to `/health`. Configure `MONGO_URI`, `JWT_SECRET` (a new private random secret), and `FRONTEND_ORIGIN` (the exact deployed frontend origin) in Render's environment settings.
* **Vercel frontend:** set the project root directory to `frontend`, build command to `npm run build`, output directory to `dist`, and `VITE_API_URL` to the Render API origin (for example, `https://your-service.onrender.com`, without a trailing slash).
* **MongoDB Atlas:** copy the current application connection string from Atlas into Render's `MONGO_URI`, replace its username/password placeholders, verify the cluster hostname resolves, and allow the Render service's outbound connection in Atlas Network Access. The previous `ENOTFOUND` log means the configured cluster hostname could not be resolved; code changes cannot repair a missing or mistyped Atlas host.

The API exposes `/health` for deployment health checks and only accepts browser requests from local development plus the configured `FRONTEND_ORIGIN`. Set that origin to the production Vercel domain in Render.

If a real database credential has ever been committed to this repository, rotate it in Atlas and update Render's `MONGO_URI`. Removing it from the current files does not remove it from Git history.

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
