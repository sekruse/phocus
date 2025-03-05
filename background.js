let stateCache = null;
const defaultState = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "idleStartTimestamp": 0,
  "focusTimes": [],
  "totalFocusMillis": 0,
  "nextAlarmTimestamp": 0,
};

async function getState() {
  if (stateCache === null) {
    const { state: loadedState } = await chrome.storage.local.get();
    stateCache = {...defaultState, ...loadedState};
  }
  return stateCache;
}

async function writeState(state=stateCache) {
  return chrome.storage.local.set({ state });
}

let optionsCache = null;
const defaultOptions = {
  "focusGoalMinutes": 25,
  "snoozeMinutes": 10,
  "idleDetectionSeconds": 120,
};

async function getOptions() {
  if (optionsCache === null) {
    const { options: loadedOptions } = await chrome.storage.local.get(['options']);
    optionsCache = {...defaultOptions, ...loadedOptions};
  }
  return optionsCache;
}

function vetOptions(options) {
  if (!Object.hasOwn(options, 'focusGoalMinutes')) {
    throw new Error(`focusGoalMinutes are missing in ${options}`);
  }
  if (!(options.focusGoalMinutes > 0 && options.focusGoalMinutes <= 240)) {
    throw new Error(`focusGoalMinutes should be between 0 and 240, is ${options.focusGoalMinutes}`);
  }
  if (!Object.hasOwn(options, 'snoozeMinutes')) {
    throw new Error(`snoozeMinutes are missing in ${options}`);
  }
  if (!(options.snoozeMinutes > 0 && options.snoozeMinutes <= 60)) {
    throw new Error(`snoozeMinutes should be between 0 and 60, is ${options.snoozeMinutes}`);
  }
  if (!Object.hasOwn(options, 'idleDetectionSeconds')) {
    throw new Error(`idleDetectionSeconds are missing in ${options}`)
  }
  if (!(options.idleDetectionSeconds > 0 && options.idleDetectionSeconds <= 1800)) {
    throw new Error(`idleDetectionSeconds should be between 0 and 1800, is ${options.idleDetectionSeconds}`);
  }
};

async function writeOptions(options) {
  return chrome.storage.local.set({ options });
}

async function setOptions(newOptions) {
  vetOptions(newOptions);
  const options = getOptions();
  options.focusGoalMinutes = newOptions.focusGoalMinutes;
  options.snoozeMinutes = newOptions.snoozeMinutes;
  options.idleDetectionSeconds = newOptions.idleDetectionSeconds;
  await writeOptions(options);
  return options;
}

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
  chrome.notifications.clear(focusGoalNotificationName);
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
  "get_options": async function(args) {
    return getOptions();
  },
  "set_options": async function(args) {
    return setOptions(args.options);
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
      state.idleStartTimestamp = Date.now() - (idleDetectionSeconds * 1000);
      await writeState(state);
      notifyOfIdleDetection();
      return;
    }
    return;
  } else if (newState === 'locked') {
    // Cancel if machine is actively locked while in focus.
    // If there is a pending idle notification, the device was likely auto-locked,
    // so in that case we don't auto-cancel and wait for the user to return and
    // tell if they forgot to mark their focus time as over.
    if (state.inFocus && !state.idleStartTimestamp) {
      leaveFocus();
      notifyOfAutocancel();
    }
    return;
  }
  throw new Error(`Unknown idle state: ${newState}`);
});
