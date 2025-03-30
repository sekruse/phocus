document.addEventListener('DOMContentLoaded', async () => {
  const toggleFocusButton = document.getElementById('toggleFocusButton');
  const resetButton = document.getElementById('resetButton');
  const statusDisplay = document.getElementById('statusDisplay');
  const totalDisplay = document.getElementById('totalDisplay');
  const openSidePanelLink = document.getElementById('openSidePanelLink');

  let stateCache = await chrome.runtime.sendMessage({command: 'get_state'});

  function formatTimer(millis) {
    const secs = Math.trunc(millis / 1000) % 60;
    const mins = Math.trunc(millis / 60000) % 60;
    const hours = Math.trunc(millis / 3600000);
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  function updateElements() {
    toggleFocusButton.disabled = false;
    if (stateCache.inFocus) {
      toggleFocusButton.textContent = 'Leave focus';
      if (!toggleFocusButton.classList.contains('inFocus')) {
        toggleFocusButton.classList.add('inFocus');
      }
      toggleFocusButton.classList.remove('outsideFocus');
      statusDisplay.textContent = formatTimer(Date.now() - stateCache.focusStartTimestamp);
    } else {
      toggleFocusButton.textContent = 'Enter focus';
      if (!toggleFocusButton.classList.contains('outsideFocus')) {
        toggleFocusButton.classList.add('outsideFocus');
      }
      toggleFocusButton.classList.remove('insideFocus');
      statusDisplay.textContent = formatTimer(0);
    }
    totalDisplay.textContent = `Total focus time: ${formatTimer(stateCache.totalFocusMillis)}`;
  };

  toggleFocusButton.addEventListener('click', async () => {
    let response;
    const command = stateCache.inFocus ? 'leave_focus' : 'enter_focus';
    await chrome.runtime.sendMessage({ command });
  });

  resetButton.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ command: 'reset_total' });
    updateElements();
  });
  
  openSidePanelLink?.addEventListener('click', async () => {
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({windowId: window.id});
  });

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.event === 'state_changed') {
      stateCache = msg.state;
      updateElements();
    } else {
      console.log(`Discarding message from ${sender}:\n${JSON.stringify(msg)}`);
    }
  })
  setInterval(updateElements, 250);
  updateElements();
});

