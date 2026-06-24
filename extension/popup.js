chrome.storage.local.get(["animeData"], (result) => {

  const data = result.animeData;

  if (!data) {

    document.getElementById("title")
      .innerText = "No Anime";

    return;
  }

  document.getElementById("title")
    .innerText = data.animeTitle;

  document.getElementById("episode")
    .innerText = data.episode;

  document.getElementById("time")
    .innerText =
      Math.floor(data.currentTime) + " sec";
});