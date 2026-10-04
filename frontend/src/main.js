import axios from "axios";
import { io } from "socket.io-client";

import config from "./config";
import "./style.css";
import "./performance.css";
import "./redesign.css";
import { themes, applyTheme as setTheme, initThemePicker } from "./services/theme.js";
import {
  fetchWithAuth,
  initNavAuth,
  getToken
} from "./services/api";

initNavAuth();
const isPublicPreview = !getToken();

function syncSectionNavigation() {
  const currentHash = window.location.hash || "#home";
  document.querySelectorAll('.nav-links .nav-item[href^="#"]').forEach((link) => {
    const current = link.getAttribute("href") === currentHash;
    link.classList.toggle("active", current);
    if (current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

syncSectionNavigation();
window.addEventListener("hashchange", syncSectionNavigation);

const socket = getToken() ? io(config.API_URL, { auth: { token: getToken() } }) : null;

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
const bookmarkButton = document.getElementById("bookmark-btn");
const trailerButton = document.getElementById("trailer-btn");
const quickCards = document.querySelectorAll(".quick-card");
const navbar = document.querySelector(".navbar");
const weatherIcon = document.querySelector(".weather-icon");
const weatherTemp = document.querySelector(".weather-temp");
const weatherDesc = document.querySelector(".weather-desc");
const statusText = document.getElementById("system-status");
const storageText = document.getElementById("storage-used");
const activityText = document.getElementById("recent-activity");
const mediaFormDialog = document.getElementById("media-form-dialog");
const mediaForm = document.getElementById("media-form");
const mediaFormError = document.getElementById("media-form-error");
let editingMediaId = null;
let activeTypeFilter = "All";
let modalOpener = null;

let allAnime = [];
let searchDebounceTimer = null;
let animeLoadPromise = null;
let animeReloadRequested = false;
const animeDetailsCache = new Map();
let scrollRafId = null;
let heroParallaxFrame = null;
let heroParallaxX = 0;
let heroParallaxY = 0;
let featuredRotationTimer = null;
let quoteRotationTimer = null;
let clockTimer = null;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const isLowEndDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const shouldReduceMotion = reducedMotionQuery.matches || isLowEndDevice;
let revealObserver = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function openMediaEditor(media = null) {
  if (isPublicPreview) {
    window.location.href = "/register.html";
    return;
  }
  if (!mediaFormDialog || !mediaForm) return;
  editingMediaId = media?._id || null;
  document.getElementById("media-form-title").textContent = media ? "Edit title" : "Add a title";
  document.getElementById("media-form-submit").textContent = media ? "Save changes" : "Save title";
  document.getElementById("media-title").value = media?.animeTitle || "";
  document.getElementById("media-type").value = media?.type || "Anime";
  document.getElementById("media-episode").value = media?.episode || "Episode 1";
  document.getElementById("media-current-time").value = media?.currentTime || 0;
  document.getElementById("media-duration").value = media?.duration || 0;
  document.getElementById("media-url").value = media?.url || "";
  document.getElementById("media-status").value = media?.status || "Watching";
  document.getElementById("media-rating").value = media?.rating ?? "";
  document.getElementById("media-genres").value = (media?.genres || []).join(", ");
  document.getElementById("media-year").value = media?.releaseYear || "";
  document.getElementById("media-format").value = media?.format || "";
  document.getElementById("media-synopsis").value = media?.synopsis || "";
  document.getElementById("media-notes").value = media?.notes || "";
  document.getElementById("media-favorite").checked = Boolean(media?.favorite);
  mediaFormError.textContent = "";
  mediaFormDialog.showModal();
  document.getElementById("media-title").focus();
}

function enablePosterFallback(container) {
  container.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = "/poster-fallback.svg";
    }, { once: true });
  });
}

function initRevealObserver() {
  if (revealObserver || shouldReduceMotion) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
    return;
  }

  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
    return;
  }

  revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: "90px 0px 90px 0px",
    threshold: 0.12
  });

  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
}

function observeRevealElement(element) {
  if (!element) return;
  element.classList.add("reveal");
  if (shouldReduceMotion) {
    element.classList.add("is-visible");
    return;
  }
  if (revealObserver) {
    revealObserver.observe(element);
  }
}

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

async function getAnimeDetails(title) {
  const cacheKey = String(title || "").trim();
  if (animeDetailsCache.has(cacheKey)) {
    return animeDetailsCache.get(cacheKey);
  }

  const detailsPromise = loadAnimeDetails(cacheKey);
  animeDetailsCache.set(cacheKey, detailsPromise);
  return detailsPromise;
}

async function loadAnimeDetails(title) {
  let cachedDetails = null;
  try {
    cachedDetails = localStorage.getItem(`details-${title}`);
  } catch {
    // Storage can be unavailable in private browsing; the in-memory cache still works.
  }
  if (cachedDetails) {
    try {
      const parsed = JSON.parse(cachedDetails);
      if (parsed?.providerId) return parsed;
    } catch (e) {
      // ignore cache parse error
    }
  }

  let cachedPoster = null;
  try {
    cachedPoster = localStorage.getItem(`poster-${title}`);
  } catch {
    // Use the built-in fallback when persistent storage is unavailable.
  }
  const fallback = {
    poster: cachedPoster || "/poster-fallback.svg",
    genres: ["Action", "Fantasy"]
  };

  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          seasonYear
          format
          description(asHtml: false)
          coverImage {
            large
          }
          genres
        }
      }
    `;

    const response = await axios.post("https://graphql.anilist.co", {
      query,
      variables: { search: title }
    });

    const media = response.data?.data?.Media;
    const details = {
      poster: media?.coverImage?.large || fallback.poster,
      genres: media?.genres || fallback.genres,
      provider: "anilist",
      providerId: media?.id ? String(media.id) : "",
      releaseYear: media?.seasonYear || null,
      format: media?.format || "",
      synopsis: media?.description || ""
    };

    try {
      localStorage.setItem(`details-${title}`, JSON.stringify(details));
      localStorage.setItem(`poster-${title}`, details.poster);
    } catch {
      // Avoid failing the dashboard if the browser has disabled or filled storage.
    }

    return details;
  } catch (error) {
    return fallback;
  }
}

async function getAnimePoster(title) {
  const details = await getAnimeDetails(title);
  return details.poster;
}

function getEpisodeNumber(episodeStr) {
  if (!episodeStr) return 0;
  const epMatch = episodeStr.match(/EP\s*(\d+)/i);
  if (epMatch) {
    return parseInt(epMatch[1], 10);
  }
  const numMatch = episodeStr.match(/\d+/);
  if (numMatch) {
    return parseInt(numMatch[0], 10);
  }
  return 1;
}

function calculateCurrentStreak(data) {
  if (!data || !data.length) return 0;
  const dates = [...new Set(
    data
      .filter(anime => anime.updatedAt)
      .map(anime => anime.updatedAt.slice(0, 10))
  )].sort((a, b) => new Date(b) - new Date(a));

  if (dates.length === 0) return 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  let current = new Date(dates[0]);

  for (let i = 1; i < dates.length; i++) {
    const nextDate = new Date(dates[i]);
    const diffTime = Math.abs(current - nextDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
      current = nextDate;
    } else if (diffDays > 1) {
      break;
    }
  }
  return streak;
}

async function calculateFavoriteGenre(data) {
  if (!data || !data.length) return "None";
  const genreCounts = {};
  for (const anime of data) {
    const details = anime.genres?.length ? { genres: anime.genres } : await getAnimeDetails(anime.animeTitle);
    if (details && details.genres) {
      details.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }
  }
  let fav = "Fantasy";
  let maxCount = 0;
  let hasGenres = false;
  for (const [genre, count] of Object.entries(genreCounts)) {
    hasGenres = true;
    if (count > maxCount) {
      maxCount = count;
      fav = genre;
    }
  }
  return hasGenres ? fav : "—";
}

function animateCounter(elementId, targetValue, suffix = "", duration = 1000) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const startValue = 0;
  const isFloat = typeof targetValue === "number" && targetValue % 1 !== 0;
  const target = parseFloat(targetValue) || 0;

  if (target === 0) {
    element.innerText = "0" + suffix;
    return;
  }

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = progress * (2 - progress);
    const currentValue = startValue + easeProgress * (target - startValue);
    
    if (isFloat) {
      element.innerText = currentValue.toFixed(1) + suffix;
    } else {
      element.innerText = Math.floor(currentValue) + suffix;
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      if (isFloat) {
        element.innerText = target.toFixed(1) + suffix;
      } else {
        element.innerText = target + suffix;
      }
    }
  }

  requestAnimationFrame(update);
}

function animateWeeklyGoal(elementId, currentVal, targetGoal = 10, duration = 1000) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = progress * (2 - progress);
    const current = Math.floor(easeProgress * currentVal);
    element.innerText = `${current} / ${targetGoal}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.innerText = `${currentVal} / ${targetGoal}`;
    }
  }
  requestAnimationFrame(update);
}

async function renderAnime(data) {
  if (data.length === 0) {
    const noMedia = allAnime.length === 0;
    animeList.innerHTML = `
      <div class="empty-state" role="status">
        <h2>${noMedia ? "Your library is ready" : "No titles match"}</h2>
        <p>${noMedia ? "Add a title to start your collection, or sync progress from the browser extension." : "Try another search or choose a different filter."}</p>
        ${noMedia ? '<button class="library-add-button" type="button" data-action="add-media">+ Add a title</button>' : '<button class="library-add-button" type="button" data-action="clear-library-filters">Clear filters</button>'}
      </div>
    `;
    animeList.querySelector('[data-action="add-media"]')?.addEventListener("click", () => openMediaEditor());
    animeList.querySelector('[data-action="clear-library-filters"]')?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      activeTypeFilter = "All";
      filterButtons.forEach((button) => {
        const active = button.textContent.trim() === "All";
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      refreshLibraryResults();
    });
    return;
  }

  const detailsResults = await Promise.all(data.map(async (anime) => {
    if (isPublicPreview) {
      const featured = featuredMedia.find((item) => item.title === anime.animeTitle);
      return { anime, details: { poster: featured?.poster || "", genres: featured?.genres || [], featured } };
    }
    return { anime, details: { ...(await getAnimeDetails(anime.animeTitle)), ...(anime.genres?.length ? { genres: anime.genres } : {}) } };
  }));

  const fragment = document.createDocumentFragment();

  detailsResults.forEach(({ anime, details }) => {
    const poster = details.poster;
    const pct = getPercentWatched(anime);
    const runtimeStr = formatTimecode(anime.duration);

    const card = document.createElement("div");
    if (isPublicPreview) {
      const featured = details.featured || {};
      const category = featured.category === "Movie" ? "Film" : featured.category || anime.type;
      const score = featured.imdb ? `IMDb ${featured.imdb}` : "Curated pick";
      card.className = "preview-library-card reveal";
      card.dataset.category = category.toLowerCase().replace(/[^a-z]+/g, "-");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Explore ${anime.animeTitle}`);
      card.innerHTML = `
        <div class="preview-poster-art">
          <span class="preview-poster-fallback" aria-hidden="true">${escapeHtml(category)}</span>
          ${poster ? `<img src="${escapeHtml(poster)}" class="preview-poster-image" alt="${escapeHtml(anime.animeTitle)} poster" loading="lazy" decoding="async">` : ""}
          <span class="preview-category-pill">${escapeHtml(category)}</span>
          <span class="preview-view-hint">View details <span aria-hidden="true">↗</span></span>
        </div>
        <div class="preview-card-content">
          <p class="preview-card-genres">${escapeHtml((featured.genres || []).slice(0, 3).join(" · "))}</p>
          <h3>${escapeHtml(anime.animeTitle)}</h3>
          <p class="preview-card-description">${escapeHtml(featured.desc || "Discover this curated pick in MediaVault.")}</p>
          <div class="preview-card-footer"><span>✦ ${escapeHtml(score)}</span><span>Explore title</span></div>
        </div>
      `;
      const posterImage = card.querySelector(".preview-poster-image");
      posterImage?.addEventListener("error", () => {
        posterImage.remove();
        card.querySelector(".preview-poster-art")?.classList.add("poster-missing");
      }, { once: true });
      card.addEventListener("click", () => {
        modalOpener = document.activeElement;
        modal.style.display = "flex";
        modalBody.innerHTML = `
          <div class="preview-detail">
            ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(anime.animeTitle)} poster" loading="lazy">` : ""}
            <div class="preview-detail-copy"><p class="preview-card-genres">${escapeHtml(category)}${featured.genres?.length ? ` · ${escapeHtml(featured.genres.join(" · "))}` : ""}</p>
              <h2>${escapeHtml(anime.animeTitle)}</h2><p>${escapeHtml(featured.desc || "Discover this curated pick in MediaVault.")}</p>
              <p class="preview-detail-rating">★ ${escapeHtml(featured.rating || "—")} <span>${escapeHtml(score)}</span></p>
              <a class="library-add-button" href="/register.html">Create an account to track it</a>
            </div>
          </div>`;
        const detailImage = modalBody.querySelector("img");
        detailImage?.addEventListener("error", () => detailImage.remove(), { once: true });
        closeModal.focus();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          card.click();
        }
      });
      observeRevealElement(card);
      fragment.appendChild(card);
      return;
    }
    card.className = "history-card reveal";
    card.innerHTML = `
      <div class="history-card-media">
        <img src="${escapeHtml(poster)}" class="anime-cover" alt="${escapeHtml(anime.animeTitle)} poster" loading="lazy" decoding="async">
        <span class="history-card-badge">${isPublicPreview ? "PREVIEW" : `${pct}% watched`}</span>
        <div class="history-card-overlay"></div>
        ${isPublicPreview ? "" : `<button class="history-resume-btn" aria-label="Resume">
          <span>▶</span>
        </button>`}
        ${isPublicPreview ? "" : `<div class="history-card-context">
          <button class="history-card-context-btn" aria-label="More Options">⋮</button>
        </div>`}
      </div>

      <div class="history-card-body">
        <h3>${escapeHtml(anime.animeTitle)}</h3>
        <p class="history-card-meta">${escapeHtml(isPublicPreview ? "Sample title · preview only" : anime.episode)}</p>
        ${isPublicPreview ? "" : `<div class="library-card-tags"><span>${escapeHtml(anime.status || "Watching")}</span>${anime.rating !== null && anime.rating !== undefined ? `<span>★ ${escapeHtml(anime.rating)}/10</span>` : ""}${anime.favorite ? "<span>♥ Favorite</span>" : ""}</div>`}
        ${isPublicPreview ? "" : `<div class="history-card-progress">
          <div class="progress-container">
            <div class="progress-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="continue-pct">${pct}%</span>
        </div>`}
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
          <span>${isPublicPreview ? "Demo title" : `Runtime: ${runtimeStr}`}</span>
          <span>${formatTimeAgo(anime.updatedAt)}</span>
        </div>
      </div>
    `;
    enablePosterFallback(card);

    card.addEventListener("click", () => {
      modalOpener = document.activeElement;
      modal.style.display = "flex";
      modalBody.innerHTML = `
        <div class="modal-detail-wrapper" style="display: flex; gap: 20px;">
          <img src="${escapeHtml(poster)}" alt="${escapeHtml(anime.animeTitle)} poster" style="width: 150px; border-radius: 12px; object-fit: cover;" loading="lazy" decoding="async">
          <div>
            <h1 style="font-family: var(--font-display); font-size: 28px; margin-bottom: 10px; color: var(--text);">${escapeHtml(anime.animeTitle)}</h1>
            <p style="font-family: var(--font-mono); color: var(--primary); margin-bottom: 8px;">${escapeHtml(anime.episode)}</p>
            <p style="font-size: 14px; margin-bottom: 8px; color: var(--text-muted);">Last Position: ${formatTimecode(anime.currentTime)} / ${formatTimecode(anime.duration)}</p>
            <div class="progress-container" style="height: 6px; margin: 12px 0;">
              <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, var(--primary), var(--secondary));"></div>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
              ${details.genres.map(g => `<span class="genre-chip" style="font-size: 11px; padding: 4px 8px;">${escapeHtml(g)}</span>`).join("")}
            </div>
          </div>
        </div>
      `;
      enablePosterFallback(modalBody);
      closeModal.focus();
    });

    observeRevealElement(card);

    const resumeBtn = card.querySelector(".history-resume-btn");
    resumeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (anime.url) {
        window.open(anime.url, "_blank");
      }
    });

    const contextBtn = card.querySelector(".history-card-context-btn");
    contextBtn?.addEventListener("click", (e) => {
      e.stopPropagation();

      document.querySelectorAll(".context-dropdown-menu").forEach(el => el.remove());

      const dropdown = document.createElement("div");
      dropdown.className = "context-dropdown-menu glass-widget";
      dropdown.style.position = "absolute";
      dropdown.style.top = `${Math.max(12, Math.min(e.clientY, window.innerHeight - 190)) + window.scrollY}px`;
      dropdown.style.left = `${Math.max(12, Math.min(e.clientX, window.innerWidth - 190)) + window.scrollX}px`;
      dropdown.style.zIndex = "1000";
      dropdown.style.padding = "8px 0";
      dropdown.style.borderRadius = "12px";
      dropdown.style.background = "rgba(12, 14, 28, 0.95)";
      dropdown.style.border = "1px solid rgba(255, 255, 255, 0.1)";
      dropdown.style.boxShadow = "0 10px 30px rgba(0,0,0,0.6)";
      dropdown.style.backdropFilter = "blur(16px)";
      dropdown.style.minWidth = "160px";

      dropdown.setAttribute("role", "group");
      dropdown.setAttribute("aria-label", `Actions for ${anime.animeTitle}`);
      dropdown.innerHTML = `
        <button class="context-item" type="button" style="padding: 10px 16px; transition: background 0.2s; font-size: 13px;" data-action="resume">▶ Resume watch</button>
        <button class="context-item" type="button" style="padding: 10px 16px; transition: background 0.2s; font-size: 13px;" data-action="details">ℹ Show details</button>
        <button class="context-item" type="button" style="padding: 10px 16px; transition: background 0.2s; font-size: 13px;" data-action="edit">✎ Edit title</button>
        <button class="context-item" type="button" style="padding: 10px 16px; transition: background 0.2s; font-size: 13px;" data-action="delete">⌫ Remove title</button>
        <button class="context-item" type="button" style="padding: 10px 16px; transition: background 0.2s; font-size: 13px;" data-action="copy">🔗 Copy watch link</button>
      `;
      document.body.appendChild(dropdown);
      dropdown.querySelector("button")?.focus();

      const closeMenu = () => {
        dropdown.remove();
        document.removeEventListener("click", closeMenu);
        document.removeEventListener("keydown", onMenuKeydown);
        if (card.isConnected) contextBtn.focus();
      };
      const onMenuKeydown = (keyEvent) => {
        if (keyEvent.key === "Escape") closeMenu();
      };
      document.addEventListener("keydown", onMenuKeydown);

      dropdown.addEventListener("click", (itemEvent) => {
        itemEvent.stopPropagation();
        const action = itemEvent.target.dataset.action;
        if (action === "resume") {
          if (anime.url) window.open(anime.url, "_blank");
        } else if (action === "details") {
          card.click();
        } else if (action === "edit") {
          openMediaEditor(anime);
        } else if (action === "delete") {
          removeMedia(anime);
        } else if (action === "copy") {
          if (anime.url) {
            navigator.clipboard.writeText(anime.url).then(() => {
              alert("Watch link copied to clipboard!");
            });
          }
        }
        closeMenu();
      });

      setTimeout(() => document.addEventListener("click", closeMenu), 10);
    });

    fragment.appendChild(card);
  });

  requestAnimationFrame(() => {
    animeList.replaceChildren(fragment);
  });
}

async function renderContinueWatching() {
  const container = document.getElementById("continue-watching");
  if (!container) return;

  const recent = allAnime.slice(0, 10);
  const detailsResults = await Promise.all(recent.map(async (anime) => {
    if (isPublicPreview) {
      const item = featuredMedia.find((featured) => featured.title === anime.animeTitle);
      return { anime, details: { poster: item?.poster || "/poster-fallback.svg" } };
    }
    return { anime, details: await getAnimeDetails(anime.animeTitle) };
  }));

  const fragment = document.createDocumentFragment();

  detailsResults.forEach(({ anime, details }) => {
    const poster = details.poster;
    const pct = getPercentWatched(anime);
    const runtimeStr = formatTimecode(anime.duration);

    const card = document.createElement("div");
    card.className = "continue-card";

    card.innerHTML = `
      <div class="continue-media">
        <img src="${escapeHtml(poster)}" alt="${escapeHtml(anime.animeTitle)} poster" loading="lazy" decoding="async" />
        <span class="continue-badge-ep">${escapeHtml(anime.episode)}</span>
        <div class="continue-play-overlay">
          <div class="play-btn-circle">▶</div>
        </div>
      </div>

      <div class="continue-info">
        <h3>${escapeHtml(anime.animeTitle)}</h3>
        <p class="continue-meta">Runtime: ${runtimeStr}</p>

        <div class="continue-progress-row">
          <div class="progress-container">
            <div class="progress-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="continue-pct">${pct}%</span>
        </div>
        ${isPublicPreview ? '<a class="resume-btn" href="/register.html">Sign in to track</a>' : '<button class="resume-btn">▶ Resume</button>'}
      </div>
    `;
    enablePosterFallback(card);

    const resumeAction = (e) => {
      e.stopPropagation();
      if (anime.url) {
        window.open(anime.url, "_blank");
      }
    };

    card.addEventListener("click", resumeAction);
    const resumeBtn = card.querySelector(".resume-btn");
    if (resumeBtn && !isPublicPreview) {
      resumeBtn.addEventListener("click", resumeAction);
    }

    fragment.appendChild(card);
  });

  requestAnimationFrame(() => {
    container.replaceChildren(fragment);
  });

  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  if (prevBtn && nextBtn && !container.dataset.scrollBound) {
    container.dataset.scrollBound = "true";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      container.scrollBy({ left: -320, behavior: "smooth" });
    });
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      container.scrollBy({ left: 320, behavior: "smooth" });
    });

    container.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
}

async function loadAnime() {
  if (animeLoadPromise) {
    animeReloadRequested = true;
    return animeLoadPromise;
  }

  animeLoadPromise = loadAnimeData();
  try {
    await animeLoadPromise;
  } finally {
    animeLoadPromise = null;
    if (animeReloadRequested) {
      animeReloadRequested = false;
      loadAnime();
    }
  }
}

function getFilteredLibrary() {
  const search = searchInput?.value.trim().toLowerCase() || "";
  const selectedStatus = document.getElementById("status-filter")?.value || "All statuses";
  const filtered = allAnime.filter((anime) => {
    const matchesType = activeTypeFilter === "All" || (anime.type || "Anime") === activeTypeFilter;
    const matchesStatus = selectedStatus === "All statuses" || (anime.status || "Watching") === selectedStatus;
    const matchesSearch = !search ||
      String(anime.animeTitle || "").toLowerCase().includes(search) ||
      String(anime.type || "").toLowerCase().includes(search);
    return matchesType && matchesStatus && matchesSearch;
  });
  const sort = document.getElementById("library-sort")?.value || "updated";
  if (sort === "rating") filtered.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if (sort === "title") filtered.sort((a, b) => a.animeTitle.localeCompare(b.animeTitle));
  return filtered;
}

function refreshLibraryResults() {
  return renderAnime(getFilteredLibrary());
}

async function loadRecommendations() {
  const container = document.getElementById("recommendations-list");
  if (!container) return;
  try {
    const response = await fetchWithAuth(`${config.API_URL}/api/recommendations`);
    if (!response.ok) throw new Error("Recommendations are unavailable.");
    const { recommendations = [] } = await response.json();
    const posterResults = await Promise.all(recommendations.map(async (item) => {
      if (item.type === "Anime") return (await getAnimeDetails(item.title)).poster;
      return featuredMedia.find((featured) => featured.title.toLowerCase() === item.title.toLowerCase() || featured.title.toLowerCase().replace(/^the /, "") === item.title.toLowerCase().replace(/^the /, ""))?.poster || "/poster-fallback.svg";
    }));
    container.innerHTML = recommendations.length ? recommendations.map((item, index) => `
      <article class="recommendation-card">
        <img class="recommendation-poster" src="${escapeHtml(posterResults[index])}" alt="${escapeHtml(item.title)} poster" loading="lazy" decoding="async">
        <div class="recommendation-copy"><span class="recommendation-meta">${escapeHtml(item.type)} · ${escapeHtml(item.year)} · ★ ${escapeHtml(item.rating)}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.reason)}</p><small>${escapeHtml(item.genres.join(" · "))}</small></div>
        <div class="recommendation-actions"><button type="button" data-rec-add="${escapeHtml(item.id)}">Add to plan</button><button type="button" data-rec-hide="${escapeHtml(item.id)}" aria-label="Hide ${escapeHtml(item.title)}">Hide</button></div>
      </article>`).join("") : '<p>We need a little more library activity to find fresh picks.</p>';
    container.querySelectorAll("[data-rec-add]").forEach((button) => button.addEventListener("click", async () => {
      const item = recommendations.find((entry) => entry.id === button.dataset.recAdd);
      if (!item) return;
      try {
        const added = await fetchWithAuth(`${config.API_URL}/api/progress/save`, { method: "POST", body: JSON.stringify({ animeTitle: item.title, type: item.type, episode: item.type === "Movies" ? "Movie" : "Episode 1", status: "Plan to watch", provider: item.id.split(":")[0], providerId: item.id, genres: item.genres, releaseYear: item.year, format: item.type, synopsis: item.synopsis }) });
        if (!added.ok) throw new Error("Could not add this title.");
        await loadAnime();
      } catch (error) { errorMessage.textContent = error.message; errorMessage.style.display = "block"; }
    }));
    enablePosterFallback(container);
    container.querySelectorAll("[data-rec-hide]").forEach((button) => button.addEventListener("click", async () => {
      const response = await fetchWithAuth(`${config.API_URL}/api/recommendations/dismiss`, { method: "POST", body: JSON.stringify({ providerId: button.dataset.recHide }) });
      if (response.ok) loadRecommendations();
    }));
  } catch {
    container.innerHTML = '<p>Recommendations will appear when the API is available.</p>';
  }
}

document.getElementById("refresh-recommendations")?.addEventListener("click", loadRecommendations);

async function removeMedia(media) {
  if (!media?._id || !window.confirm(`Remove “${media.animeTitle}” from your library?`)) return;
  try {
    const response = await fetchWithAuth(`${config.API_URL}/api/progress/${encodeURIComponent(media._id)}`, {
      method: "DELETE"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Could not remove this title.");
    await loadAnime();
  } catch (error) {
    errorMessage.textContent = error.message || "Could not remove this title. Check your connection and try again.";
    errorMessage.style.display = "block";
  }
}

async function loadAnimeData() {
  loader.style.display = "flex";
  errorMessage.style.display = "none";

  let data = [];

  if (isPublicPreview) {
    data = featuredMedia.map((item) => ({
      animeTitle: item.title,
      type: item.category === "Movie" ? "Movies" : item.category,
      episode: item.episodes,
      currentTime: 0,
      duration: 0,
      updatedAt: "",
      status: "Plan to watch",
      genres: item.genres
    }));
  } else {
    try {
      const response = await fetchWithAuth(`${config.API_URL}/api/progress`);
      if (!response.ok) throw new Error("Server Error");
      data = await response.json();
    } catch (error) {
      console.error(error);
      loader.style.display = "none";
      errorMessage.style.display = "block";
      errorMessage.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "MediaVault could not reach the API. Your account data is safe; try again when the service is online.";
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "library-add-button";
      retryButton.textContent = "Try again";
      retryButton.addEventListener("click", loadAnime);
      errorMessage.append(message, retryButton);
      return;
    }
  }

  allAnime = data
    .map(anime => ({ ...anime, type: anime.type || "Anime" }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  refreshWatchHistory();
  await updateFeatured();

  const totalAnime = allAnime.length;
  const totalHours = parseFloat((
    allAnime.reduce((sum, anime) => sum + (anime.currentTime || 0), 0) / 3600
  ).toFixed(1));
  const totalEpisodes = allAnime.reduce((sum, anime) => sum + getEpisodeNumber(anime.episode), 0);
  const currentStreak = calculateCurrentStreak(allAnime);
  const averageCompletion = parseFloat((allAnime.length ? (
    allAnime.reduce((sum, anime) => {
      const duration = anime.duration || 1;
      return sum + Math.min(((anime.currentTime || 0) / duration) * 100, 100);
    }, 0) / allAnime.length
  ) : 0).toFixed(1));

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyGoalVal = allAnime.filter(item => {
    if (!item.updatedAt) return false;
    return new Date(item.updatedAt) >= oneWeekAgo;
  }).length;

  animateCounter("anime-count", totalAnime);
  animateCounter("hours-watched", totalHours);
  animateCounter("total-episodes", totalEpisodes);
  animateCounter("streak-count", currentStreak);
  document.getElementById("current-streak")?.replaceChildren(String(currentStreak));
  animateCounter("completion-pct", averageCompletion, "%");
  animateWeeklyGoal("weekly-goal", weeklyGoalVal, 10);

  const goalFill = document.getElementById("goal-bar-fill");
  const goalText = document.getElementById("watch-goal");
  if (goalFill && goalText) {
    const monthlyGoal = 100;
    goalFill.style.width = `${Math.min((totalEpisodes / monthlyGoal) * 100, 100)}%`;
    goalText.textContent = `${totalEpisodes} / ${monthlyGoal} episodes`;
  }

  const topAnime = [...allAnime].sort((a, b) => b.currentTime - a.currentTime)[0];
  const topAnimeEl = document.getElementById("top-anime");
  if (topAnimeEl) {
    topAnimeEl.innerText = topAnime ? topAnime.animeTitle : "-";
  }

  calculateFavoriteGenre(allAnime).then(fav => {
    const favEl = document.getElementById("fav-genre");
    if (favEl) {
      favEl.innerText = fav;
    }
  });

  await refreshLibraryResults();
  if (!isPublicPreview) await loadRecommendations();
  await renderContinueWatching();

  loader.style.display = "none";
}

let reloadTimeout;

socket?.on("history-updated", () => {
  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(loadAnime, 900);
});

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(refreshLibraryResults, 120);
  });
}

document.getElementById("add-media-btn")?.addEventListener("click", () => openMediaEditor());
document.getElementById("mylist-btn")?.addEventListener("click", () => {
  if (isPublicPreview) window.location.href = "/register.html";
  else document.getElementById("anime-list")?.scrollIntoView({ behavior: "smooth" });
});
document.getElementById("status-filter")?.addEventListener("change", refreshLibraryResults);
document.getElementById("library-sort")?.addEventListener("change", refreshLibraryResults);
document.getElementById("media-form-close")?.addEventListener("click", () => mediaFormDialog.close());
document.getElementById("media-form-cancel")?.addEventListener("click", () => mediaFormDialog.close());
mediaFormDialog?.addEventListener("click", (event) => {
  if (event.target === mediaFormDialog) mediaFormDialog.close();
});

mediaForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  mediaFormError.textContent = "";
  const submitButton = document.getElementById("media-form-submit");
  submitButton.disabled = true;
  submitButton.textContent = "Saving…";

  const payload = {
    animeTitle: document.getElementById("media-title").value.trim(),
    type: document.getElementById("media-type").value,
    episode: document.getElementById("media-episode").value.trim(),
    currentTime: Number(document.getElementById("media-current-time").value),
    duration: Number(document.getElementById("media-duration").value),
    url: document.getElementById("media-url").value.trim(),
    status: document.getElementById("media-status").value,
    rating: document.getElementById("media-rating").value === "" ? null : Number(document.getElementById("media-rating").value),
    genres: document.getElementById("media-genres").value.split(",").map((genre) => genre.trim()).filter(Boolean),
    releaseYear: document.getElementById("media-year").value ? Number(document.getElementById("media-year").value) : null,
    format: document.getElementById("media-format").value.trim(),
    synopsis: document.getElementById("media-synopsis").value.trim(),
    notes: document.getElementById("media-notes").value.trim(),
    favorite: document.getElementById("media-favorite").checked
  };

  try {
    if (payload.type === "Anime") {
      const details = await getAnimeDetails(payload.animeTitle);
      payload.provider = details.provider || "anilist";
      payload.providerId = details.providerId || "";
      if (!payload.genres.length && details.genres) payload.genres = details.genres;
      payload.releaseYear ||= details.releaseYear || null;
      payload.format ||= details.format || "";
      payload.synopsis ||= details.synopsis || "";
    }
    const url = editingMediaId
      ? `${config.API_URL}/api/progress/${encodeURIComponent(editingMediaId)}`
      : `${config.API_URL}/api/progress/save`;
    const response = await fetchWithAuth(url, {
      method: editingMediaId ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Could not save this title.");

    mediaFormDialog.close();
    mediaForm.reset();
    editingMediaId = null;
    await loadAnime();
  } catch (error) {
    mediaFormError.textContent = error.message || "Could not save this title. Check your connection and try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingMediaId ? "Save changes" : "Save title";
  }
});

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
  if (modalOpener?.isConnected) modalOpener.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.style.display === "flex") {
    modal.style.display = "none";
    if (modalOpener?.isConnected) modalOpener.focus();
  }
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.style.display = "none";
    if (modalOpener?.isConnected) modalOpener.focus();
  }
});

filterButtons.forEach(button => {
  button.addEventListener("click", async () => {
    activeTypeFilter = button.innerText.trim();
    filterButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    filterButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn === button)));
    await refreshLibraryResults();
  });
});

quickCards.forEach(card => {
  const filter = card.dataset.filter || card.textContent.trim();
  card.addEventListener("click", async () => {
    activeTypeFilter = filter;
    filterButtons.forEach(btn => btn.classList.remove("active"));
    const activeButton = Array.from(filterButtons).find(btn => btn.innerText === filter);
    if (activeButton) activeButton.classList.add("active");
    filterButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn === activeButton)));
    await refreshLibraryResults();
  });
});

featuredButton?.addEventListener("click", () => {
  document.getElementById("continue-watching")?.scrollIntoView({
    behavior: "smooth"
  });
});

bookmarkButton?.addEventListener("click", () => {
  if (isPublicPreview) {
    window.location.href = "/register.html";
    return;
  }
  bookmarkButton.classList.toggle("is-bookmarked");
  bookmarkButton.setAttribute("aria-pressed", bookmarkButton.classList.contains("is-bookmarked") ? "true" : "false");
});

trailerButton?.addEventListener("click", () => {
  trailerButton.classList.add("is-playing");
  window.setTimeout(() => trailerButton.classList.remove("is-playing"), 320);
});

window.addEventListener("scroll", () => {
  if (!navbar) return;

  if (scrollRafId) return;

  scrollRafId = requestAnimationFrame(() => {
    navbar.classList.toggle("navbar-shrink", window.scrollY > 24);
    scrollRafId = null;
  });
}, { passive: true });

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


/* =========================
   DYNAMIC WALLPAPER SYSTEM
========================= */

const initialSavedTheme = localStorage.getItem("mediavault-theme");
if (initialSavedTheme && themes[initialSavedTheme]) setTheme(initialSavedTheme);
if (isPublicPreview) {
  const banner = document.getElementById("public-preview-banner");
  if (banner) banner.hidden = false;
  const userLabel = document.getElementById("profile-user");
  if (userLabel) userLabel.textContent = "Guest preview";
  const welcome = document.querySelector(".profile-widget h3");
  if (welcome) welcome.textContent = "Welcome";
  const libraryHeading = document.querySelector(".library-heading .section-title");
  if (libraryHeading) libraryHeading.textContent = "Explore the library";
  const libraryKicker = document.querySelector(".library-heading .section-kicker");
  if (libraryKicker) libraryKicker.textContent = "CURATED STARTER SHELF";
  if (libraryHeading && !document.querySelector(".preview-library-intro")) {
    const intro = document.createElement("p");
    intro.className = "preview-library-intro";
    intro.textContent = "A handpicked mix of films, series, anime, and K-dramas. Open any poster to explore it.";
    libraryHeading.after(intro);
  }
  const carouselHeading = document.querySelector("#continue-watching")?.closest(".continue-carousel-wrapper")?.previousElementSibling?.querySelector(".section-title");
  if (carouselHeading) carouselHeading.textContent = "Featured picks";
  const addButton = document.getElementById("add-media-btn");
  if (addButton) addButton.textContent = "Create your library";
  const libraryToolbar = document.querySelector(".library-toolbar");
  if (libraryToolbar) libraryToolbar.hidden = true;
  const recommendationPanel = document.querySelector(".recommendation-panel");
  if (recommendationPanel) recommendationPanel.hidden = true;
}

/* =========================
   ROTATING FEATURED PRESENTATION
========================= */

const featuredMedia = [
  // --- ANIME (Purple accented) ---
  {
    title: "Solo Leveling",
    desc: "The weakest hunter becomes humanity's strongest weapon.",
    category: "Anime",
    wallpaper: "https://image.tmdb.org/t/p/w1280/geCRueV3ElhRTr0xtJuEWJt6dJ1.jpg",
    poster: "https://image.tmdb.org/t/p/w500/geCRueV3ElhRTr0xtJuEWJt6dJ1.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/96RT2A47UdzWlUfvIERFyBsLhL2.jpg",
    poster: "https://image.tmdb.org/t/p/w500/dqZENchTd7lp5zht7BdlqM7RBhD.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/nTvM4mhqNlHIvUkI1gVnW6XP7GG.jpg",
    poster: "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/xu9zaAevzQ5nnrsXN6JcahLnG4i.jpg",
    poster: "https://image.tmdb.org/t/p/w500/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/5P8SmMzSNYikXpxil6BYzJ16611.jpg",
    poster: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/h8gHn0OzBoaefsYseUByqsmEDMY.jpg",
    poster: "https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/bsNm9z2TJfe0WO3RedPGWQ8mG1X.jpg",
    poster: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg",
    poster: "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/hS9VVF5ffTVWNoC9B48QNsZFGy9.jpg",
    poster: "https://image.tmdb.org/t/p/w500/hS9VVF5ffTVWNoC9B48QNsZFGy9.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/AsICtiVtz4icMQQRwDvOzfaTzjK.jpg",
    poster: "https://image.tmdb.org/t/p/w500/AsICtiVtz4icMQQRwDvOzfaTzjK.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/6jdg6tpr9sF5T27KHCegr8iaozE.jpg",
    poster: "https://image.tmdb.org/t/p/w500/6jdg6tpr9sF5T27KHCegr8iaozE.jpg",
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
    wallpaper: "https://image.tmdb.org/t/p/w1280/wRXipR4toIxffb246XYkWJ7ySes.jpg",
    poster: "https://image.tmdb.org/t/p/w500/wRXipR4toIxffb246XYkWJ7ySes.jpg",
    accentColor: "#F97316",
    buttonText: "▶ Resume",
    rating: "8.7",
    imdb: "8.4",
    duration: "20 Episodes",
    episodes: "20 Episodes",
    studio: "tvN",
    status: "completed",
    genres: ["Crime", "Drama", "Comedy"]
  },
  {
    title: "Oppenheimer",
    desc: "The making of the atomic bomb changes the world—and its creator forever.",
    category: "Movie",
    wallpaper: "https://image.tmdb.org/t/p/w1280/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    accentColor: "#c99c68",
    buttonText: "▶ Explore",
    rating: "8.3",
    imdb: "8.3",
    duration: "3h 00m",
    episodes: "3h 00m",
    studio: "Universal Pictures",
    status: "completed",
    genres: ["Biography", "Drama", "History"]
  },
  {
    title: "Peaky Blinders",
    desc: "A razor-sharp family saga of ambition, loyalty, and power in postwar Birmingham.",
    category: "TV",
    wallpaper: "https://image.tmdb.org/t/p/w1280/9ajQxbY28xuFPUoPfNXH2f8Cyi4.jpg",
    poster: "https://image.tmdb.org/t/p/w500/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg",
    accentColor: "#b68b62",
    buttonText: "▶ Start Watching",
    rating: "8.8",
    imdb: "8.7",
    duration: "6 Seasons",
    episodes: "36 Episodes",
    studio: "BBC",
    status: "completed",
    genres: ["Crime", "Drama", "Historical"]
  },
  {
    title: "The Godfather",
    desc: "An intimate, unforgettable portrait of family, loyalty, and the cost of power.",
    category: "Movie",
    wallpaper: "https://image.tmdb.org/t/p/w1280/6xKCYgH16UuwEGAyroLU6p8HLIn.jpg",
    poster: "https://image.tmdb.org/t/p/w500/d4KNaTrltq6bpkFS01pYtyXa09m.jpg",
    accentColor: "#c99c68",
    buttonText: "▶ Explore",
    rating: "9.2",
    imdb: "9.2",
    duration: "2h 55m",
    episodes: "2h 55m",
    studio: "Paramount Pictures",
    status: "completed",
    genres: ["Crime", "Drama"]
  },
  {
    title: "The Shawshank Redemption",
    desc: "A quiet story of friendship and hope that endures against all odds.",
    category: "Movie",
    wallpaper: "https://image.tmdb.org/t/p/w1280/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg",
    poster: "https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg",
    accentColor: "#9caa9b",
    buttonText: "▶ Explore",
    rating: "9.3",
    imdb: "9.3",
    duration: "2h 22m",
    episodes: "2h 22m",
    studio: "Castle Rock",
    status: "completed",
    genres: ["Drama"]
  },
  {
    title: "Dark",
    desc: "Four families uncover a mystery that stretches across generations and time.",
    category: "TV",
    wallpaper: "https://image.tmdb.org/t/p/w1280/1DLjjvSWMYo17B7wuz6YikB96hH.jpg",
    poster: "https://image.tmdb.org/t/p/w500/1DLjjvSWMYo17B7wuz6YikB96hH.jpg",
    accentColor: "#7b9c9c",
    buttonText: "▶ Start Watching",
    rating: "8.7",
    imdb: "8.7",
    duration: "3 Seasons",
    episodes: "26 Episodes",
    studio: "Netflix",
    status: "completed",
    genres: ["Sci-Fi", "Mystery", "Drama"]
  },
  {
    title: "Inception",
    desc: "A team enters layered dreams to plant an idea that could change everything.",
    category: "Movie",
    wallpaper: "https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
    poster: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    accentColor: "#c99c68",
    buttonText: "▶ Explore",
    rating: "8.8",
    imdb: "8.8",
    duration: "2h 28m",
    episodes: "2h 28m",
    studio: "Warner Bros.",
    status: "completed",
    genres: ["Sci-Fi", "Action", "Thriller"]
  },
  {
    title: "Squid Game",
    desc: "Cash-strapped contestants enter childhood games with life-changing stakes.",
    category: "TV",
    wallpaper: "https://image.tmdb.org/t/p/w1280/qZtAf4Z1lazGQoYVXiHOrvLr5lI.jpg",
    poster: "https://image.tmdb.org/t/p/w500/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg",
    accentColor: "#3B82F6",
    buttonText: "▶ Start Watching",
    rating: "8.0",
    imdb: "8.0",
    duration: "3 Seasons",
    episodes: "22 Episodes",
    studio: "Netflix",
    status: "completed",
    genres: ["Thriller", "Drama", "Mystery"]
  },
  {
    title: "Guardian: The Lonely and Great God",
    desc: "An immortal guardian searches for the one person who can end his eternal life.",
    category: "K-Drama",
    wallpaper: "https://image.tmdb.org/t/p/w1280/uoA7xBzCt3XXqL5fMmB8pmYgABJ.jpg",
    poster: "https://image.tmdb.org/t/p/w500/sPkxHNw5BFvuCFGWw825TS7n6X3.jpg",
    accentColor: "#EC4899",
    buttonText: "▶ Explore",
    rating: "8.7",
    imdb: "8.6",
    duration: "16 Episodes",
    episodes: "16 Episodes",
    studio: "tvN",
    status: "completed",
    genres: ["Fantasy", "Romance", "Drama"]
  },
  {
    title: "Attack on Titan",
    desc: "Humanity fights for survival behind walls that hide an impossible truth.",
    category: "Anime",
    wallpaper: "https://image.tmdb.org/t/p/w1280/zVMyvNowgbsBAL6O6esWfRpAcOb.jpg",
    poster: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    accentColor: "#7C5CFF",
    buttonText: "▶ Explore",
    rating: "9.1",
    imdb: "9.1",
    duration: "4 Seasons",
    episodes: "87 Episodes",
    studio: "MAPPA",
    status: "completed",
    genres: ["Action", "Fantasy", "Drama"]
  }
];

let featuredIndex = Math.floor(Math.random() * featuredMedia.length);
let activeBackground = heroBackgroundFront;
let heroHistoryTitles = new Set();
loadAnime();

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
    .map(genre => `<span class="genre-chip">${escapeHtml(genre)}</span>`)
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
  heroPanel.style.setProperty("--hero-accent", item.accentColor);
  heroPanel.style.setProperty("--hero-accent-soft", `${item.accentColor}22`);
  heroPanel.style.setProperty("--hero-accent-strong", `${item.accentColor}66`);
  heroPanel.style.setProperty("--hero-poster-glow", `${item.accentColor}55`);
  heroPanel.style.setProperty("--hero-poster-shadow", `${item.accentColor}33`);
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
    const featuredIndexLabel = document.getElementById("featured-index");
    if (featuredIndexLabel) featuredIndexLabel.textContent = `${String(featuredIndex + 1).padStart(2, "0")} / ${String(featuredMedia.length).padStart(2, "0")}`;
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
  if (!heroBackgroundFront || !heroBackgroundBack || !heroPanel || shouldReduceMotion) return;

  const { left, top, width, height } = heroPanel.getBoundingClientRect();
  heroParallaxX = ((event.clientX - left) / width - 0.5) * 18;
  heroParallaxY = ((event.clientY - top) / height - 0.5) * 14;

  if (heroParallaxFrame) return;

  heroParallaxFrame = requestAnimationFrame(() => {
    heroBackgroundFront.style.transform = `translate3d(${heroParallaxX}px, ${heroParallaxY}px, 0) scale(1.06)`;
    heroBackgroundBack.style.transform = `translate3d(${heroParallaxX * 0.6}px, ${heroParallaxY * 0.6}px, 0) scale(1.05)`;
    heroParallaxFrame = null;
  });
}

function resetHeroParallax() {
  if (!heroBackgroundFront || !heroBackgroundBack || shouldReduceMotion) return;

  if (heroParallaxFrame) {
    cancelAnimationFrame(heroParallaxFrame);
    heroParallaxFrame = null;
  }

  heroBackgroundFront.style.transform = "scale(1.05)";
  heroBackgroundBack.style.transform = "scale(1.05)";
}

heroPanel?.addEventListener("mousemove", handleHeroParallax, { passive: true });
heroPanel?.addEventListener("mouseleave", resetHeroParallax, { passive: true });

function startFeaturedRotation() {
  if (featuredRotationTimer || shouldReduceMotion) return;

  featuredRotationTimer = window.setInterval(async () => {
    featuredIndex = (featuredIndex + 1) % featuredMedia.length;
    await updateFeatured();
  }, 8000);
}

function stopFeaturedRotation() {
  if (featuredRotationTimer) {
    window.clearInterval(featuredRotationTimer);
    featuredRotationTimer = null;
  }
}

function startQuoteRotation() {
  if (quoteRotationTimer || shouldReduceMotion) return;
  quoteRotationTimer = window.setInterval(rotateQuote, 10000);
}

function stopQuoteRotation() {
  if (quoteRotationTimer) {
    window.clearInterval(quoteRotationTimer);
    quoteRotationTimer = null;
  }
}

function startClock() {
  if (clockTimer) return;
  updateClock();
  clockTimer = window.setInterval(updateClock, 60000);
}

function stopClock() {
  if (clockTimer) {
    window.clearInterval(clockTimer);
    clockTimer = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopFeaturedRotation();
    stopQuoteRotation();
    stopClock();
    return;
  }

  startFeaturedRotation();
  startQuoteRotation();
  startClock();
});

updateFeatured();
initRevealObserver();
startFeaturedRotation();
startQuoteRotation();
startClock();

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


/* =========================
   ATMOSPHERIC EFFECTS
========================= */

const atmosphericEffects = document.getElementById("atmospheric-effects");

function createRain() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 100; i++) {
    const drop = document.createElement("div");
    drop.className = "rain-drop";
    drop.style.left = Math.random() * 100 + "%";
    drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + "s";
    drop.style.animationDelay = Math.random() * 2 + "s";
    fragment.appendChild(drop);
  }
  atmosphericEffects.replaceChildren(fragment);
}

function createSnow() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 50; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    flake.style.left = Math.random() * 100 + "%";
    flake.style.animationDuration = (Math.random() * 3 + 2) + "s";
    flake.style.animationDelay = Math.random() * 5 + "s";
    flake.style.width = (Math.random() * 6 + 4) + "px";
    flake.style.height = flake.style.width;
    fragment.appendChild(flake);
  }
  atmosphericEffects.replaceChildren(fragment);
}

function createSakura() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 30; i++) {
    const petal = document.createElement("div");
    petal.className = "sakura-petal";
    petal.style.left = Math.random() * 100 + "%";
    petal.style.animationDuration = (Math.random() * 5 + 5) + "s";
    petal.style.animationDelay = Math.random() * 10 + "s";
    petal.style.width = (Math.random() * 8 + 6) + "px";
    petal.style.height = petal.style.width;
    fragment.appendChild(petal);
  }
  atmosphericEffects.replaceChildren(fragment);
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

initThemePicker();

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
