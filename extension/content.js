console.log("Anime Tracker Loaded");

/*
========================================
GET ANIME TITLE
========================================
*/

function getAnimeTitle() {

  try {

    if (window.top !== window.self) {

      return "Iframe Anime";
    }

    return document.title
      .replace(" — Watch TV Free | AniDoor", "")
      .trim();

  } catch {

    return "Unknown Anime";
  }
}

/*
========================================
GET EPISODE NUMBER
========================================
*/

function getEpisodeNumber() {

  try {

    const ep = document.querySelector(".np-title");

    if (ep) {
      return ep.innerText.trim();
    }

  } catch {}

  return "Unknown Episode";
}

/*
========================================
WAIT FOR VIDEO
========================================
*/

let trackingStarted = false;

if (window.location.hostname.includes("anidoor.me")) {

  const saveAnimeInfo = () => {

    const title = document.title;

    const episode =
      document.querySelector(".np-title")?.innerText;

    if (
      title &&
      !title.includes("Watch Anime — AniDoor") &&
      episode
    ) {

      const animeInfo = {
        animeTitle: title
          .split(" — Watch")[0]
          .trim(),
        episode,
        url: window.location.href
      };

      chrome.storage.local.set({
        currentAnimeInfo: animeInfo
      });

      console.log("ANIME INFO SAVED");
      console.log(animeInfo);

      return true;
    }

    return false;
  };

  const interval = setInterval(() => {

    if (saveAnimeInfo()) {
      clearInterval(interval);
    }

  }, 1000);
}

function waitForVideo() {

  console.log("Waiting for video...");

  const interval = setInterval(() => {

    if (trackingStarted) {
      clearInterval(interval);
      return;
    }

    const video = document.querySelector("video");

    if (video) {

      trackingStarted = true;

      console.log("Video Found");

      clearInterval(interval);

      startTracking(video);
    }

  }, 1000);
}

/*
========================================
TRACK VIDEO
========================================
*/

function startTracking(video) {

  console.log("START TRACKING RUNNING");
  console.log("HOST:", window.location.hostname);

  chrome.storage.local.get(
    ["currentAnimeInfo"],
    (result) => {

      const animeTitle =
        result.currentAnimeInfo?.animeTitle ||
        "Unknown Anime";

      const episode =
        result.currentAnimeInfo?.episode ||
        "Unknown Episode";

      const animeUrl =
        result.currentAnimeInfo?.url ||
        "";

      console.log("Anime:", animeTitle);
      console.log("Episode:", episode);

      let lastSavedTime = 0;

      setInterval(() => {

        const currentTime = video.currentTime;

        const duration = video.duration;

        if (
          Math.abs(
            currentTime - lastSavedTime
          ) < 20
        ) {
          return;
        }

        lastSavedTime = currentTime;

        const data = {
          animeTitle,
          episode,
          currentTime,
          duration,
          url: window.location.href,
          updatedAt: new Date().toISOString()
        };

        chrome.storage.local.set({
          animeData: data
        });

        chrome.runtime.sendMessage({
          type: "SAVE_ANIME",
          data
        });

        console.log(data);

      }, 30000);

    }
  );
}

/*
========================================
START
========================================
*/

waitForVideo();