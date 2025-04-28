import { calcHistoryStats, formatTimer } from './utils.js'

async function loadHistoryStats() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const untilDate = new Date(fromDate);
  untilDate.setDate(untilDate.getDate() + 1);
  const history = await chrome.runtime.sendMessage({
    command: "list_history",
    args: { fromTimestamp: fromDate.getTime(), untilTimestamp: untilDate.getTime() },
  });
  return calcHistoryStats(history);
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggleFocusButton = document.getElementById('toggle-focus-button');
  const totalFocusDisplay = document.getElementById('total-focus-display');
  const totalPauseDisplay = document.getElementById('total-pause-display');
  const notesTextInput = document.getElementById('notes-text-input');
  const openSidePanelLink = document.getElementById('open-side-panel-link');

  let stateCache = await chrome.runtime.sendMessage({command: 'get_state'});
  let historyStatsCache = await loadHistoryStats();

  function updateElements(reset=false) {
    toggleFocusButton.disabled = false;
    toggleFocusButton.classList.toggle('button-blue', !stateCache.inFocus);
    toggleFocusButton.classList.toggle('button-orange', stateCache.inFocus);
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

  toggleFocusButton.addEventListener('click', async () => {
    let response;
    const command = stateCache.inFocus ? 'leave_focus' : 'enter_focus';
    await chrome.runtime.sendMessage({ command });
  });

  notesTextInput.addEventListener('change', async (ev) => {
    await chrome.runtime.sendMessage({
      command: 'set_notes',
      args: notesTextInput.value,
    });
  });

  openSidePanelLink?.addEventListener('click', async () => {
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({windowId: window.id});
  });

  chrome.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.event === 'state_changed') {
      stateCache = msg.state;
      updateElements();
    } else if (msg.event === 'history_changed') {
      historyStatsCache = await loadHistoryStats();
      updateElements();
    } else {
      console.log(`Discarding message from ${sender}:\n${JSON.stringify(msg)}`);
    }
  })
  setInterval(updateElements, 250);
  updateElements(true);
});

