document.addEventListener('DOMContentLoaded', () => {
  const toggleFocusButton = document.getElementById('toggleFocusButton');
  const statusDisplay = document.getElementById('statusDisplay');
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
      statusDisplay.textContent = formatTimer(Date.now() - state.focusStartTimestamp);
    } else {
      toggleFocusButton.textContent = 'Enter focus';
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
  
  setInterval(refreshElements, 1000);
});
