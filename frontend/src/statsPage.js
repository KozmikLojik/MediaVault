import { io } from "socket.io-client";

import config from "./config";
import "./style.css";
import "./redesign.css";
import "./polish.css";
import { initThemePicker } from "./services/theme.js";
import {
  fetchWithAuth,
  initNavAuth,
  getToken
} from "./services/api";

import {
  calculateTotalHours,
  calculateTopAnime,
  calculateWatchDistribution,
  calculateWeeklyHours,
  calculateCompletedCount,
  calculateAverageCompletion,
  calculateRecentlyWatched,
  calculateLongestStreak
} from "./stats.js";

initNavAuth();
initThemePicker();
const publicPreview = !getToken();
if (publicPreview) {
  const previewBanner = document.getElementById("public-preview-banner");
  if (previewBanner) previewBanner.hidden = false;
  const kicker = document.querySelector(".stats-header .section-kicker");
  if (kicker) kicker.textContent = "PUBLIC PREVIEW · EXAMPLE DATA";
}

const socket = getToken() ? io(config.API_URL, { auth: { token: getToken() } }) : null;

const loader =
  document.getElementById("loader");

const errorMessage =
  document.getElementById("error-message");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatTimeAgo(dateString) {

  if (!dateString) {
    return "Unknown";
  }

  const seconds =
    Math.floor(
      (Date.now() -
        new Date(dateString)) /
        1000
    );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days =
    Math.floor(hours / 24);

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  return new Date(dateString)
    .toLocaleDateString();

}

function renderBarChart(
  containerId,
  items,
  valueKey,
  labelKey
) {

  const container =
    document.getElementById(containerId);

  if (!items.length) {
    container.innerHTML =
      `<p class="stats-empty">No data yet</p>`;
    return;
  }

  const max =
    Math.max(
      ...items.map(item => item[valueKey])
    ) || 1;

  container.innerHTML = items
    .map(item => `
      <div class="stats-bar-row">
        <span class="stats-bar-label">
          ${escapeHtml(item[labelKey])}
        </span>
        <div class="stats-bar-track">
          <div
            class="stats-bar-fill"
            style="width: ${
              (item[valueKey] / max) * 100
            }%"
          ></div>
        </div>
        <span class="stats-bar-value">
          ${item[valueKey]}
        </span>
      </div>
    `)
    .join("");

}

function renderDistributionTable(items) {

  const tbody =
    document.getElementById(
      "distribution-body"
    );

  if (!items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3">
          No data yet
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map(item => `
      <tr>
        <td>${escapeHtml(item.animeTitle)}</td>
        <td>${item.minutes}</td>
        <td>${item.percent}%</td>
      </tr>
    `)
    .join("");

}

function renderRecentList(items) {

  const container =
    document.getElementById(
      "recent-list"
    );

  if (!items.length) {
    container.innerHTML =
      `<p class="stats-empty">No data yet</p>`;
    return;
  }

  container.innerHTML = items
    .map(item => `
      <div class="recent-item">
        <strong>${escapeHtml(item.animeTitle)}</strong>
        <span>${formatTimeAgo(item.updatedAt)}</span>
      </div>
    `)
    .join("");

}

function renderStats(data) {

  const totalHours =
    calculateTotalHours(data);

  const topAnime =
    calculateTopAnime(data);

  const distribution =
    calculateWatchDistribution(data);

  const weekly =
    calculateWeeklyHours(data);

  const completed =
    calculateCompletedCount(data);

  const avgCompletion =
    calculateAverageCompletion(data);

  const recent =
    calculateRecentlyWatched(data);

  const streak =
    calculateLongestStreak(data);

  document.getElementById(
    "total-hours"
  ).innerText =
    totalHours.toFixed(1);

  document.getElementById(
    "completed-count"
  ).innerText = completed;

  document.getElementById(
    "avg-completion"
  ).innerText =
    `${avgCompletion}%`;

  document.getElementById(
    "top-anime-stat"
  ).innerText =
    topAnime
      ? topAnime.animeTitle
      : "-";

  document.getElementById(
    "streak-stat"
  ).innerText =
    `${streak} day${streak === 1 ? "" : "s"}`;

  document.getElementById(
    "total-anime-stat"
  ).innerText = data.length;

  const hoursByAnime =
    distribution.map(item => ({
      animeTitle: item.animeTitle,
      hours: parseFloat(item.hours)
    }));

  renderBarChart(
    "hours-chart",
    hoursByAnime,
    "hours",
    "animeTitle"
  );

  renderDistributionTable(
    distribution
  );

  renderBarChart(
    "weekly-chart",
    weekly,
    "hours",
    "label"
  );

  renderRecentList(recent);

}

async function loadStats() {

  loader.style.display = "block";

  errorMessage.style.display = "none";

  if (publicPreview) {
    const now = new Date();
    const sample = [
      { animeTitle: "Frieren: Beyond Journey's End", episode: "Episode 12", currentTime: 7200, duration: 10000, updatedAt: now.toISOString() },
      { animeTitle: "Interstellar", episode: "Movie", currentTime: 6200, duration: 10140, updatedAt: new Date(now - 86400000).toISOString() },
      { animeTitle: "Breaking Bad", episode: "S2E4", currentTime: 8600, duration: 18000, updatedAt: new Date(now - 2 * 86400000).toISOString() },
      { animeTitle: "Peaky Blinders", episode: "S1E3", currentTime: 5100, duration: 14000, updatedAt: new Date(now - 3 * 86400000).toISOString() }
    ];
    renderStats(sample);
    loader.style.display = "none";
    return;
  }

  try {

    const response =
      await fetchWithAuth(
        `${config.API_URL}/api/progress`
      );

    if (!response.ok) {
      throw new Error("Server Error");
    }

    const data =
      await response.json();

    renderStats(data);

  } catch (error) {

    console.error(error);

    errorMessage.style.display = "block";

    errorMessage.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "MediaVault could not reach the API. Check your connection or try again.";
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "library-add-button";
    retryButton.textContent = "Try again";
    retryButton.addEventListener("click", loadStats);
    errorMessage.append(message, retryButton);

  }

  loader.style.display = "none";

}

loadStats();

let reloadTimeout;

socket?.on(
  "history-updated",
  () => {

    clearTimeout(reloadTimeout);

    reloadTimeout =
      setTimeout(
        loadStats,
        500
      );

  }
);
