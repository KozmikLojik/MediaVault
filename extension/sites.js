const animeSite = (overrides = {}) => ({
  title: ".film-name, .anime-title, h1",
  episode: ".ep-name, .np-title, .episode-title, [class*='episode-title'], [data-episode-title]",
  video: "video",
  mediaType: "Anime",
  episodeFallback: "Episode",
  ...overrides
});

const SUPPORTED_SITES = Object.freeze({
  "anidoor.me": animeSite({ title: ".anime-title, .film-name, h1" }),
  "vidnest.fun": animeSite({ title: "h1, .film-name, .anime-title" }),
  "hianime.to": animeSite({ title: ".film-name, .anime-title, h1" }),
  "crunchyroll.com": animeSite({ title: "[data-t='show-title'], h1", episode: "[data-t='episode-title'], h1" }),
  "animepahe.ru": animeSite({ title: ".title, h1", episode: ".episode-title, [class*='episode']" }),
  "reanime.to": animeSite(),
  "anikototv.to": animeSite(),
  "miruro.to": animeSite(),
  "mkissa.to": animeSite(),
  "anizone.to": animeSite(),
  "senshi.to": animeSite(),
  "kaa.to": animeSite(),
  "aniwaves.ru": animeSite(),
  "animenexus.tv": animeSite(),
  "bilibili.tv": animeSite(),
  "bilibili.com": animeSite(),
  "anisnatch.to": animeSite(),
  "ani.pm": animeSite(),
  "animeonsen.xyz": animeSite(),
  "shiro.so": animeSite(),
  "animex.one": animeSite(),
  "anime.uniquestream.net": animeSite(),
  "anify.to": animeSite(),
  "youtube.com": animeSite({
    title: "h1.ytd-watch-metadata, h1",
    episode: null,
    mediaType: "Video"
  }),
  "netflix.com": {
    title: "h1, [data-uia='video-title'], .video-title h4, .player-status-main-title",
    episode: "[data-uia='episode-title'], [data-uia='player-episode-title'], .player-status-main-title, .video-title h4",
    video: "video",
    mediaType: "Netflix"
  }
});

function findSupportedSite(hostname) {
  const host = String(hostname || "").toLowerCase();
  const domain = Object.keys(SUPPORTED_SITES).find(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`)
  );
  return domain ? SUPPORTED_SITES[domain] : null;
}
