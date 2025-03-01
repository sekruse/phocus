let stateCache = null;

const defaultState = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "focusTimes": [],
  "totalFocusMillis": 0,
};

const updateAlarmName = 'phocus-update-alarm';

const focusGoalMinutes = 25;

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

async function updateBadge() {
  const state = await getState();
  if (state.inFocus) {
    const focusMinutes = Math.trunc((Date.now() - state.focusStartTimestamp) / 60000);
    chrome.action.setBadgeTextColor({ color: '#FFF' });
    chrome.action.setBadgeBackgroundColor({ color: (focusMinutes < focusGoalMinutes) ? '#cc3300' : '#009933' });
    chrome.action.setBadgeText({ text: `${focusMinutes}m` });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
};

async function initialize() {
  const state = await getState();
  if (!state.inFocus) {
    return;
  }
  const alarm = await chrome.alarms.get(updateAlarmName);
  if (!alarm) {
    await chrome.alarms.create(updateAlarmName, {
      periodInMinutes: 1,
    });
  };
  updateBadge();
};

initialize();

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
      updateBadge();
      chrome.alarms.clear(updateAlarmName);
    } else {
      state.inFocus = true;
      state.focusStartTimestamp = Date.now();
      updateBadge();
      await chrome.alarms.create(updateAlarmName, {
        periodInMinutes: 1,
      });
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === updateAlarmName) {
    updateBadge();
  } else {
    throw new Error(`Unexpected alarm: {alarm}`);
  }
});
