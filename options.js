import { unpack } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  const focusGoalInput = document.getElementById('focusGoal');
  const snoozeInput = document.getElementById('snooze');
  const idleDetectionInput = document.getElementById('idleDetection');
  const optionsForm = document.getElementById('optionsForm');
  const resetStorageButton = document.getElementById('resetStorageButton');

  optionsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      unpack(await chrome.runtime.sendMessage({
        command: 'set_options',
        args: {
          options: {
            focusGoalMinutes: focusGoalInput.value,
            snoozeMinutes: snoozeInput.value,
            idleDetectionSeconds: idleDetectionInput.value,
          },
        },
      }));
      alert('Options saved.');
    } catch (e) {
      alert(`An exception occurred while saving the configuration: ${JSON.stringify(e)}`);
    }
  });

  resetStorageButton.addEventListener('click', async (ev) => {
    unpack(await chrome.runtime.sendMessage({
      command: 'reset_storage',
    }));
  });

  const options = unpack(await chrome.runtime.sendMessage({ command: "get_options" }));
  focusGoalInput.value = options.focusGoalMinutes;
  snoozeInput.value = options.snoozeMinutes;
  idleDetectionInput.value = options.idleDetectionSeconds;
});
