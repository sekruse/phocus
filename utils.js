export function formatTimer(millis, show_secs=true) {
  const secs = Math.trunc(millis / 1000) % 60;
  let result = show_secs ? ` ${secs}s` : '';
  const mins = Math.trunc(millis / 60000) % 60;
  result = `${mins}m${result}`;
  const hours = Math.trunc(millis / 3600000) % 24;
  if (hours > 0) {
    return `${hours}h ${result}`
  }
  return result;
}

export function calcHistoryStats(history) {
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

export function formatDateInput(date) {
  const dd = new String(date.getDate()).padStart(2, '0');
  const mm = new String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = new String(date.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

export function formatTime(date) {
 const hh = new String(date.getHours()).padStart(2, '0');
 const mm = new String(date.getMinutes()).padStart(2, '0');
 return `${hh}:${mm}`;
}

export function formatDateTimeInput(date) {
  return `${formatDateInput(date)}T${formatTime(date)}`;
}

function toggleDropDown(event) {
  const dropDownId = event.target.getAttribute('data-dropdown-target');
  const dropDown = document.getElementById(dropDownId);
  const ownerId = event.target.getAttribute('data-dropdown-owner');
  const owner = ownerId ? document.getElementById(ownerId) : event.target;
  dropDown.style.top = `${owner.offsetTop + owner.offsetHeight}px`;
  dropDown.style.left = `${owner.offsetLeft}px`
  dropDown.style.left = `${owner.offsetLeft}px`
  dropDown.style.width = `${owner.offsetWidth}px`
  dropDown.classList.toggle('hidden');
}

function closeDropDown(event) {
  event.currentTarget.classList.add('hidden');
}

export function initDropDowns() {
  document.querySelectorAll('[data-dropdown-target]').forEach(element => {
    element.addEventListener('click', toggleDropDown);
  });
  document.querySelectorAll('[data-dropdown]').forEach(element => {
    element.addEventListener('click', closeDropDown);
  });
}
