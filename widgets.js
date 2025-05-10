function toggleDropDown(event) {
  const dropDownId = event.target.getAttribute('data-dropdown-target');
  const dropDown = document.getElementById(dropDownId);
  const ownerId = event.target.getAttribute('data-dropdown-owner');
  const owner = ownerId ? document.getElementById(ownerId) : event.target;
  dropDown.style.top = `${owner.offsetTop + owner.offsetHeight}px`;
  dropDown.style.left = `${owner.offsetLeft}px`
  dropDown.style.left = `${owner.offsetLeft}px`
  dropDown.style.width = `${owner.offsetWidth}px`
  dropDown.classList.toggle('hidden');
}

function closeDropDown(event) {
  event.currentTarget.classList.add('hidden');
}

function initDropDowns() {
  document.querySelectorAll('[data-dropdown-target]').forEach(element => {
    element.addEventListener('click', toggleDropDown);
  });
  document.querySelectorAll('[data-dropdown]').forEach(element => {
    element.addEventListener('click', closeDropDown);
  });
}

export const dropDowns = {
  init: initDropDowns,
}

function initToast() {
  const toastClose = document.getElementById('toast-close');
  toastClose.addEventListener('click', () => hideToast());
}

function showToast(message, timeoutMillis, style) {
  const toast = document.getElementById('toast');
  const toastContent = document.getElementById('toast-content');
  toast.classList.remove('toast-red', 'toast-green');
  if (style) {
    toast.classList.add(style);
  }
  toastContent.innerText = message;
  toast.classList.remove('hidden', 'animate-vanish', 'animate-appear');
  toast.classList.add('animate-appear');
  if (timeoutMillis) {
    setTimeout(() => { hideToast(message) }, timeoutMillis);
  }
}

function hideToast(expectedMessage) {
  const toast = document.getElementById('toast');
  const toastContent = document.getElementById('toast-content');
  if (!expectedMessage || toastContent.innerText === expectedMessage) {
    toast.classList.remove('animate-appear');
    toast.classList.add('animate-vanish');
  }
}

function withExceptionToast(func) {
  return async (a, b, c, d, e) => {
    try {
      return await func(a, b, c, d, e);
    } catch (err) {
      if (err.name === 'UserException') {
        showToast(`An error occurred: ${err.message}`, null, 'toast-red');
      } else {
        showToast('Oops, something went wrong... :/', 5000 /*ms*/, 'toast-red');
        throw err;
      }
    }
  };
}

export const toasts = {
  init: initToast,
  show: showToast,
  hide: hideToast,
  catching: withExceptionToast,
};


const modalPane = document.getElementById("modal");
const modalCancelButton = document.getElementById("modal-cancel-button");
const modalSaveButton = document.getElementById("modal-save-button");
const modalDeleteButton = document.getElementById("modal-delete-button");

function showModal() {
  modalPane.classList.remove('hidden', 'animate-vanish', 'animate-appear');
  modalPane.classList.add('animate-appear');
}

function hideModal() {
  modalPane.classList.remove('animate-appear');
  modalPane.classList.add('animate-vanish');
}

function initModal(onSave, onDelete) {
  modalCancelButton.addEventListener('click', toasts.catching(hideModal));
  modalSaveButton.classList.toggle('hidden', !onSave);
  if (onSave) {
    modalSaveButton.addEventListener('click', toasts.catching(onSave));
  }
  modalDeleteButton.classList.toggle('hidden', !onDelete);
  if (onDelete) {
    modalDeleteButton.addEventListener('click', toasts.catching(onDelete));
  }
}

export const modal = {
  init: initModal,
  show: showModal,
  hide: hideModal,
};
