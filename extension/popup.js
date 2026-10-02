import { APP_URL, API_URL } from "./config.js";

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const title = document.getElementById("title");
const episode = document.getElementById("episode");
const time = document.getElementById("time");
const continueBtn = document.getElementById("continue-btn");
const syncStatus = document.getElementById("sync-status");
const loginBtn = document.getElementById("login-btn");
const authError = document.getElementById("auth-error");

let latestProgressUrl = "";

function showApp(user) {
  authSection.hidden = true;
  appSection.hidden = false;
  document.getElementById("dashboard-btn").hidden = false;
  document.getElementById("logout-btn").hidden = false;
  document.getElementById("user-greeting").textContent = user?.username
    ? `Signed in as ${user.username}`
    : "Signed in to MediaVault";
  renderLocalProgress();
}

function showAuth() {
  authSection.hidden = false;
  appSection.hidden = false;
  document.getElementById("user-greeting").textContent = "Local progress · sign in to sync";
  document.getElementById("dashboard-btn").hidden = true;
  document.getElementById("logout-btn").hidden = true;
  renderLocalProgress();
}

function formatDuration(seconds) {
  const totalMinutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const remainder = Math.floor(Math.max(0, Number(seconds) || 0) % 60);
  if (hours) return `${hours}h ${minutes}m watched`;
  return `${minutes}m ${remainder}s watched`;
}

async function renderLocalProgress() {
  const { animeData, syncState } = await chrome.storage.local.get(["animeData", "syncState"]);
  const emptyState = document.getElementById("empty-state");
  const progressBar = document.getElementById("progress-bar");
  const hasProgress = Boolean(animeData?.animeTitle && animeData?.url);

  title.textContent = hasProgress ? animeData.animeTitle : "Nothing playing yet";
  episode.textContent = hasProgress ? animeData.episode || "" : "";
  time.textContent = hasProgress ? formatDuration(animeData.currentTime) : "";
  emptyState.hidden = hasProgress;
  continueBtn.disabled = !hasProgress;
  continueBtn.hidden = !hasProgress;
  latestProgressUrl = hasProgress ? animeData.url : "";

  const duration = Number(animeData?.duration);
  const current = Number(animeData?.currentTime);
  const percent = duration > 0 && Number.isFinite(duration) && Number.isFinite(current)
    ? Math.max(0, Math.min(100, current / duration * 100))
    : 0;
  progressBar.style.width = `${percent}%`;

  const messages = {
    synced: "Synced to your MediaVault account",
    offline: syncState?.message || "Offline: progress is saved on this device",
    "login-required": syncState?.message || "Saved on this device · sign in to sync"
  };
  syncStatus.textContent = messages[syncState?.state] || "Progress saves on this device and syncs when signed in";
  syncStatus.dataset.state = syncState?.state || "local";
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not sign in. Please try again.");
    if (!data.token) throw new Error("The server did not return a sign-in token.");

    const user = {
      _id: data._id,
      username: data.username,
      email: data.email
    };
    await chrome.storage.local.set({ token: data.token, user });
    showApp(user);
  } catch (error) {
    authError.textContent = error.message || "Could not connect to MediaVault.";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
});

document.getElementById("register-link").addEventListener("click", () => {
  chrome.tabs.create({ url: `${APP_URL}/register.html` });
});

document.getElementById("dashboard-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL });
});

continueBtn.addEventListener("click", () => {
  try {
    const url = new URL(latestProgressUrl);
    if (url.protocol === "https:") chrome.tabs.create({ url: url.href });
  } catch {
    syncStatus.textContent = "This saved video link is no longer available.";
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "user"]);
  await chrome.storage.local.set({
    syncState: { state: "login-required", message: "Signed out · progress remains on this device" }
  });
  showAuth();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.token || changes.user) {
    if (changes.token?.newValue && changes.user?.newValue) showApp(changes.user.newValue);
    else if (changes.token?.newValue === undefined) showAuth();
  }
  if (changes.animeData || changes.syncState) renderLocalProgress();
});

chrome.storage.local.get(["token", "user"], ({ token, user }) => {
  if (token && user) showApp(user);
  else showAuth();
});
