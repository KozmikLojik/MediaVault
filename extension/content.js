const SITE =
  window.location.hostname;

const isIframe =
  window !== window.top;

console.log("Anime Tracker Loaded");
console.log(
  "MediaVault running on:",
  SITE
);
console.log(
  "Is iframe:",
  isIframe
);

let receivedAnimeTitle = null;
let receivedEpisode = null;

window.addEventListener(
  "message",
  (event) => {

    if (
      event.data.type ===
      "MEDIAVAULT_METADATA"
    ) {

      receivedAnimeTitle =
        event.data.animeTitle;

      receivedEpisode =
        event.data.episode;

      console.log(
        "Received metadata:",
        event.data
      );
    }

  }
);

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

    if (
      document.title &&
      document.title.includes("— Watch")
    ) {
      return document.title
        .split("— Watch")[0]
        .trim();
    }

    const selectors = [
      ".anime-title",
      ".film-name",
      "h1"
    ];

    for (const selector of selectors) {

      const element =
        document.querySelector(selector);

      if (element) {
        return element.innerText.trim();
      }
    }

    return "Unknown Anime";

  } catch {

    return "Unknown Anime";

  }
}

/*
========================================
GET EPISODE NUMBER
========================================
*/

function getEpisode() {

  const element =
    document.querySelector(
      ".np-title"
    );

  if (element) {
    return element.innerText.trim();
  }

  return "Unknown Episode";
}

function getEpisodeNumber() {
  return getEpisode();
}

function getCurrentPageUrl() {

  try {

    return window.location.href || document.URL || "";

  } catch {

    return "";
  }
}

/*
========================================
WAIT FOR VIDEO
========================================
*/

let trackingStarted = false;

if (window.location.hostname.includes("anidoor.me")) {

  function sendMetadataToIframe(
    title,
    episode
  ) {
    const iframe =
      document.querySelector("iframe");

    if (!iframe) return;

    iframe.onload = () => {

      iframe.contentWindow.postMessage(
        {
          type:
            "MEDIAVAULT_METADATA",

          animeTitle: title,

          episode
        },
        "*"
      );

      console.log(
        "Sent metadata:",
        title,
        episode
      );

    };
  }

  const saveAnimeInfo = () => {

    const title =
      receivedAnimeTitle ||
      getAnimeTitle();

    const episode =
      receivedEpisode ||
      getEpisode();

    sendMetadataToIframe(
      title,
      episode
    );

    if (
      title &&
      title !== "Unknown Anime" &&
      title !== "Iframe Anime" &&
      episode &&
      episode !== "Unknown Episode"
    ) {

      const animeInfo = {
        animeTitle: title,
        episode,
        url: getCurrentPageUrl()
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

function getVideoPlayer() {

  const videos =
    document.querySelectorAll(
      "video"
    );

  if (videos.length > 0) {
    return videos[0];
  }

  return null;
}

function waitForVideo() {

  console.log("Waiting for video...");

  const interval = setInterval(() => {

    if (trackingStarted) {
      clearInterval(interval);
      return;
    }

    const video = getVideoPlayer();

    if (video) {

      trackingStarted = true;

      console.log("Video Found");

      clearInterval(interval);

      restoreProgress(video);

      startTracking(video);
    }

  }, 1000);
}

/*
========================================
TRACK VIDEO
========================================
*/

function restoreProgress(video) {

  chrome.storage.local.get(
    ["animeData"],
    (result) => {

      const saved =
        result.animeData;

      if (!saved) {
        return;
      }

      const currentUrl = getCurrentPageUrl();

      const resumeUrl =
        document.referrer &&
        document.referrer.includes(
          "anidoor.me"
        )
          ? document.referrer
          : currentUrl;

      if (saved.url === resumeUrl) {

        video.currentTime =
          saved.currentTime;

        console.log(
          "RESUMED TO:",
          saved.currentTime
        );

      }

    }
  ); 

}

function startSaving(video) {

  chrome.storage.local.get(
    ["currentAnimeInfo"],
    (result) => {

      let animeTitle =
        result.currentAnimeInfo?.animeTitle ||
        receivedAnimeTitle ||
        getAnimeTitle();

      let episode =
        result.currentAnimeInfo?.episode ||
        receivedEpisode ||
        getEpisode();

      if (receivedAnimeTitle) {
        animeTitle =
          receivedAnimeTitle;
      }

      if (receivedEpisode) {
        episode =
          receivedEpisode;
      }

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
          type: "Anime",
          animeTitle,
          episode,
          currentTime,
          duration,
          url: getCurrentPageUrl(),
          updatedAt:
            new Date().toISOString()
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

function startTracking(video) {

  console.log("START TRACKING RUNNING");
  console.log("HOST:", window.location.hostname);

  if (window !== window.top) {

    const wait =
      setInterval(() => {

        if (
          receivedAnimeTitle
        ) {

          clearInterval(
            wait
          );

          startSaving(
            video
          );
        }

      }, 500);

    return;
  }

  startSaving(video);
}

/*
========================================
START
========================================
*/

waitForVideo();