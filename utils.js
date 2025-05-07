export function unpack(response) {
  if (!response.success) {
    throw response.error;
  }
  return response.result;
}

export class UserException {
  constructor(message) {
    this.name = 'UserException';
    this.message = message;
  }
}

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

export function calcStartOfDay(date, spillOverHours) {
  const d = new Date(date - (spillOverHours * 60 * 60 * 1000))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), spillOverHours)
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

export function initToast() {
  const toastClose = document.getElementById('toast-close');
  toastClose.addEventListener('click', () => hideToast());
}

export function showToast(message, timeoutMillis, style) {
  const toast = document.getElementById('toast');
  const toastContent = document.getElementById('toast-content');
  toast.classList.remove('toast-red', 'toast-green');
  if (style) {
    toast.classList.add(style);
  }
  toastContent.innerText = message;
  toast.classList.remove('hidden', 'animate-vanish', 'animate-appear');
  toast.classList.add('animate-appear');
  if (timeoutMillis) {
    setTimeout(() => { hideToast(message) }, timeoutMillis);
  }
}

export function hideToast(expectedMessage) {
  const toast = document.getElementById('toast');
  const toastContent = document.getElementById('toast-content');
  if (!expectedMessage || toastContent.innerText === expectedMessage) {
    toast.classList.remove('animate-appear');
    toast.classList.add('animate-vanish');
  }
}

export function withExceptionToast(func) {
  return async (a, b, c, d, e) => {
    try {
      return await func(a, b, c, d, e);
    } catch (err) {
      if (err.name === 'UserException') {
        showToast(`An error occurred: ${err.message}`, null, 'toast-red');
      } else {
        showToast('Oops, something went wrong... :/', 5000 /*ms*/, 'toast-red');
        throw err;
      }
    }
  };
}
