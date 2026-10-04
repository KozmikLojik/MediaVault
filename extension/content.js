(() => {
  "use strict";

  const host = window.location.hostname.toLowerCase();
  const site = findSupportedSite(host);
  if (!site) return;

  const isTopFrame = window === window.top;
  let pageContext = null;
  let activeVideo = null;
  let lastSavedTime = -1;
  let saveTimer = null;
  const trackedVideos = new WeakSet();
  const frameStates = new WeakMap();

  function readText(selector) {
    if (!selector) return "";
    try {
      return document.querySelector(selector)?.textContent?.trim() || "";
    } catch {
      return "";
    }
  }

  function cleanTitle(value) {
    return String(value || "")
      .replace(/\s*[|—–-]\s*(watch|stream|online|hianime|anidoor|vidnest|crunchyroll|netflix).*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getNetflixDocumentParts() {
    if (site.mediaType !== "Netflix") return [];
    return cleanTitle(document.title).split(/\s+[|—–]\s+/).map((part) => part.trim()).filter(Boolean);
  }

  function getTitle() {
    const netflixPageTitle = site.mediaType === "Netflix"
      ? getNetflixDocumentParts().at(-1)
      : "";
    const candidates = [
      netflixPageTitle,
      readText(site.title),
      readText(".anime-title"),
      readText(".film-name"),
      readText("h1"),
      document.querySelector('meta[property="og:title"]')?.content,
      document.title
    ];

    for (const candidate of candidates) {
      const title = cleanTitle(candidate);
      if (title && !/^(watch|home|anime|video|player|unknown|netflix)$/i.test(title)) {
        return title;
      }
    }
    return "";
  }

  function getEpisode() {
    const candidate =
      readText(site.episode) ||
      readText(".np-title") ||
      readText("[class*='episode-title']") ||
      readText("[data-episode-title]");

    if (candidate && candidate.toLowerCase() !== getTitle().toLowerCase()) return candidate;
    if (site.mediaType === "Netflix") return getNetflixDocumentParts()[0] || "Movie";
    if (site.episode === null) return "Video";
    return site.episodeFallback || "";
  }

  function getMediaType(episode) {
    if (site.mediaType !== "Netflix") return site.mediaType || "Anime";
    return getNetflixDocumentParts().length > 1 || /(?:s\s*\d+\s*[:· -]?\s*e\s*\d+|season\s+\d+|episode\s+\d+)/i.test(episode)
      ? "TV"
      : "Movies";
  }

  function getPageUrl() {
    try {
      return isTopFrame ? window.location.href : window.top.location.href;
    } catch {
      return window.location.href;
    }
  }

  function getContext() {
    const animeTitle = getTitle();
    const episode = getEpisode();
    if (!animeTitle || !episode) return null;
    const safeTitle = animeTitle.slice(0, 250);
    const safeEpisode = episode.slice(0, 160);
    return { animeTitle: safeTitle, episode: safeEpisode, type: getMediaType(safeEpisode), url: getPageUrl() };
  }

  function contextKey(context) {
    return `${context.animeTitle}\n${context.episode}\n${context.url}`;
  }

  function isSupportedOrigin(origin) {
    try {
      return Boolean(findSupportedSite(new URL(origin).hostname.toLowerCase()));
    } catch {
      return false;
    }
  }

  function sendContextToFrame(frame, context) {
    if (!frame?.isConnected || !frame.contentWindow) return;
    let origin;
    try {
      origin = new URL(frame.src || window.location.href, window.location.href).origin;
    } catch {
      return;
    }
    if (!isSupportedOrigin(origin)) return;

    const key = contextKey(context);
    const previousState = frameStates.get(frame);
    if (previousState?.key === key && (
      previousState.acknowledged || Date.now() - previousState.sentAt < 10000
    )) return;

    const state = { key, acknowledged: false, sentAt: Date.now() };
    frameStates.set(frame, state);
    let attempts = 0;
    const send = () => {
      if (!frame.isConnected || frameStates.get(frame) !== state || state.acknowledged) return;
      frame.contentWindow.postMessage({ type: "MEDIAVAULT_METADATA", context }, origin);
      attempts += 1;
      if (attempts < 8) window.setTimeout(send, 900);
    };
    send();
  }

  function sendContextToFrames(context) {
    if (!isTopFrame || !context) return;
    document.querySelectorAll("iframe").forEach((frame) => {
      if (!frame.dataset.mediavaultLoadListener) {
        frame.dataset.mediavaultLoadListener = "true";
        frame.addEventListener("load", () => {
          const current = getContext();
          if (current) {
            frameStates.delete(frame);
            sendContextToFrame(frame, current);
          }
        });
      }
      sendContextToFrame(frame, context);
    });
  }

  window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;

    if (
      isTopFrame &&
      event.data.type === "MEDIAVAULT_METADATA_ACK" &&
      isSupportedOrigin(event.origin)
    ) {
      const frame = [...document.querySelectorAll("iframe")].find(
        (candidate) => candidate.contentWindow === event.source
      );
      if (!frame) return;
      const state = frameStates.get(frame);
      if (state) state.acknowledged = true;
      return;
    }

    if (
      !isTopFrame &&
      event.source === window.parent &&
      isSupportedOrigin(event.origin) &&
      event.data.type === "MEDIAVAULT_METADATA" &&
      event.data.context &&
      typeof event.data.context.animeTitle === "string" &&
      typeof event.data.context.episode === "string" &&
      typeof event.data.context.url === "string"
    ) {
      pageContext = event.data.context;
      window.parent.postMessage({ type: "MEDIAVAULT_METADATA_ACK" }, event.origin);
      if (activeVideo) restoreProgress(activeVideo, pageContext);
      startVideoTracking();
    }
  });

  async function restoreProgress(video, context) {
    try {
      const { animeData } = await chrome.storage.local.get("animeData");
      if (
        !animeData ||
        animeData.url !== context.url ||
        animeData.animeTitle !== context.animeTitle ||
        animeData.episode !== context.episode
      ) return;

      const duration = Number(animeData.duration);
      const savedTime = Number(animeData.currentTime);
      if (!Number.isFinite(savedTime) || savedTime <= 5) return;

      const resume = () => {
        if (video !== activeVideo || video.readyState < 1) return;
        const maxTime = Number.isFinite(duration) && duration > 0
          ? Math.min(duration - 5, video.duration - 5)
          : video.duration - 5;
        if (!Number.isFinite(maxTime) || maxTime <= 0) return;
        try {
          video.currentTime = Math.min(savedTime, maxTime);
          lastSavedTime = video.currentTime;
        } catch {
          // Some streaming players expose a non-seekable video.
        }
      };

      if (video.readyState >= 1) resume();
      else video.addEventListener("loadedmetadata", resume, { once: true });
    } catch (error) {
      console.debug("MediaVault could not restore playback progress", error);
    }
  }

  async function saveProgress(force = false) {
    const video = activeVideo;
    const context = pageContext || (isTopFrame ? getContext() : null);
    if (!video || !context || !context.animeTitle || !context.episode) return;

    const currentTime = Number(video.currentTime);
    if (!Number.isFinite(currentTime) || currentTime <= 0) return;
    if (!force && lastSavedTime >= 0 && Math.abs(currentTime - lastSavedTime) < 15) return;

    lastSavedTime = currentTime;
    const rawDuration = Number(video.duration);
    const data = {
      type: context.type || "Anime",
      animeTitle: context.animeTitle,
      episode: context.episode,
      currentTime,
      duration: Number.isFinite(rawDuration) ? rawDuration : 0,
      url: context.url,
      updatedAt: new Date().toISOString()
    };

    try {
      await chrome.storage.local.set({ animeData: data });
      chrome.runtime.sendMessage({ type: "SAVE_ANIME", data }).catch(() => {});
    } catch (error) {
      console.debug("MediaVault could not save playback progress", error);
    }
  }

  function trackVideo(video) {
    if (trackedVideos.has(video)) return;
    if (activeVideo !== video) lastSavedTime = -1;
    trackedVideos.add(video);
    activeVideo = video;

    const context = pageContext || (isTopFrame ? getContext() : null);
    if (context) {
      pageContext = context;
      restoreProgress(video, context);
    }

    video.addEventListener("pause", () => saveProgress(true));
    video.addEventListener("ended", () => saveProgress(true));
    if (!saveTimer) {
      saveTimer = window.setInterval(() => saveProgress(), 15000);
    }
  }

  function startVideoTracking() {
    const selector = site.video || "video";
    let video = null;
    try {
      video = document.querySelector(selector) || document.querySelector("video");
    } catch {
      video = document.querySelector("video");
    }
    if (video) trackVideo(video);
  }

  if (isTopFrame) {
    const syncContext = () => {
      const context = getContext();
      if (context) {
        const changed = !pageContext || contextKey(pageContext) !== contextKey(context);
        pageContext = context;
        sendContextToFrames(context);
        if (changed && activeVideo) restoreProgress(activeVideo, context);
        if (changed) startVideoTracking();
      }
      startVideoTracking();
    };

    syncContext();
    let syncPending = false;
    const observer = new MutationObserver(() => {
      if (syncPending) return;
      syncPending = true;
      window.setTimeout(() => {
        syncPending = false;
        syncContext();
      }, 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    let lastObservedUrl = window.location.href;
    window.setInterval(() => {
      if (window.location.href === lastObservedUrl) return;
      lastObservedUrl = window.location.href;
      syncContext();
    }, 1500);
  } else {
    startVideoTracking();
  }

  window.addEventListener("pagehide", () => saveProgress(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveProgress(true);
  });
})();
