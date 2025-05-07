import { UserException } from './utils.js';

let stateCache = null;
const defaultState = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "focusStopTimestamp": 0,
  "idleStartTimestamp": 0,
  "activeStartTimestamp": 0,
  "nextAlarmTimestamp": 0,
  "nextHistoryId": 0,
};

async function getState() {
  if (stateCache === null) {
    const { state: loadedState } = await chrome.storage.local.get(['state']);
    stateCache = {...defaultState, ...loadedState};
  }
  return stateCache;
}

function writeState(state=stateCache) {
  const result = chrome.storage.local.set({ state });
  notifyStateChanged(state);  // fire and forget
  return result;
}

const stateChangeSubscribers = [];
function notifyStateChanged(state=stateCache) {
  stateChangeSubscribers.forEach((subscriber) => subscriber(state));
  chrome.runtime.sendMessage({
    event: 'state_changed',
    state: state,
  });
}

let historyCache = null;

async function getHistory() {
  if (historyCache === null) {
    const storageKeys = await chrome.storage.local.getKeys();
    if (!storageKeys.includes('history')) {
      historyCache = [];
      return historyCache;
    }
    const { history } = await chrome.storage.local.get(['history']);
    historyCache = history;
  }
  return historyCache;
}

async function writeHistory() {
  if (historyCache === null) {
    throw new Error('historyCache is not loaded.');
  }
  const result = await chrome.storage.local.set({ history: historyCache });
  notifyHistoryChanged();  // fire and forget
  return result;
}

function notifyHistoryChanged() {
  return chrome.runtime.sendMessage({
    event: 'history_changed',
  });
}

let optionsCache = null;
const defaultOptions = {
  "focusGoalMinutes": 25,
  "snoozeMinutes": 10,
  "idleDetectionSeconds": 120,
  "spilloverHours": 4,
};

async function getOptions() {
  if (optionsCache === null) {
    const { options: loadedOptions } = await chrome.storage.local.get(['options']);
    optionsCache = {...defaultOptions, ...loadedOptions};
  }
  return optionsCache;
}

function vetOptions(options) {
  if (!Number.isInteger(options.focusGoalMinutes)) {
    throw new UserException(`Focus goal minutes should be an integer, is ${options.focusGoalMinutes}`);
  }
  if (!(options.focusGoalMinutes > 0 && options.focusGoalMinutes <= 240)) {
    throw new UserException(`Focus goal minutes should be between 0 and 240, is ${options.focusGoalMinutes}`);
  }
  if (!Number.isInteger(options.snoozeMinutes)) {
    throw new UserException(`Snooze minutes should be an integer, is ${options.focusGoalMinutes}`);
  }
  if (!(options.snoozeMinutes > 0 && options.snoozeMinutes <= 60)) {
    throw new UserException(`Snooze minutes should be between 0 and 60, is ${options.snoozeMinutes}`);
  }
  if (!Number.isInteger(options.idleDetectionSeconds)) {
    throw new UserException(`Idle detection seconds should be an integer, is ${options.idleDetectionSeconds}`);
  }
  if (!(options.idleDetectionSeconds > 0 && options.idleDetectionSeconds <= 1800)) {
    throw new UserException(`Idle detection seconds should be between 0 and 1800, is ${options.idleDetectionSeconds}`);
  }
  if (!Number.isInteger(options.spilloverHours)) {
    throw new UserException(`Spillover hours should be an integer, is ${options.spilloverHours}`);
  }
  if (!(options.spilloverHours >= 0 && options.spilloverHours <= 23)) {
    throw new UserException(`Spillover hours should be between 0 and 23, is ${options.spilloverHours}`);
  }
};

async function writeOptions(options) {
  return chrome.storage.local.set({ options });
}

async function setOptions(newOptions) {
  vetOptions(newOptions);
  const options = await getOptions();
  options.focusGoalMinutes = newOptions.focusGoalMinutes;
  options.snoozeMinutes = newOptions.snoozeMinutes;
  options.idleDetectionSeconds = newOptions.idleDetectionSeconds;
  options.spilloverHours = newOptions.spilloverHours;
  await writeOptions(options);
  return options;
}

async function resetStorage() {
  stateCache = null;
  historyCache = null;
  optionsCache = null;
  await chrome.storage.local.clear();
  notifyStateChanged(await getState());
  notifyHistoryChanged();
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

async function setNotes(notes) {
  const state = await getState();
  state.notes = notes || undefined;
  await writeState();
}

async function enterFocus(args) {
  const state = await getState();
  if (state.inFocus) {
    return state;
  }
  let startTimestamp;
  if (args?.startTimestamp) {
    startTimestamp = args.startTimestamp;
  } else if (args?.startEvent) {
    if (args.startEvent === 'since_active') {
      if (!state.activeStartTimestamp) {
        throw new UserException('No start timestamp recorded since when the computer has been active. Cannot record focus time since then.');
      }
      startTimestamp = state.activeStartTimestamp;
    } else {
      throw new Error(`Unknown startEvent: ${args.startEvent}`);
    }
  } else {
    startTimestamp = Date.now();
  }
  const history = await getHistory();
  if (history.length > 0) {
    history.sort((a, b) => a.stopTimestamp - b.stopTimestamp);
    const latestEntry = history[history.length-1];
    if (startTimestamp < latestEntry.stopTimestamp) {
      throw new UserException(`Latest history entry ending at ${new Date(latestEntry.stopTimestamp)} precedes start timestamp at ${new Date(startTimestamp)}.`);
    }
  }
  state.focusStartTimestamp = startTimestamp;
  state.inFocus = true;
  state.nextAlarmTimestamp = state.focusStartTimestamp + (focusGoalMinutes * 60000);
  state.idleStartTimestamp = 0;
  state.focusStopTimestamp = 0;
  chrome.alarms.create(updateAlarmName, alarmConfig);
  await writeState();
  return state;
}

async function leaveFocus(stopTimestamp = Date.now()) {
  const state = await getState();
  if (!state.inFocus) {
    return state;
  }
  const startTimestamp = state.focusStartTimestamp;
  state.inFocus = false;
  state.focusStartTimestamp = 0;
  state.nextAlarmTimestamp = 0;
  state.idleStartTimestamp = 0;
  state.focusStopTimestamp = stopTimestamp;
  await addHistoryEntry({
    startTimestamp: startTimestamp,
    stopTimestamp: stopTimestamp,
    notes: state.notes || '',
  });
  return state;
}

async function resumeFocus() {
  const state = await getState();
  if (state.inFocus) {
    throw new UserException('Already in focus. Cannot resume the previous focus block.');
  }
  const history = await getHistory();
  if (!history) {
    throw new UserException('No history, cannot resume previous focus block.');
  }
  history.sort((a, b) => a.stopTimestamp - b.stopTimestamp);
  const latestEntry = history[history.length-1];
  await deleteFromHistory(latestEntry);
  await enterFocus({ startTimestamp: latestEntry.startTimestamp });
}

async function listHistory(filter) {
  const history = await getHistory();
  return history.filter((entry) => {
    // The negation allows for undefined filters properties to have no effect.
    return !(filter.fromTimestamp > entry.stopTimestamp) && !(filter.untilTimestamp < entry.startTimestamp);
  }).toSorted((a, b) => {
    return a.startTimestamp - b.startTimestamp
  });
}

async function addHistoryEntry(entry) {
  if (!Number.isInteger(entry.startTimestamp)) {
    throw new UserException(`Bad start timestamp: ${entry.startTimestamp}`);
  }
  if (!Number.isInteger(entry.stopTimestamp)) {
    throw new UserException(`Bad stop timestamp: ${entry.stopTimestamp}`);
  }
  if (entry.startTimestamp >= entry.stopTimestamp) {
    throw new UserException(`Start time before stop time: ${new Date(entry.startTimestamp)}, ${new Date(entry.stopTimestamp)}`);
  }
  // TODO - This code has quite some overlap with leaveFocus().
  const state = await getState();
  const history = await getHistory();
  const newEntry = {
    id: state.nextHistoryId++,
    version: 0,
    startTimestamp: entry.startTimestamp,
    stopTimestamp: entry.stopTimestamp,
    notes: entry.notes,
  };
  history.push(newEntry);
  await writeState();
  await writeHistory();
}


async function updateHistoryEntry(entry) {
  const history = await getHistory();
  const state = await getState();
  const index = history.findIndex((e) => e.id === entry.id);
  if (index === -1) {
    throw new UserException(`No recorded focus block with that ID: ${JSON.stringify(entry)}`);
  }
  const e = history[index];
  if (e.version !== entry.version) {
    throw new UserException(`Versions don't match: Recorded focus block is ${JSON.stringify(e)}, provided block is ${JSON.stringify(entry)}`);
  }
  if (entry.startTimestamp === undefined) {
    entry.startTimestamp = e.startTimestamp;
  } else if (!Number.isInteger(entry.startTimestamp)) {
    throw new UserException(`Bad start timestamp: ${entry.startTimestamp}`);
  }
  if (entry.stopTimestamp === undefined) {
    entry.stopTimestamp = e.stopTimestamp;
  } else if (!Number.isInteger(entry.stopTimestamp)) {
    throw new UserException(`Bad stop timestamp: ${entry.stopTimestamp}`);
  }
  if (entry.startTimestamp >= entry.stopTimestamp) {
    throw new UserException(`Start time before stop time: ${new Date(entry.startTimestamp)}, ${new Date(entry.stopTimestamp)}`);
  }
  e.startTimestamp = entry.startTimestamp;
  e.stopTimestamp = entry.stopTimestamp;
  e.notes = entry.notes;
  e.version++;
  await writeHistory();
}

async function deleteFromHistory(entry) {
  const history = await getHistory();
  const state = await getState();
  let index = history.findIndex((e) => e.id === entry.id);
  if (index === -1) {
    throw new UserException(`No recorded focus block with that ID: ${JSON.stringify(entry)}`);
  }
  const e = history[index];
  if (e.version !== entry.version) {
    throw new UserException(`Versions don't match: Recorded focus block is ${JSON.stringify(e)}, provided block is ${JSON.stringify(entry)}`);
  }
  history.splice(index, 1);
  await writeHistory();
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
stateChangeSubscribers.push((newState) => {
  updateBadge();
});

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
stateChangeSubscribers.push((newState) => {
  if (!newState.inFocus) {
    chrome.notifications.clear(focusGoalNotificationName);
  }
});

async function notifyOfAutocancel() {
  await chrome.notifications.create(lockedNotificationName, {
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: 'Phocus',
    message: 'Your focus time was cancelled when you locked your computer.',
    requireInteraction: false,
  });
}
stateChangeSubscribers.push((newState) => {
  if (newState.inFocus) {
    chrome.notifications.clear(lockedNotificationName);
  }
});

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
stateChangeSubscribers.push((newState) => {
  if (!newState.inFocus) {
    chrome.notifications.clear(idleNotificationName);
  }
});

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
  "set_notes": async function(args) {
    return setNotes(args);
  },
  "enter_focus": async function(args) {
    return enterFocus(args);
  },
  "leave_focus": async function(args) {
    return leaveFocus();
  },
  "resume_focus": async function(args) {
    return resumeFocus();
  },
  "list_history": async function(args) {
    return listHistory(args);
  },
  "add_history_entry": async function(args) {
    return addHistoryEntry(args);
  },
  "update_history_entry": async function(args) {
    return updateHistoryEntry(args);
  },
  "delete_from_history": async function(args) {
    return deleteFromHistory(args);
  },
  "get_options": async function(args) {
    return getOptions();
  },
  "set_options": async function(args) {
    return setOptions(args.options);
  },
  "reset_storage": async function(args) {
    return resetStorage();
  },
};
  
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const impl = commands[request.command];
  if (!impl) {
    throw new Error(`Unknown command in ${JSON.stringify(request)}.`);
  }
  impl(request.args)
    .catch(err => {
      sendResponse({
        success: false,
        error: {
          name: err.name,
          message: err.message,
        },
      })
    })
    .then(result => {
      sendResponse({
        success: true,
        result: result,
      })
    });
  return true;
});

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
    state.activeStartTimestamp = Date.now();
    await writeState(state);
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
