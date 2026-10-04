const PROVIDER_TYPES = {
  myanimelist: "Anime", anilist: "Anime", mangabaka: "Manga", comicktracker: "Manga", bakaupdates: "Manga",
  anidb: "Anime", kuroiru: "Anime", myfigurecollection: "Figure", vndbwiki: "Visual Novel", vnclubdb: "Visual Novel",
  novilist: "Light Novel", novelupdates: "Light Novel", ranobedb: "Light Novel", vocadb: "Music", animeplanet: "Anime",
  simkl: "Anime", mydramalist: "K-Drama", kenmei: "Manga", vgmdb: "Music", kitsu: "Anime", pornhwadb: "Manhwa",
  mymangaindex: "Manga", konsumr: "Media", mywaifulist: "Character"
};

const normalizeKey = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const firstValue = (row, keys) => {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    const match = Object.keys(row).find((candidate) => normalizeKey(candidate) === normalized);
    if (match && row[match] !== null && row[match] !== undefined && row[match] !== "") return row[match];
  }
  return undefined;
};

function csvRows(text) {
  const records = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell.trim()); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) records.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) records.push(row);
  if (records.length < 2) throw new Error("The CSV needs a header row and at least one title.");
  const headers = records[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return records.slice(1).map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] || ""])));
}

function jsonRows(value) {
  const rows = [];
  const visit = (node) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    const media = node.media && typeof node.media === "object" ? node.media : node;
    const title = media.title ?? node.title ?? node.name ?? node.series_title;
    if (title && (node.status !== undefined || node.user_status !== undefined || node.list_status !== undefined || node.progress !== undefined || node.user_progress !== undefined || node.score !== undefined || node.user_score !== undefined || node.watched_episodes !== undefined || node.library_status !== undefined)) {
      rows.push({ ...node, mediaTitle: title, mediaType: media.type || media.format || node.type || node.media_type });
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  if (!rows.length) throw new Error("Could not find list entries in this JSON file.");
  return rows;
}

function xmlRows(text) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("This XML export could not be read.");
  const entries = [...document.querySelectorAll("anime, manga, entry, media, item")];
  const rows = entries.map((entry) => {
    const row = {};
    for (const child of entry.children) row[child.tagName] = child.textContent?.trim() || "";
    return row;
  }).filter((row) => firstValue(row, ["series_title", "title", "name", "series_title_english"]));
  if (!rows.length) throw new Error("Could not find titles in this XML export.");
  return rows;
}

function titleText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  return String(value.english || value.userPreferred || value.romaji || value.native || value.name || "").trim();
}

function mapStatus(raw) {
  const status = normalizeKey(raw);
  if (["completed", "complete", "finished", "read", "watched"].some((value) => status.includes(value))) return "Completed";
  if (["watching", "reading", "current", "inprogress", "active", "playing"].some((value) => status.includes(value))) return "Watching";
  if (["paused", "onhold", "hiatus", "interrupted"].some((value) => status.includes(value))) return "Paused";
  if (["dropped", "abandoned", "cancelled", "canceled"].some((value) => status.includes(value))) return "Dropped";
  return "Plan to watch";
}

function normalizedType(provider, row) {
  const raw = String(firstValue(row, ["mediaType", "media_type", "type", "format", "category"]) || "").toLowerCase();
  if (raw.includes("manga") || raw.includes("manhwa") || raw.includes("manhua")) return raw.includes("manhwa") ? "Manhwa" : "Manga";
  if (raw.includes("novel") || raw.includes("lightnovel")) return "Light Novel";
  if (raw.includes("visual") || raw === "vn" || raw.includes("game")) return "Visual Novel";
  if (raw.includes("music") || raw.includes("album")) return "Music";
  if (raw.includes("movie") || raw.includes("film")) return "Movies";
  if (raw.includes("drama")) return "K-Drama";
  if (raw === "tv" || raw.includes("tvseries") || raw.includes("tvshow")) return "TV";
  if (raw.includes("anime")) return "Anime";
  return PROVIDER_TYPES[provider] || "Anime";
}

function normalizeEntries(rows, provider) {
  const unique = new Map();
  for (const row of rows) {
    const title = titleText(row.mediaTitle ?? firstValue(row, ["series_title", "series_title_english", "title_english", "media_title", "title", "anime_title", "manga_title", "name"]));
    if (!title || title.length > 250) continue;
    const type = normalizedType(provider, row);
    const rawProgress = firstValue(row, ["my_watched_episodes", "watched_episodes", "num_episodes_watched", "episodes_watched", "num_read_chapters", "read_chapters", "chapters_read", "chapter_progress", "user_progress", "progress", "episodes", "volumes_read", "volumes", "playtime"]);
    const progress = Number.parseInt(String(rawProgress ?? "").replace(/,/g, "").match(/-?\d+/)?.[0] || "", 10);
    const hasProgress = Number.isFinite(progress) && progress > 0;
    const unit = type === "Manga" || type === "Manhwa" ? "Chapter" : type === "Light Novel" ? "Volume" : type === "Visual Novel" ? "Progress" : type === "Anime" ? "Episode" : "Entry";
    let rating = Number(firstValue(row, ["my_score", "score", "rating", "user_score"]));
    if (!Number.isFinite(rating) || rating < 0) rating = null;
    else if (rating > 10 && rating <= 100) rating = Math.round(rating / 10 * 10) / 10;
    else if (rating > 10) rating = null;
    const yearValue = firstValue(row, ["release_year", "year", "start_year", "season_year"]);
    const releaseYear = Number.parseInt(String(yearValue || "").slice(0, 4), 10);
    const status = mapStatus(firstValue(row, ["my_status", "user_status", "list_status", "status", "watching_status", "library_status", "reading_status"]));
    const genresValue = firstValue(row, ["genres", "genre", "genre_list"]);
    const genres = Array.isArray(genresValue) ? genresValue : typeof genresValue === "string" ? genresValue.split(/[,;|]/).map((genre) => genre.trim()).filter(Boolean) : [];
    const slug = title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
    unique.set(title.toLowerCase(), {
      animeTitle: title,
      type,
      episode: hasProgress ? `${unit} ${progress}` : "Imported list",
      currentTime: 0,
      duration: 0,
      url: "",
      status,
      rating,
      genres: genres.slice(0, 20),
      releaseYear: releaseYear >= 1888 && releaseYear <= 2200 ? releaseYear : null,
      format: type,
      provider: "import",
      providerId: `${provider}:${slug}`.slice(0, 160)
    });
  }
  if (!unique.size) throw new Error("No recognizable titles were found in this export.");
  if (unique.size > 100) throw new Error("This import has more than 100 titles. Split it into smaller files of 100 titles or fewer.");
  return [...unique.values()];
}

export async function parseListExport(file, provider) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an export file smaller than 5 MB.");
  const text = await file.text();
  const extension = file.name.split(".").pop().toLowerCase();
  const rows = extension === "csv" ? csvRows(text) : extension === "xml" ? xmlRows(text) : extension === "json" ? jsonRows(JSON.parse(text)) : null;
  if (!rows) throw new Error("Choose a CSV, JSON, or XML export file.");
  return normalizeEntries(rows, provider);
}
