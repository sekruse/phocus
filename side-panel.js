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
    td.appendChild(button);
    button = document.createElement('button');
    button.classList.add('button', 'button-red');
    button.innerText = 'Delete';
    td.appendChild(button);
    tr.appendChild(td);
    historyTableBody.appendChild(tr);
  });
  console.log(history);
}

historyDatePicker.value = formatDateInput(new Date());
historyDatePicker.addEventListener('input', (ev) => refreshHistory(ev));
refreshHistory();

function showModal() {
  modal.classList.add('modal-show');
}

function hideModal() {
  modal.classList.remove('modal-show');
}

// TODO - Populate modal. 
addEntryButton.addEventListener('click', showModal);
modalCancelButton.addEventListener('click', hideModal);
// TODO - Save data.
modalSaveButton.addEventListener('click', hideModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    hideModal(event);
  }
});
