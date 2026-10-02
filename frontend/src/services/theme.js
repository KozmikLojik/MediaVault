export const themes = {
  animeNight: { name: "Anime Night", bg: "#101321", bg2: "#191d2c", primary: "#a78bfa", secondary: "#67d5c5", accent: "#c4b5fd", text: "#f2f1f8", textMuted: "#aaa9bb", border: "rgba(219,210,255,.13)", glowColor: "rgba(167,139,250,.14)", particleColor: "rgba(167,139,250,.4)" },
  kdramaMood: { name: "K-Drama Mood", bg: "#17151b", bg2: "#211d25", primary: "#e89bb7", secondary: "#d8a6c1", accent: "#f1c2d3", text: "#f5edf1", textMuted: "#b7a9b0", border: "rgba(244,210,225,.13)", glowColor: "rgba(232,155,183,.13)", particleColor: "rgba(232,155,183,.35)" },
  cinemaMode: { name: "Cinema Mode", bg: "#171716", bg2: "#22211f", primary: "#d7ae69", secondary: "#c98472", accent: "#e6c995", text: "#f0eee9", textMuted: "#aaa69d", border: "rgba(235,218,183,.13)", glowColor: "rgba(215,174,105,.13)", particleColor: "rgba(215,174,105,.35)" },
  cyberpunk: { name: "Cyberpunk", bg: "#101619", bg2: "#182226", primary: "#56c8d0", secondary: "#c77bce", accent: "#84e0e5", text: "#eaf5f5", textMuted: "#9ab1b4", border: "rgba(113,227,232,.14)", glowColor: "rgba(86,200,208,.13)", particleColor: "rgba(86,200,208,.38)" },
  minimal: { name: "Minimal", bg: "#17191a", bg2: "#202324", primary: "#28a9a3", secondary: "#65c0b8", accent: "#79c8bf", text: "#e8eae7", textMuted: "#a4aaa7", border: "rgba(238,243,241,.11)", glowColor: "rgba(40,169,163,.13)", particleColor: "rgba(101,192,184,.25)" }
};

export function applyTheme(themeKey) {
  const theme = themes[themeKey];
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries({ bg: theme.bg, bg2: theme.bg2, primary: theme.primary, secondary: theme.secondary, accent: theme.accent, text: theme.text, "text-muted": theme.textMuted, border: theme.border, "theme-glow": theme.glowColor, "theme-particle": theme.particleColor })) {
    root.style.setProperty(`--${key}`, value);
  }
  localStorage.setItem("mediavault-theme", themeKey);
  document.querySelectorAll(".theme-option").forEach(option => {
    const selected = option.dataset.theme === themeKey;
    option.setAttribute("aria-checked", String(selected));
    option.classList.toggle("selected", selected);
  });
}

export function initThemePicker() {
  const trigger = document.getElementById("theme-toggle");
  const dropdown = document.getElementById("theme-dropdown");
  if (!trigger || !dropdown) return;
  const close = (restoreFocus = false) => {
    dropdown.classList.remove("active");
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };
  trigger.addEventListener("click", event => {
    event.preventDefault();
    const open = !dropdown.classList.contains("active");
    dropdown.classList.toggle("active", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) dropdown.querySelector(".theme-option")?.focus();
  });
  dropdown.querySelectorAll(".theme-option").forEach(option => {
    option.addEventListener("click", () => { applyTheme(option.dataset.theme); close(true); });
    option.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const options = [...dropdown.querySelectorAll(".theme-option")];
        options[(options.indexOf(option) + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length].focus();
      }
    });
  });
  document.addEventListener("click", event => {
    if (!dropdown.contains(event.target) && !trigger.contains(event.target)) close();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && dropdown.classList.contains("active")) close(true); });
  const saved = localStorage.getItem("mediavault-theme");
  applyTheme(themes[saved] ? saved : "minimal");
}
