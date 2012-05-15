var options = {
    isEnabledTimedChecks: true,
    maxChecksForNew: 60,
    frequencyChecksForNew: 60,
    nextPageDelay: 1
};
$.extend(options, {
    isEnabledTimedChecks: localStorage["_habr.more.isEnabledTimedChecks"],
    maxChecksForNew: localStorage["_habr.more.maxChecksForNew"],
    frequencyChecksForNew: localStorage["_habr.more.frequencyChecksForNew"],
    nextPageDelay: localStorage["_habr.more.nextPageDelay"]
});

// Saves options to localStorage.
$(document).on('submit', '#habr-more-settings', function(){
    $(this.elements).each(function(){
        if (!this.name) {
            return;
        }
        var value = this.value;
        if ($(this).is(":checkbox")) {
            value = this.checked;
        }
        localStorage['_habr.more.' + this.name] = value;
    });
    $(".habr-more-save").attr("disabled", true);
    $(".habr-more-save-ok").show();
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
            this.checked = options[this.name] !== 'false';
        } else {
            this.value = options[this.name];
        }
    });
}
