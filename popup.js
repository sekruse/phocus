document.addEventListener('DOMContentLoaded', () => {
  const toggleFocusButton = document.getElementById('toggleFocusButton');
  const statusDisplay = document.getElementById('statusDisplay');

  function formatTimer(millis) {
    const secs = Math.trunc(millis / 1000) % 60;
    const mins = Math.trunc(millis / 60000);
    return `${mins}m ${secs}s`;

  };

  function updateElements(state) {
    toggleFocusButton.disabled = false;
    if (state.inFocus) {
      toggleFocusButton.textContent = 'Leave focus';
      statusDisplay.textContent = formatTimer(Date.now() - state.startTimestamp);
    } else {
      toggleFocusButton.textContent = 'Enter focus';
      statusDisplay.textContent = '';
    }
  };

  function refreshElements() {
    chrome.runtime.sendMessage({ command: "get_state" }, response => {
      if (!response) {
        throw new Error(`No response for get_state: ${response}`);
      }
      updateElements(response);
    });
  };
  refreshElements();

  toggleFocusButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: "toggle_focus" }, response => {
      if (!response) {
        throw new Error(`No response for toggle_focus: ${response}`);
      }
      updateElements(response);
    });
  });
  
  setInterval(refreshElements, 1000);
});
