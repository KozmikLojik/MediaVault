import axios from "axios";
import { io } from "socket.io-client";

import config from "./config";
import "./style.css";
import {
  requireAuth,
  fetchWithAuth,
  initNavAuth
} from "./services/api";

if (!requireAuth()) {
  throw new Error("Redirecting to login");
}

initNavAuth();

const socket = io(config.API_URL);

const animeList = document.getElementById("anime-list");
const searchInput = document.getElementById("search");
const loader = document.getElementById("loader");
const errorMessage = document.getElementById("error-message");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const closeModal = document.getElementById("close-modal");
const filterButtons = document.querySelectorAll(".filter-btn");
const heroPanel = document.querySelector(".hero-panel");
const heroBackgroundFront = document.querySelector(".hero-background-front");
const heroBackgroundBack = document.querySelector(".hero-background-back");
const heroOverlay = document.querySelector(".hero-overlay");
const featuredTitle = document.getElementById("featured-title");
const featuredDesc = document.getElementById("featured-desc");
const featuredCategory = document.getElementById("featured-category");
const featuredRating = document.getElementById("featured-rating");
const featuredDuration = document.getElementById("featured-duration");
const featuredEpisodes = document.getElementById("featured-episodes");
const featuredImdb = document.getElementById("featured-imdb");
const featuredStatus = document.getElementById("featured-status");
const featuredStatusLabel = document.getElementById("featured-status-label");
const featuredGenres = document.getElementById("featured-genres");
const featuredStudio = document.getElementById("featured-studio");
const featuredButton = document.getElementById("featured-button");
const heroTag = featuredCategory;
const heroPosterImg = document.querySelector(".hero-poster-img");
const heroPoster = document.getElementById("hero-poster");
const quickCards = document.querySelectorAll(".quick-card");
const navbar = document.querySelector(".navbar");
const weatherIcon = document.querySelector(".weather-icon");
const weatherTemp = document.querySelector(".weather-temp");
const weatherDesc = document.querySelector(".weather-desc");
const statusText = document.getElementById("system-status");
const storageText = document.getElementById("storage-used");
const activityText = document.getElementById("recent-activity");

let allAnime = [];

function formatTimeAgo(dateString) {
  if (!dateString) {
    return "Unknown";
  }

  const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return `${days} days ago`;
  }

  return new Date(dateString).toLocaleDateString();
}

function formatTimecode(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getPercentWatched(anime) {
  return Math.floor(
    Math.min(((anime.currentTime || 0) / (anime.duration || 1)) * 100, 100)
  );
}

async function getAnimePoster(title) {
  const cachedPoster = localStorage.getItem(`poster-${title}`);

  if (cachedPoster) {
    return cachedPoster;
  }

  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          coverImage {
            large
          }
        }
      }
    `;

    const response = await axios.post("https://graphql.anilist.co", {
      query,
      variables: { search: title }
    });

    const poster = response.data.data.Media.coverImage.large;

    localStorage.setItem(`poster-${title}`, poster);

    return poster;
  } catch {
    return "https://placehold.co/300x400";
  }
}

async function renderAnime(data) {
  if (data.length === 0) {
    animeList.innerHTML = `
      <div class="empty-state">
        <h2>No media found</h2>
        <p>Start watching something!</p>
      </div>
    `;
    return;
  }

  animeList.innerHTML = "";

  for (const anime of data) {
    const poster = await getAnimePoster(anime.animeTitle);
    const pct = getPercentWatched(anime);

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-media">
        <img src="${poster}" class="anime-cover" alt="${anime.animeTitle}">
        <span class="card-badge">${pct}% watched</span>
      </div>

      <div class="card-body">
        <h2 class="card-title">${anime.animeTitle}</h2>
        <p class="card-meta">${anime.episode}</p>
        <p class="last-watched">${formatTimeAgo(anime.updatedAt)}</p>
        <p class="card-timecode">
          ${formatTimecode(anime.currentTime)} / ${formatTimecode(anime.duration)}
        </p>

        <div class="progress-container">
          <div class="progress-fill" style="width: ${pct}%;"></div>
        </div>

        <button class="watch-btn">▶ Continue Watching</button>
      </div>
    `;

    animeList.appendChild(card);

    card.addEventListener("click", () => {
      modal.style.display = "flex";

      modalBody.innerHTML = `
        <img src="${poster}">
        <h1>${anime.animeTitle}</h1>
        <p>${anime.episode}</p>
        <p>Last Position: ${formatTimecode(anime.currentTime)} / ${formatTimecode(anime.duration)}</p>
        <div class="progress-container">
          <div class="progress-fill" style="width: ${pct}%;"></div>
        </div>
      `;
    });

    const button = card.querySelector(".watch-btn");

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (anime.url) {
        window.location.href = anime.url;
      }
    });
  }
}

async function renderContinueWatching() {
  const container = document.getElementById("continue-watching");
  container.innerHTML = "";

  const recent = allAnime.slice(0, 5);

  for (const anime of recent) {
    const poster = await getAnimePoster(anime.animeTitle);
    const pct = getPercentWatched(anime);

    const card = document.createElement("div");
    card.className = "continue-card";

    card.innerHTML = `
      <div class="continue-media">
        <img src="${poster}" alt="${anime.animeTitle}" />
        <div class="continue-play">▶</div>
      </div>

      <div class="ticket-divider"></div>

      <div class="continue-info">
        <h3>${anime.animeTitle}</h3>
        <p class="continue-meta">${anime.episode}</p>

        <div class="continue-progress-row">
          <div class="progress-container">
            <div class="progress-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="continue-pct">${pct}%</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      window.open(anime.url, "_blank");
    };

    container.appendChild(card);
  }
}

async function loadAnime() {
  loader.style.display = "flex";
  errorMessage.style.display = "none";

  let data = [];

  try {
    const response = await fetchWithAuth(`${config.API_URL}/api/progress`);

    if (!response.ok) {
      throw new Error("Server Error");
    }

    data = await response.json();
  } catch (error) {
    console.error(error);

    loader.style.display = "none";
    errorMessage.style.display = "block";

    errorMessage.innerHTML = `
      ❌ Unable to connect to MediaVault backend.
      <br><br>
      Start your backend server and refresh the page.
    `;

    return;
  }

  allAnime = data
    .map(anime => ({ ...anime, type: anime.type || "Anime" }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  refreshWatchHistory();
  await updateFeatured();

  let filteredData = allAnime;

  const totalAnime = data.length;

  const topAnime = [...data].sort((a, b) => b.currentTime - a.currentTime)[0];

  const totalHours = (
    data.reduce((sum, anime) => sum + anime.currentTime, 0) / 3600
  ).toFixed(1);

  document.getElementById("anime-count").innerText = totalAnime;
  document.getElementById("hours-watched").innerText = totalHours;
  document.getElementById("top-anime").innerText = topAnime ? topAnime.animeTitle : "-";

  await renderAnime(filteredData);
  await renderContinueWatching();

  loader.style.display = "none";
}

loadAnime();

let reloadTimeout;

socket.on("history-updated", () => {
  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(loadAnime, 500);
});

if (searchInput) {
  searchInput.addEventListener("input", async () => {
    const search = searchInput.value.toLowerCase();

    const filteredData = allAnime.filter(anime =>
      anime.animeTitle.toLowerCase().includes(search) ||
      (anime.type || "").toLowerCase().includes(search)
    );

    await renderAnime(filteredData);
  });
}

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

filterButtons.forEach(button => {
  button.addEventListener("click", async () => {
    filterButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    const filter = button.innerText;
    const filtered = filter === "All"
      ? allAnime
      : allAnime.filter(anime => (anime.type || "Anime") === filter);

    await renderAnime(filtered);
  });
});

quickCards.forEach(card => {
  const filter = card.dataset.filter || card.textContent.trim();
  card.addEventListener("click", async () => {
    filterButtons.forEach(btn => btn.classList.remove("active"));
    const activeButton = Array.from(filterButtons).find(btn => btn.innerText === filter);
    if (activeButton) activeButton.classList.add("active");

    const filtered = filter === "All"
      ? allAnime
      : allAnime.filter(anime => (anime.type || "Anime") === filter);

    await renderAnime(filtered);
  });
});

featuredButton?.addEventListener("click", () => {
  document.getElementById("continue-watching")?.scrollIntoView({
    behavior: "smooth"
  });
});

window.addEventListener("scroll", () => {
  if (!navbar) return;
  navbar.classList.toggle("navbar-shrink", window.scrollY > 24);
});

document
  .querySelectorAll(".terminal-grid button")
  .forEach(button => {
    button.onclick = () => {
      const command = button.textContent;

      if (command === "/watching") {
        document.getElementById("continue-watching")?.scrollIntoView({
          behavior: "smooth"
        });
      }

      if (command === "/stats") {
        window.location.href = "/stats.html";
      }

      if (command === "/library") {
        document.getElementById("anime-list")?.scrollIntoView({
          behavior: "smooth"
        });
      }

      if (command === "/random") {
        if (!allAnime.length) {
          return;
        }

        const random = allAnime[Math.floor(Math.random() * allAnime.length)];

        if (random.url) {
          window.open(random.url, "_blank");
        }
      }
    };
  });

/* =========================
   LIVE CLOCK
========================= */

function updateClock() {
  const now = new Date();

  const clock = document.getElementById("clock");
  const date = document.getElementById("date");

  if (!clock) return;

  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  date.textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

updateClock();
setInterval(updateClock, 1000);

/* =========================
   DYNAMIC WALLPAPER SYSTEM
========================= */

const themes = {
  animeNight: {
    name: "Anime Night",
    bg: "#0B1020",
    bg2: "#151932",
    primary: "#7C5CFF",
    secondary: "#5EEAD4",
    accent: "#FF6B9A",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    border: "rgba(255,255,255,.08)",
    wallpaper: "/images/solo-leveling.jpg"
  },
  kdramaMood: {
    name: "K-Drama Mood",
    bg: "#111827",
    bg2: "#1E2937",
    primary: "#EC4899",
    secondary: "#F472B6",
    accent: "#F8FAFC",
    text: "#FFFFFF",
    textMuted: "#CBD5E1",
    border: "rgba(255,255,255,.1)",
    wallpaper: "/images/frieren.jpg"
  },
  cinemaMode: {
    name: "Cinema Mode",
    bg: "#0B0F19",
    bg2: "#1E293B",
    primary: "#EAB308",
    secondary: "#EF4444",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    textMuted: "#94A3B8",
    border: "rgba(255,255,255,.08)",
    wallpaper: "/images/classroom.jpg"
  },
  cyberpunk: {
    name: "Cyberpunk",
    bg: "#050816",
    bg2: "#0A1020",
    primary: "#00E5FF",
    secondary: "#FF00FF",
    accent: "#7C5CFF",
    text: "#FFFFFF",
    textMuted: "#94A3B8",
    border: "rgba(0,255,255,.2)",
    wallpaper: "/images/solo-leveling.jpg"
  },
  minimal: {
    name: "Minimal",
    bg: "#111827",
    bg2: "#1F2937",
    primary: "#94A3B8",
    secondary: "#FFFFFF",
    accent: "#64748B",
    text: "#FFFFFF",
    textMuted: "#9CA3AF",
    border: "rgba(255,255,255,.05)",
    wallpaper: null
  }
};

function setTheme(themeKey) {
  const theme = themes[themeKey];
  if (!theme) return;

  document.documentElement.style.setProperty("--bg", theme.bg);
  document.documentElement.style.setProperty("--bg2", theme.bg2);
  document.documentElement.style.setProperty("--primary", theme.primary);
  document.documentElement.style.setProperty("--secondary", theme.secondary);
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--text", theme.text);
  document.documentElement.style.setProperty("--text-muted", theme.textMuted);
  document.documentElement.style.setProperty("--border", theme.border);

  localStorage.setItem("mediavault-theme", themeKey);
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem("mediavault-theme");
  if (savedTheme && themes[savedTheme]) {
    setTheme(savedTheme);
  }
}

loadSavedTheme();

/* =========================
   ROTATING FEATURED PRESENTATION
========================= */

const featuredMedia = [
  // --- ANIME (Purple accented) ---
  {
    title: "Solo Leveling",
    desc: "The weakest hunter becomes humanity's strongest weapon.",
    category: "Anime",
    wallpaper: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1600&q=80",
    poster: "https://cdn.myanimelist.net/images/anime/1901/139991.jpg",
    accentColor: "#7C5CFF",
    buttonText: "▶ Continue",
    rating: "9.7",
    imdb: "8.5",
    duration: "24 Episodes",
    episodes: "24 Episodes",
    studio: "A-1 Pictures",
    status: "airing",
    genres: ["Action", "Fantasy", "Supernatural"]
  },
  {
    title: "Frieren: Beyond Journey's End",
    desc: "A beautiful journey after the hero's adventure ends.",
    category: "Anime",
    wallpaper: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80",
    poster: "https://cdn.myanimelist.net/images/anime/1015/138006.jpg",
    accentColor: "#8B5CF6",
    buttonText: "▶ Explore",
    rating: "9.1",
    imdb: "8.9",
    duration: "28 Episodes",
    episodes: "28 Episodes",
    studio: "Madhouse",
    status: "airing",
    genres: ["Adventure", "Fantasy", "Drama"]
  },
  {
    title: "Demon Slayer",
    desc: "A boy hunts demons to restore his family and cure his sister.",
    category: "Anime",
    wallpaper: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&q=80",
    poster: "https://cdn.myanimelist.net/images/anime/1286/99889.jpg",
    accentColor: "#5EEAD4",
    buttonText: "▶ Watch Now",
    rating: "9.3",
    imdb: "8.7",
    duration: "63 Episodes",
    episodes: "63 Episodes",
    studio: "ufotable",
    status: "completed",
    genres: ["Action", "Supernatural", "Adventure"]
  },
  // --- MOVIES (Gold accented) ---
  {
    title: "Interstellar",
    desc: "Love transcends dimensions and time.",
    category: "Movie",
    wallpaper: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg",
    accentColor: "#FBBF24",
    buttonText: "▶ Watch Trailer",
    rating: "9.0",
    imdb: "8.7",
    duration: "2h 49m",
    episodes: "2h 49m",
    studio: "Warner Bros.",
    status: "completed",
    genres: ["Sci-Fi", "Adventure", "Drama"]
  },
  {
    title: "The Batman",
    desc: "Vengeance becomes hope.",
    category: "Movie",
    wallpaper: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BMDdmMTBiNTYtMDIzNi00NGVlLWIzMDYtZTk3MTQ3NGQxZGEwXkEyXkFqcGdeQXVyMzMwOTU5MDk@._V1_.jpg",
    accentColor: "#F97316",
    buttonText: "▶ Explore",
    rating: "8.3",
    imdb: "7.8",
    duration: "2h 56m",
    episodes: "2h 56m",
    studio: "DC Studios",
    status: "completed",
    genres: ["Action", "Crime", "Thriller"]
  },
  {
    title: "John Wick: Chapter 4",
    desc: "The Baba Yaga returns with unstoppable force.",
    category: "Movie",
    wallpaper: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BMDExZGMyOTMtYjRjYi00NDQzLWJhNTktZDVmZTc5M2YyNzcyXkEyXkFqcGdeQXVyMjM4NTMxNDY@._V1_.jpg",
    accentColor: "#F97316",
    buttonText: "▶ Continue",
    rating: "7.9",
    imdb: "7.7",
    duration: "2h 49m",
    episodes: "2h 49m",
    studio: "Lionsgate",
    status: "completed",
    genres: ["Action", "Thriller", "Crime"]
  },
  // --- TV SERIES (Blue accented) ---
  {
    title: "Breaking Bad",
    desc: "A high school teacher turns to crime after a shocking diagnosis.",
    category: "TV",
    wallpaper: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BYmQ4YWMxYzUtZjZmYi00ZWQzLWE4MzItYWE1YzE2Njc1Y2I0XkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_.jpg",
    accentColor: "#3B82F6",
    buttonText: "▶ Start Watching",
    rating: "9.5",
    imdb: "9.5",
    duration: "62 Episodes",
    episodes: "62 Episodes",
    studio: "AMC",
    status: "completed",
    genres: ["Crime", "Drama", "Thriller"]
  },
  {
    title: "The Last of Us",
    desc: "A hardened survivor protects a girl who may be humanity's last hope.",
    category: "TV",
    wallpaper: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BZGUzYTI3NjctYjU0Yi00NjRkLTkwZjItZjY5ZTg3Y2Q0NTVkXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg",
    accentColor: "#2563EB",
    buttonText: "▶ Resume",
    rating: "9.1",
    imdb: "8.8",
    duration: "18 Episodes",
    episodes: "18 Episodes",
    studio: "HBO",
    status: "returning",
    genres: ["Drama", "Adventure", "Thriller"]
  },
  // --- K-DRAMA (Pink accented) ---
  {
    title: "Weak Hero Class 1",
    desc: "A bullied student fights back with strategy and resolve.",
    category: "K-Drama",
    wallpaper: "https://images.unsplash.com/photo-1516410529446-2c777cb7366d?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BYmZkNDJkNTMtZGViYS00YjZmLTg3MTMtMzVhODk4MzIyYmZmXkEyXkFqcGdeQXVyMTE1MzI3NzIx._V1_.jpg",
    accentColor: "#EC4899",
    buttonText: "▶ Resume",
    rating: "8.8",
    imdb: "8.6",
    duration: "12 Episodes",
    episodes: "12 Episodes",
    studio: "Wavve",
    status: "completed",
    genres: ["Action", "Drama", "School"]
  },
  {
    title: "Kingdom",
    desc: "A crown prince fights to save his kingdom from a dark plague.",
    category: "K-Drama",
    wallpaper: "https://images.unsplash.com/photo-1516205651411-8470b0e32669?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BMjE0MzA3NTUtZjE5My00YzZkLWIzN2YtMjc1NTYyNDhiNTc4XkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg",
    accentColor: "#F43F5E",
    buttonText: "▶ Watch Now",
    rating: "8.9",
    imdb: "8.3",
    duration: "2 Seasons",
    episodes: "2 Seasons",
    studio: "Netflix",
    status: "returning",
    genres: ["Historical", "Horror", "Action"]
  },
  {
    title: "Moving",
    desc: "Hidden powers, family secrets, and a world on the brink.",
    category: "K-Drama",
    wallpaper: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BZjM5YjhkOTEtYTVkYy00OTJhLThjOWEtNDdiMDVmNWUyM2QzXkEyXkFqcGdeQXVyMTE1MzI3NzIx._V1_.jpg",
    accentColor: "#F43F5E",
    buttonText: "▶ Continue",
    rating: "8.5",
    imdb: "8.1",
    duration: "12 Episodes",
    episodes: "12 Episodes",
    studio: "Disney+",
    status: "completed",
    genres: ["Action", "Drama", "Sci-Fi"]
  },
  {
    title: "Vincenzo",
    desc: "A consigliere takes on a corrupt conglomerate with clever fire.",
    category: "K-Drama",
    wallpaper: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1600&q=80",
    poster: "https://m.media-amazon.com/images/M/MV5BZjQxYzBlYTQtMzQzYy00YjUyLTgxNTUtYzQzODA5YzExZDRmXkEyXkFqcGdeQXVyMTE1MzI3NzIx._V1_.jpg",
    accentColor: "#F97316",
    buttonText: "▶ Resume",
    rating: "8.7",
    imdb: "8.4",
    duration: "20 Episodes",
    episodes: "20 Episodes",
    studio: "tvN",
    status: "completed",
    genres: ["Crime", "Drama", "Comedy"]
  }
];

let featuredIndex = Math.floor(Math.random() * featuredMedia.length);
let activeBackground = heroBackgroundFront;
let heroHistoryTitles = new Set();

function preloadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve();
      return;
    }

    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

function getCategoryClass(category) {
  const normalized = category.toLowerCase().trim();
  if (normalized.includes("movie")) return "category-movie";
  if (normalized.includes("k-drama")) return "category-k-drama";
  if (normalized.includes("tv")) return "category-tv";
  if (normalized.includes("anime")) return "category-anime";
  return `category-${normalized.replace(/\s+/g, "-")}`;
}

function getCategoryAccentColor(category) {
  const normalized = category.toLowerCase().trim();
  if (normalized.includes("movie")) return "#FBBF24";
  if (normalized.includes("k-drama")) return "#EC4899";
  if (normalized.includes("tv")) return "#3B82F6";
  return "#7C5CFF";
}

function clearCategoryClasses(element) {
  if (!element) return;
  Array.from(element.classList).forEach(cls => {
    if (cls.startsWith("category-")) {
      element.classList.remove(cls);
    }
  });
}

function setHeroBackground(imageUrl) {
  if (!heroBackgroundFront || !heroBackgroundBack) {
    return;
  }

  const nextBackground = activeBackground === heroBackgroundFront ? heroBackgroundBack : heroBackgroundFront;
  nextBackground.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.7)), url("${imageUrl}")`;
  nextBackground.classList.add("visible");
  activeBackground.classList.remove("visible");
  activeBackground = nextBackground;
}

function renderGenreChips(genres) {
  if (!featuredGenres) return;
  featuredGenres.innerHTML = genres
    .map(genre => `<span class="genre-chip">${genre}</span>`)
    .join("");
}

function refreshWatchHistory() {
  heroHistoryTitles = new Set(
    allAnime.map((anime) => (anime.animeTitle || "").toLowerCase())
  );
}

async function updateFeatured() {
  if (
    !heroPanel ||
    !heroOverlay ||
    !featuredTitle ||
    !featuredDesc ||
    !featuredCategory ||
    !featuredRating ||
    !featuredDuration ||
    !featuredEpisodes ||
    !featuredImdb ||
    !featuredGenres ||
    !featuredStudio ||
    !featuredButton ||
    !heroTag
  ) {
    return;
  }

  const item = featuredMedia[featuredIndex];
  if (!item) {
    return;
  }

  const categoryClass = getCategoryClass(item.category);

  clearCategoryClasses(heroPanel);
  heroPanel.classList.add(categoryClass);
  heroOverlay.classList.add("fade-out");

  await preloadImage(item.wallpaper);
  setHeroBackground(item.wallpaper);

  // Preload poster
  if (heroPosterImg && item.poster) {
    heroPosterImg.style.backgroundImage = `url("${item.poster}")`;
  }

  setTimeout(() => {
    heroTag.textContent = item.category;
    featuredCategory.textContent = item.category;
    featuredTitle.textContent = item.title;
    featuredDesc.textContent = item.desc;
    featuredRating.textContent = `★★★★★ ${item.rating}`;
    featuredDuration.textContent = item.duration;
    featuredEpisodes.textContent = item.episodes;
    featuredImdb.textContent = item.imdb;

    // Status
    const statusColor = item.status === "airing" || item.status === "returning" ? "#22c55e" : "#94a3b8";
    const statusLabel = item.status === "airing" ? "Airing" : item.status === "returning" ? "Returning" : "Completed";
    if (featuredStatus) {
      featuredStatus.style.background = statusColor;
      featuredStatus.style.boxShadow = `0 0 6px ${statusColor}80`;
    }
    if (featuredStatusLabel) {
      featuredStatusLabel.textContent = statusLabel;
      featuredStatusLabel.style.color = statusColor;
    }

    // Studio
    if (featuredStudio) {
      featuredStudio.textContent = item.studio;
    }

    // Button
    featuredButton.textContent = item.buttonText;
    featuredButton.style.boxShadow = `0 8px 30px ${item.accentColor}55`;

    // Tag style
    heroTag.style.borderColor = `${item.accentColor}40`;
    heroTag.style.background = `${item.accentColor}15`;
    heroTag.style.color = getCategoryAccentColor(item.category);

    renderGenreChips(item.genres);
    heroOverlay.classList.remove("fade-out");
  }, 220);
}

function handleHeroParallax(event) {
  if (!heroBackgroundFront || !heroBackgroundBack || !heroPanel) return;
  const { left, top, width, height } = heroPanel.getBoundingClientRect();
  const x = ((event.clientX - left) / width - 0.5) * 18;
  const y = ((event.clientY - top) / height - 0.5) * 14;

  heroBackgroundFront.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.06)`;
  heroBackgroundBack.style.transform = `translate3d(${x * 0.6}px, ${y * 0.6}px, 0) scale(1.05)`;
}

function resetHeroParallax() {
  if (!heroBackgroundFront || !heroBackgroundBack) return;
  heroBackgroundFront.style.transform = "scale(1.05)";
  heroBackgroundBack.style.transform = "scale(1.05)";
}

heroPanel?.addEventListener("mousemove", handleHeroParallax);
heroPanel?.addEventListener("mouseleave", resetHeroParallax);

updateFeatured();

setInterval(async () => {
  featuredIndex = (featuredIndex + 1) % featuredMedia.length;
  await updateFeatured();
}, 8000);

/* =========================
   ROTATING QUOTES
========================= */

const quotes = {
  anime: [
    "No matter how deep the night, it always turns to day. — Bleach",
    "People die when they are killed. — Fate/stay night",
    "I'm not a hero because I want your approval. I do it because I want to. — My Hero Academia",
    "The world isn't perfect. But it's there for us, doing the best it can. — Fruits Basket",
    "Whatever you lose, you'll find it again. But what you throw away you'll never get back. — Baccano!"
  ],
  movies: [
    "After all, tomorrow is another day. — Gone with the Wind",
    "Here's looking at you, kid. — Casablanca",
    "May the Force be with you. — Star Wars",
    "I'm going to make him an offer he can't refuse. — The Godfather",
    "You can't handle the truth! — A Few Good Men"
  ],
  kdrama: [
    "Fate is like a strange restaurant. — Crash Landing on You",
    "Love is not about timing. It's about the right person. — Lovestruck in the City",
    "Don't regret the past. Just learn from it. — Reply 1988",
    "Sometimes the wrong choices bring us to the right places. — Itaewon Class",
    "Being strong means having the courage to show weakness. — Hospital Playlist"
  ]
};

let currentQuoteIndex = 0;
const allQuotes = [...quotes.anime, ...quotes.movies, ...quotes.kdrama];

function rotateQuote() {
  const quoteText = document.getElementById("quote-text");
  if (!quoteText) return;

  quoteText.style.opacity = "0";
  quoteText.style.transition = "opacity 0.5s ease";

  setTimeout(() => {
    quoteText.textContent = `"${allQuotes[currentQuoteIndex]}"`;
    quoteText.style.opacity = "1";
  }, 500);

  currentQuoteIndex = (currentQuoteIndex + 1) % allQuotes.length;
}

setInterval(rotateQuote, 10000);

/* =========================
   ATMOSPHERIC EFFECTS
========================= */

const atmosphericEffects = document.getElementById("atmospheric-effects");

function createRain() {
  atmosphericEffects.innerHTML = "";
  for (let i = 0; i < 100; i++) {
    const drop = document.createElement("div");
    drop.className = "rain-drop";
    drop.style.left = Math.random() * 100 + "%";
    drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + "s";
    drop.style.animationDelay = Math.random() * 2 + "s";
    atmosphericEffects.appendChild(drop);
  }
}

function createSnow() {
  atmosphericEffects.innerHTML = "";
  for (let i = 0; i < 50; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    flake.style.left = Math.random() * 100 + "%";
    flake.style.animationDuration = (Math.random() * 3 + 2) + "s";
    flake.style.animationDelay = Math.random() * 5 + "s";
    flake.style.width = (Math.random() * 6 + 4) + "px";
    flake.style.height = flake.style.width;
    atmosphericEffects.appendChild(flake);
  }
}

function createSakura() {
  atmosphericEffects.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const petal = document.createElement("div");
    petal.className = "sakura-petal";
    petal.style.left = Math.random() * 100 + "%";
    petal.style.animationDuration = (Math.random() * 5 + 5) + "s";
    petal.style.animationDelay = Math.random() * 10 + "s";
    petal.style.width = (Math.random() * 8 + 6) + "px";
    petal.style.height = petal.style.width;
    atmosphericEffects.appendChild(petal);
  }
}

function setAtmosphericEffect(effect) {
  atmosphericEffects.classList.remove("active");
  atmosphericEffects.innerHTML = "";

  if (effect === "rain") {
    createRain();
    atmosphericEffects.classList.add("active");
  } else if (effect === "snow") {
    createSnow();
    atmosphericEffects.classList.add("active");
  } else if (effect === "sakura") {
    createSakura();
    atmosphericEffects.classList.add("active");
  }
}

const savedTheme = localStorage.getItem("mediavault-theme");
if (savedTheme === "animeNight") {
  setTimeout(() => setAtmosphericEffect("sakura"), 1000);
}

/* =========================
   THEME DROPDOWN TOGGLE
========================= */

document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  const themeDropdown = document.getElementById("theme-dropdown");
  const themeOptions = document.querySelectorAll(".theme-option");

  if (themeToggle && themeDropdown) {
    themeToggle.addEventListener("click", (e) => {
      e.preventDefault();
      themeDropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!themeDropdown.contains(e.target) && e.target !== themeToggle) {
        themeDropdown.classList.remove("active");
      }
    });

    themeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const themeKey = option.dataset.theme;
        setTheme(themeKey);
        themeDropdown.classList.remove("active");
      });
    });
  }
});

/* =========================
   COMMAND PALETTE
========================= */

const commandPalette = document.getElementById("command-palette");
const commandInput = document.getElementById("command-input");
const commandItems = document.querySelectorAll(".command-item");
let selectedIndex = 0;

function openCommandPalette() {
  commandPalette.classList.add("active");
  commandInput.value = "";
  selectedIndex = 0;
  updateSelectedCommand();
  commandInput.focus();
}

function closeCommandPalette() {
  commandPalette.classList.remove("active");
}

function updateSelectedCommand() {
  commandItems.forEach((item, index) => {
    item.classList.toggle("selected", index === selectedIndex);
  });
}

function executeCommand(command) {
  closeCommandPalette();

  switch (command) {
    case "/watching":
      document.getElementById("continue-watching")?.scrollIntoView({
        behavior: "smooth"
      });
      break;
    case "/stats":
      window.location.href = "/stats.html";
      break;
    case "/library":
      document.getElementById("anime-list")?.scrollIntoView({
        behavior: "smooth"
      });
      break;
    case "/random":
      if (allAnime.length) {
        const random = allAnime[Math.floor(Math.random() * allAnime.length)];
        if (random.url) {
          window.open(random.url, "_blank");
        }
      }
      break;
    case "/theme":
      const themeKeys = Object.keys(themes);
      const currentTheme = localStorage.getItem("mediavault-theme") || "animeNight";
      const currentIndex = themeKeys.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % themeKeys.length;
      setTheme(themeKeys[nextIndex]);
      break;
    case "/settings":
      document.getElementById("theme-toggle")?.click();
      break;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !commandPalette.classList.contains("active")) {
    e.preventDefault();
    openCommandPalette();
  }

  if (commandPalette.classList.contains("active")) {
    if (e.key === "Escape") {
      closeCommandPalette();
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % commandItems.length;
      updateSelectedCommand();
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + commandItems.length) % commandItems.length;
      updateSelectedCommand();
    }

    if (e.key === "Enter") {
      const selectedCommand = commandItems[selectedIndex].dataset.command;
      executeCommand(selectedCommand);
    }
  }
});

commandItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    executeCommand(item.dataset.command);
  });
});

commandPalette.addEventListener("click", (e) => {
  if (e.target === commandPalette) {
    closeCommandPalette();
  }
});

/* =========================
   WIDGET MICRO-ANIMATIONS
========================= */

// Streak counter update (animated on load)
const streakEl = document.getElementById("current-streak");
if (streakEl) {
  let streak = parseInt(localStorage.getItem("mediavault-streak") || "0");
  if (streak === 0) {
    streak = Math.floor(Math.random() * 7) + 3; // demo: 3-9 days
  }
  const target = streak;
  let current = 0;
  const interval = setInterval(() => {
    current++;
    streakEl.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 80);
}

// Goal bar
const goalFill = document.getElementById("goal-bar-fill");
const goalText = document.getElementById("watch-goal");
if (goalFill && goalText) {
  const watched = allAnime.length;
  const goal = 100;
  const pct = Math.min((watched / goal) * 100, 100);
  setTimeout(() => {
    goalFill.style.width = pct + "%";
  }, 500);
  if (goalText) {
    goalText.textContent = `${watched} / ${goal} episodes`;
  }
}
