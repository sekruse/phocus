let stateCache = null;

const defaultState = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "idleStartTimestamp": 0,
  "focusTimes": [],
  "totalFocusMillis": 0,
  "nextAlarmTimestamp": 0,
};

const updateAlarmName = 'phocus-update-alarm';
const focusGoalNotificationName = 'phocus-goal-notification';
const lockedNotificationName = 'phocus-locked-notification';
const idleNotificationName = 'phocus-idle-notification';
const focusGoalMinutes = 25;
const snoozeMinutes = 10;
const idleDetectionSeconds = 120;
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

async function enterFocus() {
  const state = await getState();
  if (state.inFocus) {
    return state;
  }
  state.inFocus = true;
  state.focusStartTimestamp = Date.now();
  state.nextAlarmTimestamp = state.focusStartTimestamp + (focusGoalMinutes * 60000);
  state.idleStartTimestamp = 0;
  updateBadge();
  chrome.alarms.create(updateAlarmName, alarmConfig);
  await writeState();
  return state;
}

async function leaveFocus(stopTimestamp = Date.now()) {
  const state = await getState();
  if (!state.inFocus) {
    return state;
  }
  state.inFocus = false;
  state.focusTimes.push({ start: state.focusStartTimestamp, stop: stopTimestamp });
  state.totalFocusMillis += stopTimestamp - state.focusStartTimestamp;
  state.focusStartTimestamp = 0;
  state.nextAlarmTimestamp = 0;
  state.idleStartTimestamp = 0;
  updateBadge();
  chrome.alarms.clear(updateAlarmName);
  chrome.notifications.clear(idleNotificationName);
  await writeState();
  return state;
}

async function resetTotal() {
  const state = await getState();
  state.totalFocusMillis = 0;
  return writeState(state);
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

async function notifyOfAutocancel() {
  await chrome.notifications.create(lockedNotificationName, {
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: 'Phocus',
    message: 'Your focus time was cancelled when you locked your computer.',
    requireInteraction: false,
  });
}

async function notifyOfIdleDetection() {
  const state = await getState();
  const date = new Date(state.idleStartTimestamp);
  await chrome.notifications.create(idleNotificationName, {
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: 'Phocus',
    message: `Your computer has been detected as idle since ${date.toLocaleTimeString()}. Have you left your focus then?`,
    requireInteraction: true,
    buttons: [{ title: 'Yes, I left my focus time.' }, { title: 'No, I was keeping my focus.' }],
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
  "enter_focus": async function(args) {
    return enterFocus();
  },
  "leave_focus": async function(args) {
    return leaveFocus();
  },
  "reset_total": async function(args) {
    return resetTotal();
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
      await leaveFocus();
      return;
    }
  } else if (notificationId === idleNotificationName) {
    chrome.notifications.clear(idleNotificationName);
    const state = await getState();
    if (btnIndex === 0) {
      // User left focus.
      await leaveFocus(state.idleStartTimestamp);
      return;
    } else if (btnIndex === 1) {
      // User did not leave their focus.
      state.idleStartTimestamp = 0;
      await writeState(state);
      return;
    }
  }
  throw new Error(`Unknown notification: ${notificationId}`);
});

chrome.idle.setDetectionInterval(idleDetectionSeconds);
chrome.idle.onStateChanged.addListener(async (newState) => {
  const state = await getState();
  if (newState === 'active') {
    return;
  } else if (newState === 'idle') {
    // Ask the user if they are still here and give them the option to retroactively leave their focus time.
    if (state.inFocus && !state.idleStartTimestamp) {
      state.idleStartTimestamp = Date.now();
      await writeState(state);
      notifyOfIdleDetection();
      return;
    }
    return;
  } else if (newState === 'locked') {
    // Cancel if machine is locked while in focus.
    if (state.inFocus) {
      leaveFocus();
      notifyOfAutocancel();
    }
    return;
  }
  throw new Error(`Unknown idle state: ${newState}`);
});
