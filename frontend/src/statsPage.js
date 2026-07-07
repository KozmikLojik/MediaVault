import { io } from "socket.io-client";

import config from "./config";
import "./style.css";
import {
  requireAuth,
  fetchWithAuth,
  initNavAuth
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

const socket = io(config.API_URL);

if (!requireAuth()) {
  throw new Error("Redirecting to login");
}

initNavAuth();

const loader =
  document.getElementById("loader");

const errorMessage =
  document.getElementById("error-message");

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
          ${item[labelKey]}
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
        <td>${item.animeTitle}</td>
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
        <strong>${item.animeTitle}</strong>
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

    errorMessage.innerHTML = `
      ❌ Unable to connect
      to MediaVault backend.
      <br><br>
      Start your backend server
      and refresh the page.
    `;

  }

  loader.style.display = "none";

}

loadStats();

let reloadTimeout;

socket.on(
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
