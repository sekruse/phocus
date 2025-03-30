document.addEventListener('DOMContentLoaded', () => {
  const toggleFocusButton = document.getElementById('toggleFocusButton');
  const resetButton = document.getElementById('resetButton');
  const statusDisplay = document.getElementById('statusDisplay');
  const totalDisplay = document.getElementById('totalDisplay');
  const openSidePanelLink = document.getElementById('openSidePanelLink');

  let inFocus = null;

  function formatTimer(millis) {
    const secs = Math.trunc(millis / 1000) % 60;
    const mins = Math.trunc(millis / 60000) % 60;
    const hours = Math.trunc(millis / 3600000);
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  function updateElements(state) {
    toggleFocusButton.disabled = false;
    if (state.inFocus) {
      toggleFocusButton.textContent = 'Leave focus';
      if (!toggleFocusButton.classList.contains('inFocus')) {
        toggleFocusButton.classList.add('inFocus');
      }
      toggleFocusButton.classList.remove('outsideFocus');
      statusDisplay.textContent = formatTimer(Date.now() - state.focusStartTimestamp);
    } else {
      toggleFocusButton.textContent = 'Enter focus';
      if (!toggleFocusButton.classList.contains('outsideFocus')) {
        toggleFocusButton.classList.add('outsideFocus');
      }
      toggleFocusButton.classList.remove('insideFocus');
      statusDisplay.textContent = formatTimer(0);
    }
    totalDisplay.textContent = `Total focus time: ${formatTimer(state.totalFocusMillis)}`;
  };

  function refreshElements() {
    chrome.runtime.sendMessage({ command: "get_state" }, async response => {
      if (!response) {
        throw new Error(`No response for get_state: ${response}`);
      }
      updateElements(response);
      inFocus = response.inFocus;
    });
  };
  refreshElements();

  toggleFocusButton.addEventListener('click', async () => {
    let response;
    const command = inFocus ? 'leave_focus' : 'enter_focus';
    response = await chrome.runtime.sendMessage({ command });
    if (!response) {
      throw new Error(`No response for ${command}: ${response}`);
    }
    updateElements(response);
    inFocus = response.inFocus;
  });

  resetButton.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ command: 'reset_total' });
    refreshElements();
  });
  
  openSidePanelLink?.addEventListener('click', async () => {
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({windowId: window.id});
  });

  setInterval(refreshElements, 1000);
});

