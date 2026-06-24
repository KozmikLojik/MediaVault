
import axios from "axios";

import "./style.css";
const animeList =
  document.getElementById("anime-list");

const searchInput =
  document.getElementById("search");

const featuredAnime =
  document.getElementById("featured-anime");
  
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
  
async function getAnimePoster(title) {

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

    return response.data.data.Media.coverImage.large;

  } catch {

    return "https://placehold.co/300x400";

  }

}

async function renderAnime(data) {

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

      <p>
        Time:
        ${Math.floor(anime.currentTime / 60)}m
        ${Math.floor(anime.currentTime % 60)}s
      </p>

      <div class="progress-bar">

        <div
          class="progress-fill"
          style="
            width:
            ${Math.min(
              anime.currentTime / 1440 * 100,
              100
            )}%;
          "
        ></div>

      </div>

      <p class="progress-text">

        ${Math.min(
          Math.floor(
            anime.currentTime / 1440 * 100
          ),
          100
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

async function loadAnime() {

  const response = await fetch(
    "http://localhost:5000/api/progress"
  );

  const data = await response.json();

  allAnime = data;

  let filteredData = data;

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

  data.sort(
    (a, b) =>
      new Date(b.updatedAt) -
      new Date(a.updatedAt)
  );

  const latest = data[0];

  const featuredPoster =
    await getAnimePoster(
      latest.animeTitle
    );

  featuredAnime.innerHTML = `
<div
  class="featured-card"
  style="
    background-image:
    url('${featuredPoster}');
  "
>

  <div class="featured-info">

    <h2>
      Continue Watching
    </h2>

    <h1>
      ${latest.animeTitle}
    </h1>

    <p>
      ${latest.episode}
    </p>

    <p>
      ${Math.floor(latest.currentTime / 60)}m
      ${Math.floor(latest.currentTime % 60)}s
    </p>

    <button
      id="featured-btn"
      class="watch-btn"
    >
      ▶ Continue Watching
    </button>

  </div>

</div>
`;

  document
    .getElementById("featured-btn")
    .addEventListener("click", () => {

      if (latest.url) {

        window.location.href =
          latest.url;

      }

    });

  await renderAnime(filteredData);

}

loadAnime();

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
    () => {

      filterButtons.forEach(btn =>
        btn.classList.remove("active")
      );

      button.classList.add("active");

      alert(
        `${button.innerText} filter selected`
      );

    }
  );

});