export function calculateTotalHours(data) {

  return (
    data.reduce(
      (sum, anime) =>
        sum + (anime.currentTime || 0),
      0
    ) / 3600
  );

}

export function calculateTopAnime(data) {

  if (!data.length) {
    return null;
  }

  return [...data].sort(
    (a, b) =>
      b.currentTime - a.currentTime
  )[0];

}

export function calculateWatchDistribution(data) {

  const totalSeconds =
    data.reduce(
      (sum, anime) =>
        sum + (anime.currentTime || 0),
      0
    );

  return [...data]
    .sort(
      (a, b) =>
        b.currentTime - a.currentTime
    )
    .map(anime => {

      const seconds =
        anime.currentTime || 0;

      return {
        animeTitle: anime.animeTitle,
        minutes: Math.round(seconds / 60),
        hours: (seconds / 3600).toFixed(1),
        percent: totalSeconds
          ? ((seconds / totalSeconds) * 100).toFixed(1)
          : "0"
      };

    });

}

export function calculateWeeklyHours(data) {

  const days = {};

  for (let i = 6; i >= 0; i--) {

    const date = new Date();
    date.setDate(date.getDate() - i);

    const key =
      date.toISOString().slice(0, 10);

    days[key] = 0;

  }

  data.forEach(anime => {

    if (!anime.updatedAt) {
      return;
    }

    const key =
      anime.updatedAt.slice(0, 10);

    if (key in days) {
      days[key] +=
        (anime.currentTime || 0) / 3600;
    }

  });

  return Object.entries(days).map(
    ([date, hours]) => ({
      date,
      label: new Date(date + "T12:00:00")
        .toLocaleDateString(undefined, {
          weekday: "short"
        }),
      hours: +hours.toFixed(2)
    })
  );

}

export function calculateCompletedCount(data) {

  return data.filter(anime => {

    const duration =
      anime.duration || 1;

    return (
      (anime.currentTime || 0) /
        duration >=
      0.9
    );

  }).length;

}

export function calculateAverageCompletion(data) {

  if (!data.length) {
    return 0;
  }

  const total =
    data.reduce((sum, anime) => {

      const duration =
        anime.duration || 1;

      return sum + Math.min(
        ((anime.currentTime || 0) /
          duration) * 100,
        100
      );

    }, 0);

  return (total / data.length).toFixed(1);

}

export function calculateRecentlyWatched(
  data,
  limit = 5
) {

  return [...data]
    .sort(
      (a, b) =>
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
    )
    .slice(0, limit);

}

export function calculateLongestStreak(data) {

  const dates = [...new Set(
    data
      .filter(anime => anime.updatedAt)
      .map(anime =>
        anime.updatedAt.slice(0, 10)
      )
  )].sort();

  if (!dates.length) {
    return 0;
  }

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {

    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);

    const dayDiff =
      (curr - prev) /
      (1000 * 60 * 60 * 24);

    if (dayDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(
        maxStreak,
        currentStreak
      );
    } else {
      currentStreak = 1;
    }

  }

  return maxStreak;

}
