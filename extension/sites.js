const SUPPORTED_SITES = Object.freeze({
  "anidoor.me": {
    title: ".anime-title, .film-name, h1",
    episode: ".np-title, [class*='episode-title']",
    video: "video"
  },
  "vidnest.fun": {
    title: "h1, .film-name, .anime-title",
    episode: ".np-title, [class*='episode-title']",
    video: "video"
  },
  "hianime.to": {
    title: ".film-name, .anime-title, h1",
    episode: ".ep-name, .np-title, [class*='episode-title']",
    video: "video"
  },
  "crunchyroll.com": {
    title: "[data-t='show-title'], h1",
    episode: "[data-t='episode-title']",
    video: "video"
  },
  "animepahe.ru": {
    title: ".title, h1",
    episode: ".episode-title",
    video: "video"
  },
  "youtube.com": {
    title: "h1.ytd-watch-metadata, h1",
    episode: null,
    video: "video"
  }
});

function findSupportedSite(hostname) {
  const host = String(hostname || "").toLowerCase();
  const domain = Object.keys(SUPPORTED_SITES).find(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`)
  );
  return domain ? SUPPORTED_SITES[domain] : null;
}
