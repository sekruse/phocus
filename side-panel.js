import {
  formatTimer, formatTime, formatDateInput, formatDateTimeInput,
  calcStartOfDay,
  unpack,
} from './utils.js';

import { modal, toasts } from './widgets.js';

document.addEventListener('DOMContentLoaded', toasts.catching(async () => {
  toasts.init();
  const addEntryButton = document.getElementById("add-entry-button");
  const historyDatePicker = document.getElementById('historyDatePicker');

  let optionsCache = unpack(await chrome.runtime.sendMessage({command: 'get_options'}));
  let historyDate = calcStartOfDay(new Date(), optionsCache.spilloverHours);
  let stateCache = unpack(await chrome.runtime.sendMessage({command: 'get_state'}));

  function showModalForAdd() {
    const modalData = document.getElementById('modal-data');
    const startTimeInput = document.getElementById('starttime');
    const stopTimeInput = document.getElementById('stoptime');
    const notesInput = document.getElementById('notes');
    modalData.removeAttribute('data-entry-id');
    modalData.removeAttribute('data-entry-version');
    const now = new Date();
    startTimeInput.value = formatDateTimeInput(new Date(now - (30 * 60 * 1000)));  // now - 30m
    startTimeInput.removeAttribute('data-original-value');
    stopTimeInput.value = formatDateTimeInput(now);
    stopTimeInput.removeAttribute('data-original-value');
    notesInput.value = 'manual entry';
    modal.show();
  }

  function showModalForEdit(entry) {
    const modalData = document.getElementById('modal-data');
    const startTimeInput = document.getElementById('starttime');
    const stopTimeInput = document.getElementById('stoptime');
    const notesInput = document.getElementById('notes');
    modalData.setAttribute('data-entry-id', entry.id);
    modalData.setAttribute('data-entry-version', entry.version);
    startTimeInput.value = formatDateTimeInput(new Date(entry.startTimestamp));
    startTimeInput.setAttribute('data-original-value', startTimeInput.value);
    stopTimeInput.value = formatDateTimeInput(new Date(entry.stopTimestamp));
    stopTimeInput.setAttribute('data-original-value', stopTimeInput.value);
    notesInput.value = entry.notes;
    modal.show();
  }

  async function saveFromModal() {
    const modalData = document.getElementById('modal-data');
    const startTimeInput = document.getElementById('starttime');
    const stopTimeInput = document.getElementById('stoptime');
    const notesInput = document.getElementById('notes');
    const id = modalData.getAttribute('data-entry-id');
    const version = modalData.getAttribute('data-entry-version');
    const newEntry = {
      notes: notesInput.value,
    };
    if (startTimeInput.value !== startTimeInput.getAttribute('data-original-value')) {
      newEntry.startTimestamp = new Date(startTimeInput.value).getTime();
    }
    if (stopTimeInput.value !== stopTimeInput.getAttribute('data-original-value')) {
      newEntry.stopTimestamp = new Date(stopTimeInput.value).getTime();
    }
    const isNewEntry = !id;
    if (isNewEntry) {
      unpack(await chrome.runtime.sendMessage({
        command: 'add_history_entry',
        args: newEntry,
      }));
    } else {
      newEntry.id = Number.parseInt(id);
      newEntry.version = Number.parseInt(version);
      unpack(await chrome.runtime.sendMessage({
        command: 'update_history_entry',
        args: newEntry,
      }));
    }
    await refreshHistory();
    modal.hide();
    toasts.show('Focus block updated.', 3000 /*ms*/);
  }

  async function deleteFromModal() {
    const modalData = document.getElementById('modal-data');
    const id = modalData.getAttribute('data-entry-id');
    const version = modalData.getAttribute('data-entry-version');
    unpack(await chrome.runtime.sendMessage({
      command: 'delete_from_history',
      args: {
        id: Number.parseInt(id),
        version: Number.parseInt(version),
      },
    }));
    await refreshHistory();
    modal.hide();
    toasts.show('Focus block deleted.', 3000 /*ms*/);
  }
  modal.init(saveFromModal, deleteFromModal);

  async function refreshHistory() {
    const fromDate = historyDate;
    const untilDate = new Date(fromDate);
    untilDate.setDate(untilDate.getDate() + 1);
    const history = unpack(await chrome.runtime.sendMessage({
      command: "list_history",
      args: { fromTimestamp: fromDate.getTime(), untilTimestamp: untilDate.getTime() },
    }));
    const historyTableBody = document.querySelector('#history-table > tbody');
    historyTableBody.innerHTML = '';
    let totalFocusMillis = 0;
    let totalPauseMillis = 0;
    const createRow = function(options) {
      const tr = document.createElement('tr');
      if (options.onClick) {
        tr.classList.add('row-clickable');
        tr.addEventListener('click', toasts.catching(options.onClick));
      }
      let td = document.createElement('td');
      if (options.startTimestamp) {
        td.innerHTML = formatTime(new Date(options.startTimestamp));
      }
      if (options.pauseMillis) {
        td.innerHTML += `<span class="font-xsmall text-blue margin-left">+${formatTimer(options.pauseMillis, false)}</span>`;
      }
      tr.appendChild(td);
      td = document.createElement('td');
      if (options.stopTimestamp) {
        td.innerHTML = formatTime(new Date(options.stopTimestamp));
      }
      if (options.focusMillis) {
        td.innerHTML += `<span class="font-xsmall text-orange margin-left">+${formatTimer(options.focusMillis, false)}</span>`;
      }
      tr.appendChild(td);
      td = document.createElement('td');
      td.innerText = options.notes;
      tr.appendChild(td);
      return tr;
    }
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const options = {
        startTimestamp: entry.startTimestamp,
        stopTimestamp: entry.stopTimestamp,
        focusMillis: entry.stopTimestamp - entry.startTimestamp,
        pauseMillis: i > 0 ? entry.startTimestamp - history[i - 1].stopTimestamp : 0,
        notes: entry.notes,
        onClick: (ev) => showModalForEdit(entry),
      };
      totalFocusMillis += options.focusMillis;
      totalPauseMillis += options.pauseMillis;
      const tr = createRow(options)
      historyTableBody.appendChild(tr);
    }
    if (stateCache.inFocus && stateCache.focusStartTimestamp <= untilDate.getTime()) {
      const options = {
        startTimestamp: stateCache.focusStartTimestamp,
        pauseMillis: history.length > 0 ? stateCache.focusStartTimestamp - history[history.length - 1].stopTimestamp : 0,
        notes: stateCache.notes || '',
      }
      totalPauseMillis += options.pauseMillis;
      const tr = createRow(options);
      historyTableBody.appendChild(tr);
    }
    if (history.length > 0) {
      const firstEntry = history[0];
      const lastEntry = history[history.length - 1];
      const tr = createRow({
        startTimestamp: firstEntry.startTimestamp,
        stopTimestamp: lastEntry.stopTimestamp,
      });
      tr.classList.add('row-footer');
      const td = tr.getElementsByTagName('td')[2];
      td.innerHTML = `Focus: <span class="text-orange font-bold">${formatTimer(totalFocusMillis, false)}</span> &middot; Pauses: <span class="text-blue font-bold">${formatTimer(totalPauseMillis, false)}</span>`;
      tr.appendChild(td);
      historyTableBody.appendChild(tr);
    }
  }
  refreshHistory();

  historyDatePicker.value = formatDateInput(historyDate);
  historyDatePicker.addEventListener('input', toasts.catching((ev) => {
    if (historyDatePicker.value === '') {
      return;
    }
    historyDate = new Date(historyDatePicker.value + 'T00:00:00');
    historyDate.setHours(historyDate.getHours() + optionsCache.spilloverHours);
    refreshHistory();
  }));

  chrome.runtime.onMessage.addListener(toasts.catching((msg, sender) => {
    if (msg.event === 'history_changed') {
      refreshHistory();
    } else if (msg.event === 'state_changed') {
      stateCache = msg.state;
      refreshHistory();
    } else {
      console.log(`Ditching message from ${sender}:\n${JSON.stringify(msg)}`);
    }
  }));

  addEntryButton.addEventListener('click', toasts.catching(showModalForAdd));
}));
