/**
 * Idiotic file, should be inline JS, but Chrome forbid inline JS in manifest v2
 * http://developer.chrome.com/extensions/contentSecurityPolicy.html
 */
function onSettingsLoadedCallback() {
	restoreOptions();
}
