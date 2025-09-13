import { unpack, formatTimer } from './utils.js'
import { dropDowns, toasts } from './widgets.js';
import historyUtils from './history.js';

async function loadHistoryStats(spilloverHours) {
  const fromDate = historyUtils.calcStartOfDay(new Date(), spilloverHours);
  const untilDate = new Date(fromDate);
  untilDate.setDate(untilDate.getDate() + 1);
  const history = unpack(await chrome.runtime.sendMessage({
    command: "list_history",
    args: { fromTimestamp: fromDate.getTime(), untilTimestamp: untilDate.getTime() },
  }));
  return historyUtils.calcHistoryStats(history);
}

document.addEventListener('DOMContentLoaded', toasts.catching(async () => {
  dropDowns.init();
  toasts.init();
  const toggleFocusButton = document.getElementById('toggle-focus-button');
  const toggleFocusButtonSelector = document.getElementById('toggle-focus-button-selector');
  const toggleFocusDropDownResume = document.getElementById('toggle-focus-dropdown-resume');
  const toggleFocusDropDownSinceActive = document.getElementById('toggle-focus-dropdown-since-active');
  const totalFocusDisplay = document.getElementById('total-focus-display');
  const totalPauseDisplay = document.getElementById('total-pause-display');
  const notesTextInput = document.getElementById('notes-text-input');
  const openSidePanelLink = document.getElementById('open-side-panel-link');

  let stateCache = unpack(await chrome.runtime.sendMessage({ command: 'get_state' }));
  let optionsCache = unpack(await chrome.runtime.sendMessage({ command: 'get_options' }));
  let historyStatsCache = await loadHistoryStats(optionsCache.spilloverHours);

  function updateElements(reset = false) {
    toggleFocusButton.disabled = false;
    toggleFocusButton.classList.toggle('button-blue', !stateCache.inFocus);
    toggleFocusButtonSelector.classList.toggle('button-blue', !stateCache.inFocus);
    toggleFocusButton.classList.toggle('button-orange', stateCache.inFocus);
    toggleFocusButtonSelector.classList.toggle('button-orange', stateCache.inFocus);
    toggleFocusButtonSelector.disabled = stateCache.inFocus;
    if (stateCache.inFocus) {
      const activeFocusMillis = Date.now() - stateCache.focusStartTimestamp;
      const activePauseMillis = historyStatsCache.lastStopTimestamp ? stateCache.focusStartTimestamp - historyStatsCache.lastStopTimestamp : 0;
      toggleFocusButton.textContent = `Leave focus (${formatTimer(activeFocusMillis)})`;
      totalFocusDisplay.textContent = formatTimer(historyStatsCache.focusMillis + activeFocusMillis, false);
      totalPauseDisplay.textContent = formatTimer(historyStatsCache.pauseMillis + activePauseMillis, false);
    } else {
      const activePauseMillis = Date.now() - stateCache.focusStopTimestamp;
      toggleFocusButton.textContent = `Enter focus (${formatTimer(activePauseMillis)})`;
      totalFocusDisplay.textContent = formatTimer(historyStatsCache.focusMillis, false);
      totalPauseDisplay.textContent = formatTimer(historyStatsCache.pauseMillis + activePauseMillis, false);
    }
    if (reset) {
      notesTextInput.value = stateCache.notes || '';
      notesTextInput.classList.remove('highlight-orange');
    } else {
      notesTextInput.classList.toggle('highlight-orange', notesTextInput.value !== (stateCache.notes || ''));
    }
  };

  toggleFocusButton.addEventListener('click', toasts.catching(async () => {
    let response;
    const command = stateCache.inFocus ? 'leave_focus' : 'enter_focus';
    unpack(await chrome.runtime.sendMessage({ command }));
  }));

  toggleFocusDropDownResume.addEventListener('click', toasts.catching(async () => {
    unpack(await chrome.runtime.sendMessage({ command: 'resume_focus' }));
  }));

  toggleFocusDropDownSinceActive.addEventListener('click', toasts.catching(async () => {
    unpack(await chrome.runtime.sendMessage({
      command: 'enter_focus',
      args: {
        startEvent: 'since_active',
      },
    }));
  }));


  notesTextInput.addEventListener('change', toasts.catching(async (ev) => {
    unpack(await chrome.runtime.sendMessage({
      command: 'set_notes',
      args: notesTextInput.value,
    }));
  }));

  openSidePanelLink?.addEventListener('click', toasts.catching(async () => {
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: window.id });
  }));

  chrome.runtime.onMessage.addListener(toasts.catching(async (msg, sender) => {
    if (msg.event === 'state_changed') {
      stateCache = msg.state;
      updateElements();
    } else if (msg.event === 'history_changed') {
      historyStatsCache = await loadHistoryStats(optionsCache.spilloverHours);
      updateElements();
    } else {
      console.log(`Discarding message from ${sender}:\n${JSON.stringify(msg)}`);
    }
  }))
  setInterval(updateElements, 250);
  updateElements(true);
}));
