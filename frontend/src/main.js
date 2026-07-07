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
const heroDotsContainer = document.getElementById("hero-dots");

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

// mm:ss style timecode, like a film counter
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
  console.log("History Updated!");

  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(loadAnime, 500);
});

searchInput.addEventListener("input", async () => {
  const search = searchInput.value.toLowerCase();

  const filteredData = allAnime.filter(anime =>
    anime.animeTitle.toLowerCase().includes(search)
  );

  await renderAnime(filteredData);
});

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

    if (filter === "All") {
      await renderAnime(allAnime);
      return;
    }

    const filtered = allAnime.filter(
      anime => (anime.type || "Anime") === filter
    );

    await renderAnime(filtered);
  });
});

/* =========================
   HERO CAROUSEL + DOTS
========================= */

const slides = document.querySelectorAll(".hero-slide");
let currentSlide = 0;
let heroInterval;

function goToSlide(index) {
  slides[currentSlide].classList.remove("active");
  currentSlide = index;
  slides[currentSlide].classList.add("active");

  if (heroDotsContainer) {
    heroDotsContainer
      .querySelectorAll(".hero-dot")
      .forEach((dot, i) => dot.classList.toggle("active", i === currentSlide));
  }
}

function startHeroRotation() {
  heroInterval = setInterval(() => {
    goToSlide((currentSlide + 1) % slides.length);
  }, 5000);
}

if (heroDotsContainer && slides.length) {
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "hero-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => {
      clearInterval(heroInterval);
      goToSlide(i);
      startHeroRotation();
    });
    heroDotsContainer.appendChild(dot);
  });
}

startHeroRotation();
document
  .querySelectorAll(
    ".terminal-grid button"
  )
  .forEach(button => {

    button.onclick = () => {

      const command =
        button.textContent;

      if (command === "/watching") {
        document
          .getElementById(
            "continue-watching"
          )
          ?.scrollIntoView({
            behavior: "smooth"
          });
      }

      if (command === "/stats") {
        window.location.href =
          "/stats.html";
      }

      if (command === "/library") {
        document
          .getElementById(
            "anime-list"
          )
          ?.scrollIntoView({
            behavior: "smooth"
          });
      }

      if (command === "/random") {

        if (!allAnime.length) {
          return;
        }

        const random =
          allAnime[
            Math.floor(
              Math.random() *
              allAnime.length
            )
          ];

        if (random.url) {
          window.open(
            random.url,
            "_blank"
          );
        }
      }
    };
  });

/* =========================
   LIVE CLOCK
========================= */

function updateClock() {
  const now = new Date();

  const clock =
    document.getElementById(
      "clock"
    );

  const date =
    document.getElementById(
      "date"
    );

  if (!clock) return;

  clock.textContent =
    now.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  date.textContent =
    now.toLocaleDateString(
      [],
      {
        weekday: "long",
        month: "long",
        day: "numeric"
      }
    );
}

updateClock();

setInterval(
  updateClock,
  1000
);

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
    bg: "#1E1B4B",
    bg2: "#2D2563",
    primary: "#8B5CF6",
    secondary: "#F472B6",
    accent: "#F8FAFC",
    text: "#FFFFFF",
    textMuted: "#CBD5E1",
    border: "rgba(255,255,255,.1)",
    wallpaper: "/images/frieren.jpg"
  },
  cinemaMode: {
    name: "Cinema Mode",
    bg: "#0F172A",
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
    primary: "#00FFFF",
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
    wallpaper: "/images/frieren.jpg"
  }
};

function setTheme(themeKey) {
  const theme = themes[themeKey];
  if (!theme) return;

  const heroPanel = document.querySelector(".hero-panel");
  if (heroPanel) {
    heroPanel.style.background = `
      linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.85)),
      url("${theme.wallpaper}")
    `;
    heroPanel.style.backgroundSize = "cover";
    heroPanel.style.backgroundPosition = "center";
  }

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

const featuredContent = {
  anime: [
    {
      title: "Solo Leveling",
      desc: "The weakest hunter becomes humanity's strongest weapon.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "ANIME"
    },
    {
      title: "Frieren",
      desc: "An elven mage's journey through a changing world.",
      wallpaper: "/images/frieren.jpg",
      tag: "ANIME"
    },
    {
      title: "Blue Lock",
      desc: "The ultimate striker project begins.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "ANIME"
    },
    {
      title: "Dan Da Dan",
      desc: "Ghosts, aliens, and high school romance.",
      wallpaper: "/images/frieren.jpg",
      tag: "ANIME"
    },
    {
      title: "Attack on Titan",
      desc: "Humanity fights for survival against the Titans.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "ANIME"
    },
    {
      title: "Your Name",
      desc: "Two strangers connected by a mysterious bond.",
      wallpaper: "/images/frieren.jpg",
      tag: "ANIME"
    }
  ],
  kdrama: [
    {
      title: "Lovely Runner",
      desc: "A time-traveling romance that defies destiny.",
      wallpaper: "/images/frieren.jpg",
      tag: "K-DRAMA"
    },
    {
      title: "Twenty Five Twenty One",
      desc: "Youth, dreams, and first loves in the 90s.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "K-DRAMA"
    },
    {
      title: "Squid Game",
      desc: "A deadly game with a massive prize.",
      wallpaper: "/images/classroom.jpg",
      tag: "K-DRAMA"
    },
    {
      title: "Moving",
      desc: "Superpowered parents protecting their children.",
      wallpaper: "/images/frieren.jpg",
      tag: "K-DRAMA"
    },
    {
      title: "Weak Hero Class 1",
      desc: "A bullied student fights back with strategy.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "K-DRAMA"
    }
  ],
  movies: [
    {
      title: "Interstellar",
      desc: "Love transcends time and space.",
      wallpaper: "/images/classroom.jpg",
      tag: "MOVIE"
    },
    {
      title: "Spider-Verse",
      desc: "Across the Spider-Verse, infinite possibilities.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "MOVIE"
    },
    {
      title: "Dune",
      desc: "A hero's journey across the desert planet.",
      wallpaper: "/images/classroom.jpg",
      tag: "MOVIE"
    },
    {
      title: "The Batman",
      desc: "Gotham's darkest knight rises.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "MOVIE"
    },
    {
      title: "Oppenheimer",
      desc: "The father of the atomic bomb.",
      wallpaper: "/images/classroom.jpg",
      tag: "MOVIE"
    },
    {
      title: "Top Gun Maverick",
      desc: "The need for speed returns.",
      wallpaper: "/images/solo-leveling.jpg",
      tag: "MOVIE"
    }
  ]
};

let currentFeaturedIndex = 0;
let currentCategory = "anime";
const allFeatured = [...featuredContent.anime, ...featuredContent.kdrama, ...featuredContent.movies];

function rotateFeatured() {
  const heroPanel = document.querySelector(".hero-panel");
  const featuredTitle = document.getElementById("featured-title");
  const featuredDesc = document.getElementById("featured-desc");
  const heroTag = document.querySelector(".hero-tag");

  if (!heroPanel || !featuredTitle || !featuredDesc || !heroTag) return;

  const content = allFeatured[currentFeaturedIndex];

  heroPanel.style.opacity = "0";
  heroPanel.style.transition = "opacity 0.5s ease";

  setTimeout(() => {
    featuredTitle.textContent = content.title;
    featuredDesc.textContent = content.desc;
    heroTag.textContent = content.tag;

    heroPanel.style.background = `
      linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.85)),
      url("${content.wallpaper}")
    `;
    heroPanel.style.backgroundSize = "cover";
    heroPanel.style.backgroundPosition = "center";

    heroPanel.style.opacity = "1";
  }, 500);

  currentFeaturedIndex = (currentFeaturedIndex + 1) % allFeatured.length;
}

setInterval(rotateFeatured, 7000);

/* =========================
   ROTATING QUOTES
========================= */

const quotes = {
  anime: [
    "No matter how deep the night, it always turns to day. - Bleach",
    "People die when they are killed. - Fate/stay night",
    "I'm not a hero because I want your approval. I do it because I want to. - My Hero Academia",
    "The world isn't perfect. But it's there for us, doing the best it can. - Fruits Basket",
    "Whatever you lose, you'll find it again. But what you throw away you'll never get back. - Baccano!"
  ],
  movies: [
    "After all, tomorrow is another day. - Gone with the Wind",
    "Here's looking at you, kid. - Casablanca",
    "May the Force be with you. - Star Wars",
    "I'm going to make him an offer he can't refuse. - The Godfather",
    "You can't handle the truth! - A Few Good Men"
  ],
  kdrama: [
    "Fate is like a strange restaurant. - Crash Landing on You",
    "Love is not about timing. It's about the right person. - Lovestruck in the City",
    "Don't regret the past. Just learn from it. - Reply 1988",
    "Sometimes the wrong choices bring us to the right places. - Itaewon Class",
    "Being strong means having the courage to show weakness. - Hospital Playlist"
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

// Auto-enable sakura for Anime Night theme
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

  console.log("Theme toggle:", themeToggle);
  console.log("Theme dropdown:", themeDropdown);
  console.log("Theme options:", themeOptions);

  if (themeToggle && themeDropdown) {
    themeToggle.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Toggle clicked");
      themeDropdown.classList.toggle("active");
      console.log("Dropdown classes:", themeDropdown.className);
      console.log("Dropdown display:", window.getComputedStyle(themeDropdown).display);
    });

    document.addEventListener("click", (e) => {
      if (!themeDropdown.contains(e.target) && e.target !== themeToggle) {
        themeDropdown.classList.remove("active");
      }
    });

    themeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const themeKey = option.dataset.theme;
        console.log("Theme selected:", themeKey);
        setTheme(themeKey);
        themeDropdown.classList.remove("active");
      });
    });
  } else {
    console.error("Theme toggle or dropdown not found!");
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