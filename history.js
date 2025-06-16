function calcStartOfDay(date, spillOverHours) {
  const d = new Date(date - (spillOverHours * 60 * 60 * 1000))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), spillOverHours)
}

function calcHistoryStats(history) {
  const stats = {
    focusMillis: 0,
    pauseMillis: 0,
    lastStopTimestamp: 0,
  };
  if (!history) {
    return stats;
  }
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    stats.focusMillis += entry.stopTimestamp - entry.startTimestamp;
    stats.lastStopTimestamp = Math.max(stats.lastStopTimestamp, entry.stopTimestamp);
    if (i > 0) {
      const prevEntry = history[i-1];
      stats.pauseMillis += entry.startTimestamp - prevEntry.stopTimestamp;
    }
  }
  return stats;
}

export default {
  calcStartOfDay,
  calcHistoryStats,
};
