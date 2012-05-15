var extensionOptions = null;

$(function () {
    chrome.extension.sendRequest({method: "getStoredOptionsJson"}, function(response) {
        storedOptions = JSON.parse(response);
        extensionOptions = {
            isEnabledTimedChecks: true,
            maxChecksForNew: 60,
            frequencyChecksForNew: 60,
            highlightUnreadQAAnswers: false,
            alwaysShowSubscribeCheckbox: false,
            hideSocialButtons: false,
            highlightTopicStarterComments: false,
            addMoreLinksToPersonalStuff: false,
            showKarma: false,
            nextPageDelay: 1
        };
        $.extend(extensionOptions, storedOptions);

        if (window.onSettingsLoadedCallback) {
            onSettingsLoadedCallback();
        }
    });
});

// Saves options to localStorage.
$(document).on('submit', '#habr-more-settings', function(){
    var newOptions = {};
    $(this.elements).each(function(){
        if (!this.name) {
            return;
        }
        var value = this.value;
        if ($(this).is(":checkbox")) {
            value = this.checked;
        }
        newOptions[this.name] = value;
    });
    chrome.extension.sendRequest({method: "setStoredOptionsJson", json: JSON.stringify(newOptions)}, function(response) {
        $(".habr-more-save").attr("disabled", true);
        $(".habr-more-save-ok").show();
    });
    return false;
});

$(document).on('click change keydown', '#habr-more-settings', function(){
    $(".habr-more-save").removeAttr("disabled");
    $(".habr-more-save-ok").hide();
});

// Restores saved values from localStorage.
function restoreOptions() {
    $("#habr-more-settings *[name]").each(function(){
        if ($(this).is(":checkbox")) {
            this.checked = extensionOptions[this.name];
        } else {
            this.value = extensionOptions[this.name];
        }
    });
}

function highlightTopicStarterComments() {
    var authorNickname = $(".author a:first").text(); // :first потому что некоторые имеют G+ второй ссылкой :-/ http://habrahabr.ru/post/143680/
    $('a.username').each(function() {
        if ($(this).text() === authorNickname) {
            $(this).closest(".info").addClass("topic-starter");
        }
    });
}
