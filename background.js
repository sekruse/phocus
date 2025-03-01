const state = {
  "inFocus": false,
  "focusStartTimestamp": 0,
  "focusTimes": [],
  "totalFocusMillis": 0,
};

const commands = {
  "get_state": function(args) {
    return state;
  },
  "toggle_focus": function(args) {
    if (state.inFocus) {
      state.inFocus = false;
      const stopTimestamp = state.focusStartTimestamp;
      state.focusTimes.push({ start: state.focusStartTimestamp, stop: stopTimestamp });
      state.totalFocusMillis += stopTimestamp - state.focusStartTimestamp;
      state.focusStartTimestamp = 0;
    } else {
      state.inFocus = true;
      state.focusStartTimestamp = Date.now();
    }
    return state;
  },
};
  
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(`Received request: ${request}`);
    const impl = commands[request.command];
    if (!impl) {
      throw new Error(`Undefined command in ${request}.`);
    }
    const response = impl(request.args);
    sendResponse(response);
    return true;
  }
);
