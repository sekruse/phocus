const state = {
  "inFocus": false,
  "startTimestamp": 0,
};

const commands = {
  "get_state": function(args) {
    return state;
  },
  "toggle_focus": function(args) {
    if (state.inFocus) {
      state.inFocus = false;
    } else {
      state.inFocus = true;
      state.startTimestamp = Date.now();
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
