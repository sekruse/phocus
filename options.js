import { unpack } from './utils.js';
import { toasts } from './widgets.js';

document.addEventListener('DOMContentLoaded', toasts.catching(async () => {
  toasts.init();
  const focusGoalInput = document.getElementById('focusGoal');
  const snoozeInput = document.getElementById('snooze');
  const idleDetectionInput = document.getElementById('idleDetection');
  const idleDismissalInput = document.getElementById('idleDismissal');
  const spilloverHours = document.getElementById('spilloverHours');
  const optionsForm = document.getElementById('optionsForm');
  const resetStorageButton = document.getElementById('resetStorageButton');
  const showBadgeText = document.getElementById('showBadgeText');
  const showNotifications = document.getElementById('showNotifications');

  optionsForm.addEventListener('submit', toasts.catching(async (event) => {
    event.preventDefault();
    unpack(await chrome.runtime.sendMessage({
      command: 'set_options',
      args: {
        options: {
          focusGoalMinutes: Number.parseInt(focusGoalInput.value),
          snoozeMinutes: Number.parseInt(snoozeInput.value),
          idleDetectionSeconds: Number.parseInt(idleDetectionInput.value),
          idleDismissalSeconds: Number.parseInt(idleDismissalInput.value),
          spilloverHours: Number.parseInt(spilloverHours.value),
          showBadgeText: showBadgeText.checked,
          showNotifications: showNotifications.checked,
        },
      },
    }));
    toasts.show('Options saved.', 3000 /*ms*/);
  }));

  resetStorageButton.addEventListener('click', toasts.catching(async (ev) => {
    const response = unpack(await chrome.runtime.sendMessage({
      command: 'reset_storage',
    }));
  }));

  const options = unpack(await chrome.runtime.sendMessage({ command: "get_options" }));
  focusGoalInput.value = options.focusGoalMinutes;
  snoozeInput.value = options.snoozeMinutes;
  idleDetectionInput.value = options.idleDetectionSeconds;
  idleDismissalInput.value = options.idleDismissalSeconds;
  spilloverHours.value = options.spilloverHours;
  showBadgeText.checked = options.showBadgeText;
  showNotifications.checked = options.showNotifications;
}));
