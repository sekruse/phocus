import { unpack, initToast, showToast, withExceptionToast } from './utils.js';

document.addEventListener('DOMContentLoaded', withExceptionToast(async () => {
  initToast();
  const focusGoalInput = document.getElementById('focusGoal');
  const snoozeInput = document.getElementById('snooze');
  const idleDetectionInput = document.getElementById('idleDetection');
  const spilloverHours = document.getElementById('spilloverHours');
  const optionsForm = document.getElementById('optionsForm');
  const resetStorageButton = document.getElementById('resetStorageButton');

  optionsForm.addEventListener('submit', withExceptionToast(async (event) => {
      event.preventDefault();
      unpack(await chrome.runtime.sendMessage({
        command: 'set_options',
        args: {
          options: {
            focusGoalMinutes: Number.parseInt(focusGoalInput.value),
            snoozeMinutes: Number.parseInt(snoozeInput.value),
            idleDetectionSeconds: Number.parseInt(idleDetectionInput.value),
            spilloverHours: Number.parseInt(spilloverHours.value),
          },
        },
      }));
      showToast('Options saved.', 3000 /*ms*/);
  }));

  resetStorageButton.addEventListener('click', withExceptionToast(async (ev) => {
    const response = unpack(await chrome.runtime.sendMessage({
      command: 'reset_storage',
    }));
  }));

  const options = unpack(await chrome.runtime.sendMessage({ command: "get_options" }));
  focusGoalInput.value = options.focusGoalMinutes;
  snoozeInput.value = options.snoozeMinutes;
  idleDetectionInput.value = options.idleDetectionSeconds;
  spilloverHours.value = options.spilloverHours;
}));
