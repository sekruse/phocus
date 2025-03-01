let stateCache = null;

const defaultState = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "focusTimes": [],
  "totalFocusMillis": 0,
};

async function getState() {
  if (stateCache === null) {
    const loadedState = await chrome.storage.local.get();
    stateCache = {...defaultState, ...loadedState};
  }
  return stateCache;
};

async function writeState(state=stateCache) {
  return chrome.storage.local.set(state);
}

const commands = {
  "get_state": async function(args) {
    return getState();
  },
  "toggle_focus": async function(args) {
    const state = await getState();
    if (state.inFocus) {
      state.inFocus = false;
      const stopTimestamp = Date.now();
      state.focusTimes.push({ start: state.focusStartTimestamp, stop: stopTimestamp });
      state.totalFocusMillis += stopTimestamp - state.focusStartTimestamp;
      state.focusStartTimestamp = 0;
    } else {
      state.inFocus = true;
      state.focusStartTimestamp = Date.now();
    }
    await writeState();
    return state;
  },
};
  
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    const impl = commands[request.command];
    if (!impl) {
      throw new Error(`Undefined command in ${request}.`);
    }
    impl(request.args).then(sendResponse);
    return true;
  }
);
