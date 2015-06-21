chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
	if (request.method == "getStoredOptionsJson") {
		sendResponse(localStorage.getItem('options'));
	}
	if (request.method == "setStoredOptionsJson") {
		localStorage.setItem('options', request.json);
		sendResponse({});
	}
});
