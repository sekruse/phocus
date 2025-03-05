document.addEventListener('DOMContentLoaded', () => {
  const focusGoalInput = document.getElementById('focusGoal');
  const snoozeInput = document.getElementById('snooze');
  const idleDetectionInput = document.getElementById('idleDetection');
  const optionsForm = document.getElementById('optionsForm');

  chrome.runtime.sendMessage({ command: "get_options" }, async response => {
    console.log(`get_options: ${response}`);
    if (!response) {
      throw new Error(`No response for get_state: ${response}`);
    }
    focusGoalInput.value = response.focusGoalMinutes;
    snoozeInput.value = response.snoozeMinutes;
    idleDetectionInput.value = response.idleDetectionSeconds;
  });

  optionsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      let response = await chrome.runtime.sendMessage({
        command: 'set_options',
        args: {
          options: {
            focusGoalMinutes: focusGoalInput.value,
            snoozeMinutes: snoozeInput.value,
            idleDetectionSeconds: idleDetectionInput.value,
          },
        },
      });
      if (!response) {
        throw new Error(`No response for set_options: ${response}`);
      }
      alert('Options saved.');
    } catch (e) {
      alert(`An exception occurred while saving the configuration: ${e}`);
    }
  });
});
