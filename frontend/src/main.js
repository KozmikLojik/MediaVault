
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
const animeList =
  document.getElementById("anime-list");

const searchInput =
  document.getElementById("search");

const loader =
  document.getElementById(
    "loader"
  );

const errorMessage =
  document.getElementById(
    "error-message"
  );
  
const modal =
  document.getElementById("modal");

const modalBody =
  document.getElementById("modal-body");

const closeModal =
  document.getElementById("close-modal");

const filterButtons =
  document.querySelectorAll(
    ".filter-btn"
  );

let allAnime = [];

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
  
async function getAnimePoster(title) {

  const cachedPoster =
    localStorage.getItem(
      `poster-${title}`
    );

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

    const response = await axios.post(
      "https://graphql.anilist.co",
      {
        query,
        variables: {
          search: title
        }
      }
    );

    const poster =
      response.data.data.Media
        .coverImage.large;

    localStorage.setItem(
      `poster-${title}`,
      poster
    );

    return poster;

  } catch {

    return "https://placehold.co/300x400";

  }

}

async function renderAnime(data) {

  if (data.length === 0) {

    animeList.innerHTML = `
      <div class="empty-state">

        <h2>
          No media found
        </h2>

        <p>
          Start watching something!
        </p>

      </div>
    `;

    return;

  }

  animeList.innerHTML = "";

  for (const anime of data) {

    const poster =
      await getAnimePoster(
        anime.animeTitle
      );

    const card =
      document.createElement("div");

    card.className = "card";

    card.innerHTML = `
      <img
        src="${poster}"
        class="anime-cover"
      >

      <h2>${anime.animeTitle}</h2>

      <p>${anime.episode}</p>

      <p class="last-watched">
        ${formatTimeAgo(anime.updatedAt)}
      </p>

      <p>
        Time:
        ${Math.floor(anime.currentTime / 60)}m
        ${Math.floor(anime.currentTime % 60)}s
      </p>

      <div class="progress-container">
        <div
          class="progress-fill"
          style="
            width:
            ${Math.min(
              ((anime.currentTime || 0) /
                (anime.duration || 1)) * 100,
              100
            )}%;
          "
        ></div>
      </div>

      <p>
        ${Math.floor(
          Math.min(
            ((anime.currentTime || 0) /
              (anime.duration || 1)) * 100,
            100
          )
        )}% watched
      </p>

      <button class="watch-btn">
        ▶ Continue Watching
      </button>
    `;

    animeList.appendChild(card);

    card.addEventListener("click", () => {

      modal.style.display = "flex";

      modalBody.innerHTML = `
        <img
          src="${poster}"
          style="
            width:250px;
            border-radius:12px;
          "
        >

        <h1>
          ${anime.animeTitle}
        </h1>

        <p>
          ${anime.episode}
        </p>

        <p>
          Last Position:
          ${Math.floor(anime.currentTime / 60)}m
          ${Math.floor(anime.currentTime % 60)}s
        </p>
      `;
    });

    const button =
      card.querySelector(".watch-btn");

    button.addEventListener("click", () => {

      if (anime.url) {

        window.location.href =
          anime.url;

      }

    });

  }

}

async function renderContinueWatching() {

  const container =
    document.getElementById(
      "continue-watching"
    );

  container.innerHTML = "";

  const recent =
    allAnime.slice(0, 5);

  for (const anime of recent) {

    const poster =
      await getAnimePoster(
        anime.animeTitle
      );

    const card =
      document.createElement(
        "div"
      );

    card.className =
      "continue-card";

    card.innerHTML = `
      <img
        src="${poster}"
        alt="${anime.animeTitle}"
      />

      <div class="continue-info">
        <h3>${anime.animeTitle}</h3>

        <p>
          ${anime.episode}
        </p>

        <p>
          ${Math.floor(
            Math.min(
              ((anime.currentTime || 0) /
              (anime.duration || 1)) * 100,
              100
            )
          )}% watched
        </p>
      </div>
    `;

    card.onclick =
      () => {
        window.open(
          anime.url,
          "_blank"
        );
      };

    container.appendChild(
      card
    );

  }

}

async function loadAnime() {

  loader.style.display =
    "block";

  errorMessage.style.display =
    "none";

  let data = [];

  try {

    const response =
      await fetchWithAuth(
        `${config.API_URL}/api/progress`
      );

    if (!response.ok) {

      throw new Error(
        "Server Error"
      );

    }

    data = await response.json();

  } catch (error) {

    console.error(error);

    loader.style.display =
      "none";

    errorMessage.style.display =
      "block";

    errorMessage.innerHTML = `
      ❌ Unable to connect
      to MediaVault backend.
      <br><br>
      Start your backend server
      and refresh the page.
    `;

    return;

  }

  allAnime =
    data
      .map(anime => ({
        ...anime,
        type: anime.type || "Anime"
      }))
      .sort(
        (a, b) =>
          new Date(b.updatedAt) -
          new Date(a.updatedAt)
      );

  let filteredData = allAnime;

  const totalAnime = data.length;

  const topAnime =
    [...data]
      .sort(
        (a, b) =>
          b.currentTime -
          a.currentTime
      )[0];

  const totalHours =
    (
      data.reduce(
        (sum, anime) =>
          sum + anime.currentTime,
        0
      ) / 3600
    ).toFixed(1);

  document.getElementById(
    "anime-count"
  ).innerText = totalAnime;

  document.getElementById(
    "hours-watched"
  ).innerText = totalHours;

  document.getElementById(
    "top-anime"
  ).innerText =
    topAnime
      ? topAnime.animeTitle
      : "-";

  await renderAnime(filteredData);

  await renderContinueWatching();

  loader.style.display =
    "none";

}

loadAnime();

let reloadTimeout;

socket.on(
  "history-updated",
  () => {

    console.log(
      "History Updated!"
    );

    clearTimeout(
      reloadTimeout
    );

    reloadTimeout =
      setTimeout(
        loadAnime,
        500
      );

  }
);

searchInput.addEventListener(
  "input",
  async () => {

    const search =
      searchInput.value.toLowerCase();

    const filteredData =
      allAnime.filter(
        anime =>
          anime.animeTitle
            .toLowerCase()
            .includes(search)
      );

    await renderAnime(
      filteredData
    );

  }
);

closeModal.addEventListener(
  "click",
  () => {

    modal.style.display = "none";

  }
);

filterButtons.forEach(button => {

  button.addEventListener(
    "click",
    async () => {

      filterButtons.forEach(btn =>
        btn.classList.remove(
          "active"
        )
      );

      button.classList.add(
        "active"
      );

      const filter =
        button.innerText;

      if (filter === "All") {

        await renderAnime(
          allAnime
        );

        return;
      }

      const filtered =
        allAnime.filter(
          anime =>
            (anime.type || "Anime") ===
            filter
        );

      await renderAnime(
        filtered
      );

    }
  );

});

const slides =
  document.querySelectorAll(
    ".hero-slide"
  );

let currentSlide = 0;

setInterval(() => {

  slides[currentSlide]
    .classList.remove(
      "active"
    );

  currentSlide =
    (currentSlide + 1)
    % slides.length;

  slides[currentSlide]
    .classList.add(
      "active"
    );

}, 5000);