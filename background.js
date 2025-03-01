let stateCache = null;

const defaultState = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "focusTimes": [],
  "totalFocusMillis": 0,
  "nextAlarmTimestamp": 0,
};

const updateAlarmName = 'phocus-update-alarm';
const focusGoalNotificationName = 'phocus-goal-notification';
const focusGoalMinutes = 25;
const snoozeMinutes = 10;
const alarmConfig = {
  periodInMinutes: 0.5,
};

async function getState() {
  if (stateCache === null) {
    const loadedState = await chrome.storage.local.get();
    stateCache = {...defaultState, ...loadedState};
  }
  return stateCache;
}

async function writeState(state=stateCache) {
  return chrome.storage.local.set(state);
}

// TODO - Change to enter/leaveFocus
async function toggleFocus() {
  const state = await getState();
  if (state.inFocus) {
    state.inFocus = false;
    const stopTimestamp = Date.now();
    state.focusTimes.push({ start: state.focusStartTimestamp, stop: stopTimestamp });
    state.totalFocusMillis += stopTimestamp - state.focusStartTimestamp;
    state.focusStartTimestamp = 0;
    state.nextAlarmTimestamp = 0;
    updateBadge();
    chrome.alarms.clear(updateAlarmName);
  } else {
    state.inFocus = true;
    state.focusStartTimestamp = Date.now();
    state.nextAlarmTimestamp = state.focusStartTimestamp + (focusGoalMinutes * 60000);
    updateBadge();
    await chrome.alarms.create(updateAlarmName, alarmConfig);
  }
  await writeState();
  return state;
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
}

async function notifyOfGoal() {
  const state = await getState();
  const elapsedMins = Math.round((Date.now() - state.focusStartTimestamp) / 60000);
  await chrome.notifications.create(focusGoalNotificationName, {
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: 'Phocus',
    message: `You have focused for ${elapsedMins} minutes now. Time for a break?`,
    requireInteraction: true,
    buttons: [{ title: 'Remind me later' }, { title: 'Take a break' }],
  });
}

async function initialize() {
  const state = await getState();
  if (!state.inFocus) {
    return;
  }
  const alarm = await chrome.alarms.get(updateAlarmName);
  if (!alarm) {
    await chrome.alarms.create(updateAlarmName, alarmConfig);
  };
  updateBadge();
}

initialize();

const commands = {
  "get_state": async function(args) {
    return getState();
  },
  "toggle_focus": async function(args) {
    return toggleFocus();
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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === updateAlarmName) {
    const state = await getState();
    updateBadge();
    if (state.nextAlarmTimestamp && Date.now() >= state.nextAlarmTimestamp) {
      notifyOfGoal();
      state.nextAlarmTimestamp = 0;
      writeState(state);
    }
  } else {
    throw new Error(`Unexpected alarm: {alarm}`);
  }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, btnIndex) => {
  if (notificationId === focusGoalNotificationName) {
    chrome.notifications.clear(focusGoalNotificationName);
    if (btnIndex === 0) {
      // Snooze.
      const state = await getState();
      state.nextAlarmTimestamp = Date.now() + (snoozeMinutes * 60000);
      await writeState(state);
      return;
    }
    if (btnIndex === 1) {
      // Take a break.
      await toggleFocus();
      return;
    }
  }
  throw new Error(`Unknown notification: ${notificationId}`);
});
