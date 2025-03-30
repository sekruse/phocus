const modal = document.getElementById("modal");
const addEntryButton = document.getElementById("add-entry-button");
const modalCancelButton = document.getElementById("modal-cancel-button");
const modalSaveButton = document.getElementById("modal-save-button");
const historyDatePicker = document.getElementById('historyDatePicker');

function formatDateInput(date) {
  const dd = new String(date.getDate()).padStart(2, '0');
  const mm = new String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = new String(date.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime(date) {
 const hh = new String(date.getHours()).padStart(2, '0');
 const mm = new String(date.getMinutes()).padStart(2, '0');
 return `${hh}:${mm}`;
}

function formatDateTimeInput(date) {
  return `${formatDateInput(date)}T${formatTime(date)}`;
}

function showModal() {
  modal.classList.add('modal-show');
}

function hideModal() {
  modal.classList.remove('modal-show');
}

function showModalForAdd() {
  const modalData = document.getElementById('modal-data');
  const startTimeInput = document.getElementById('starttime');
  const stopTimeInput = document.getElementById('stoptime');
  const notesInput = document.getElementById('notes');
  modalData.removeAttribute('data-entry-id');
  modalData.removeAttribute('data-entry-version');
  const now = new Date();
  startTimeInput.value = formatDateTimeInput(new Date(now - (30 * 60 * 1000)));  // now - 30m
  stopTimeInput.value = formatDateTimeInput(now);
  notesInput.value = 'manual entry';
  showModal();
}

function showModalForEdit(entry) {
  const modalData = document.getElementById('modal-data');
  const startTimeInput = document.getElementById('starttime');
  const stopTimeInput = document.getElementById('stoptime');
  const notesInput = document.getElementById('notes');
  modalData.setAttribute('data-entry-id', entry.id);
  modalData.setAttribute('data-entry-version', entry.version);
  startTimeInput.value = formatDateTimeInput(new Date(entry.startTimestamp));
  stopTimeInput.value = formatDateTimeInput(new Date(entry.stopTimestamp));
  notesInput.value = entry.notes;
  showModal();
}

async function saveFromModal() {
  const modalData = document.getElementById('modal-data');
  const startTimeInput = document.getElementById('starttime');
  const stopTimeInput = document.getElementById('stoptime');
  const notesInput = document.getElementById('notes');
  const id = modalData.getAttribute('data-entry-id');
  const version = modalData.getAttribute('data-entry-version');
  const newEntry = {
    startTimestamp: new Date(startTimeInput.value).getTime(),
    stopTimestamp: new Date(stopTimeInput.value).getTime(),
    notes: notesInput.value,
  };
  const isNewEntry = !id;
  if (isNewEntry) {
    await chrome.runtime.sendMessage({
      command: 'add_history_entry',
      args: newEntry,
    });
  } else {
    newEntry.id = Number.parseInt(id);
    newEntry.version = Number.parseInt(version);
    await chrome.runtime.sendMessage({
      command: 'update_history_entry',
      args: newEntry,
    });
  }
  await refreshHistory();
  hideModal();
}
modalSaveButton.addEventListener('click', saveFromModal);

async function refreshHistory(ev) {
  if (historyDatePicker.value === '') {
    return;
  }
  const fromTimestamp = new Date(historyDatePicker.value + "T00:00:00");
  const untilTimestamp = new Date(fromTimestamp);
  untilTimestamp.setDate(untilTimestamp.getDate() + 1);
  const history = await chrome.runtime.sendMessage({
    command: "list_history",
    args: { fromTimestamp: fromTimestamp.getTime(), untilTimestamp: untilTimestamp.getTime() },
  });
  const historyTableBody = document.querySelector('#history-table > tbody');
  historyTableBody.innerHTML = '';
  history.forEach((entry) => {
    const tr = document.createElement('tr');
    let td = document.createElement('td');
    td.innerText = formatTime(new Date(entry.startTimestamp));
    tr.appendChild(td);
    td = document.createElement('td');
    td.innerText = formatTime(new Date(entry.stopTimestamp));
    tr.appendChild(td);
    td = document.createElement('td');
    td.innerText = entry.notes;
    tr.appendChild(td);
    td = document.createElement('td');
    td.classList.add('text-align-center');
    let button = document.createElement('button');
    button.classList.add('button', 'button-blue');
    button.innerText = 'Edit';
    button.addEventListener('click', (ev) => showModalForEdit(entry));
    td.appendChild(button);
    button = document.createElement('button');
    button.classList.add('button', 'button-red');
    button.innerText = 'Delete';
    button.addEventListener('click', async (ev) => {
      await chrome.runtime.sendMessage({
        command: 'delete_from_history',
        args: entry,
      });
      refreshHistory();
    });
    td.appendChild(button);
    tr.appendChild(td);
    historyTableBody.appendChild(tr);
  });
  console.log(history);
}

historyDatePicker.value = formatDateInput(new Date());
historyDatePicker.addEventListener('input', (ev) => refreshHistory(ev));
refreshHistory();

addEntryButton.addEventListener('click', showModalForAdd);
modalCancelButton.addEventListener('click', hideModal);
