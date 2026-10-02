import { API_URL } from "./config.js";

const SUPPORTED_HOSTS = [
  "anidoor.me",
  "vidnest.fun",
  "hianime.to",
  "crunchyroll.com",
  "animepahe.ru",
  "youtube.com"
];

function isSupportedHost(hostname) {
  return SUPPORTED_HOSTS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

async function setSyncState(state, message) {
  const { syncState } = await chrome.storage.local.get("syncState");
  if (syncState?.state === state && syncState?.message === message) return;
  await chrome.storage.local.set({
    syncState: { state, message, updatedAt: new Date().toISOString() }
  });
}

function isValidProgress(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.animeTitle !== "string" || !data.animeTitle.trim() || data.animeTitle.length > 250) return false;
  if (typeof data.episode !== "string" || !data.episode.trim() || data.episode.length > 160) return false;
  if (!Number.isFinite(Number(data.currentTime)) || Number(data.currentTime) < 0) return false;
  if (!Number.isFinite(Number(data.duration)) || Number(data.duration) < 0) return false;

  try {
    const url = new URL(data.url);
    return url.protocol === "https:" && isSupportedHost(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SAVE_ANIME") return false;

  (async () => {
    try {
      const senderUrl = new URL(sender.url || "");
      if (!isSupportedHost(senderUrl.hostname.toLowerCase()) || !isValidProgress(message.data)) {
        sendResponse({ ok: false, message: "Invalid playback progress." });
        return;
      }

      const { token } = await chrome.storage.local.get("token");
      if (!token) {
        await setSyncState("login-required", "Progress is saved here. Sign in to sync it to your account.");
        sendResponse({ ok: false, message: "Sign in to sync progress." });
        return;
      }

      const response = await fetch(`${API_URL}/api/progress/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(message.data),
        signal: AbortSignal.timeout(12000)
      });

      if (response.status === 401 || response.status === 403) {
        await chrome.storage.local.remove(["token", "user"]);
        await setSyncState("login-required", "Your session expired. Sign in again to sync progress.");
        sendResponse({ ok: false, message: "Your session expired." });
        return;
      }

      if (!response.ok) {
        await setSyncState("offline", `Sync failed (${response.status}). Your local progress is safe.`);
        sendResponse({ ok: false, message: `Sync failed (${response.status}).` });
        return;
      }

      await setSyncState("synced", "Progress synced to your MediaVault account.");
      sendResponse({ ok: true });
    } catch (error) {
      await setSyncState("offline", "Could not reach MediaVault. Your local progress is safe.");
      sendResponse({ ok: false, message: error?.message || "Sync unavailable." });
    }
  })();

  return true;
});
