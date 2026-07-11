import { APP_URL, API_URL } from "./config.js";

const authSection =
  document.getElementById(
    "auth-section"
  );

const appSection =
  document.getElementById(
    "app-section"
  );

const title =
  document.getElementById("title");

const episode =
  document.getElementById("episode");

const time =
  document.getElementById("time");

const continueBtn =
  document.getElementById(
    "continue-btn"
  );

function showApp(user) {

  authSection.style.display =
    "none";

  appSection.style.display =
    "block";

  document
    .getElementById(
      "user-greeting"
    )
    .textContent =
      `Hi, ${user.username}`;

  loadAnimeData();

}

function showAuth() {

  authSection.style.display =
    "block";

  appSection.style.display =
    "none";

}

function loadAnimeData() {

  chrome.storage.local.get(
    ["animeData"],
    (result) => {

      const data =
        result.animeData;

      if (!data) {
        return;
      }

      title.textContent =
        data.animeTitle;

      episode.textContent =
        data.episode;

      const minutes =
        Math.floor(
          data.currentTime / 60
        );

      const seconds =
        Math.floor(
          data.currentTime % 60
        );

      time.textContent =
        `${minutes}m ${seconds}s watched`;

      continueBtn.onclick =
        () => {
          chrome.tabs.create({
            url: data.url
          });
        };

    }
  );

}

document
  .getElementById("login-btn")
  .onclick = async () => {

    const email =
      document
        .getElementById("email")
        .value.trim();

    const password =
      document
        .getElementById(
          "password"
        )
        .value;

    const errorEl =
      document.getElementById(
        "auth-error"
      );

    errorEl.textContent = "";

    try {

      const response =
        await fetch(
          `${API_URL}/api/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              email,
              password
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Login failed"
        );
      }

      await chrome.storage.local.set({
        token: data.token,
        user: {
          _id: data._id,
          username:
            data.username,
          email: data.email
        }
      });

      showApp(data);

    } catch (err) {

      errorEl.textContent =
        err.message;

    }

  };  

document
  .getElementById(
    "register-link"
  )
  .onclick = () => {

    chrome.tabs.create({
      url: `${APP_URL}/register.html`
    });

  };

document
  .getElementById(
    "dashboard-btn"
  )
  .onclick = () => {

    chrome.tabs.create({
      url: APP_URL
    });

  };

document
  .getElementById("logout-btn")
  .onclick = async () => {

    await chrome.storage.local.remove(
      ["token", "user"]
    );

    showAuth();

  };

chrome.storage.local.get(
  ["token", "user"],
  (result) => {

    if (result.token && result.user) {
      showApp(result.user);
    } else {
      showAuth();
    }

  }
);
