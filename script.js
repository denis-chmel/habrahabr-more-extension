var currentExtensionId = chrome.extension.getURL('').match(/[a-z]{32}/)[0];

function onSettingsLoadedCallback() {
    addSectionToHabrSettings();
    prepareAdvancedNextPageLink();
    scheduleCheckingNewPosts(extensionOptions.maxChecksForNew);
    if (extensionOptions.highlightUnreadQAAnswers) {
        highlightUnreadQAAnswers();
    }
    if (extensionOptions.alwaysShowSubscribeCheckbox) {
        alwaysShowSubscribeCheckbox();
    }
    if (extensionOptions.hideSocialButtons) {
        hideSocialButtons();
    }
    if (extensionOptions.highlightTopicStarterComments) {
        highlightTopicStarterComments();
    }
    if (extensionOptions.showKarma) {
        showKarma(getUsername());
    }
    if (extensionOptions.addMoreLinksToPersonalStuff) {
        addMoreLinksToPersonalStuff(getUsername());
    }
    if (extensionOptions.getScoreForAllPosts) {
        getScoreForAllPosts();
    }
}

function addSectionToHabrSettings() {
    var isOnAjaxSettings = window.location.href.match(/\/settings\/more\//);
    if (window.location.href.match(/\/settings\//g)) {
        $("table.menu tr").append(
            '<td class="item ">' +
                '<a href="http://habrahabr.ru/settings/more/"><span class="name">More</span></a>' +
                '</td>'
        );
        if (isOnAjaxSettings) {
            $("table.menu td").removeClass("active").last().addClass("active");
            $(".user_settings").html('<img src="' + chrome.extension.getURL('images/ajax.gif') + '"/>');
            $.get('chrome-extension://' + currentExtensionId + '/options.html', null, function (response) {
                $(".user_settings").html($(response).find(".user_settings").html());
                restoreOptions();
            });
        }
    }
}

function scheduleCheckingNewPosts(limit) {
    if (!extensionOptions.isEnabledTimedChecks) {
        return;
    }
    $("#warning-suspended-checks").remove();
    clearTimeout(window.checkNewPostsTimer); // должен существовать только один таймер
    window.checkNewPostsTimer = setTimeout(function () {
        checkForNewPosts(function () {
            if (limit > 1) {
                scheduleCheckingNewPosts(limit - 1); // re-schedule itself
            } else {
                $(".new-posts .inner").append(
                    '<span id="warning-suspended-checks"><br>Проверка приостановлена, т.к. вас не было около '
                        + Math.ceil(extensionOptions.maxChecksForNew * extensionOptions.frequencyChecksForNew / 60) + " минут." + '</span>'
                );
            }
        });
    }, extensionOptions.frequencyChecksForNew * 1000);
}

function checkForNewPosts(afterCheckCallback) {
    $("#posts-check-now").attr("disabled", true);
    if ($(".posts").length == 0) {
        // это вообще не страница с постами, уходим
        return;
    }
    $(".posts").prepend('<div class="new-posts-ajax"><img src="' + chrome.extension.getURL('images/ajax.gif') + '"/></div>');
    $.ajax({
        url:window.location.href,
        success:function (response) {
            $("#posts-check-now").removeAttr("disabled");
            $(".new-posts-ajax").remove();
            // Находим все айдишники постов на текущей странице и сравниваем с айишниками в ответе
            var oldPostIds = getPostIds();
            var newPostIds = getPostIds(response).diff(oldPostIds);
            updateOldPosts(oldPostIds, response); // раз уж загрузили свежие версии старых постов обновим их на текущей странице
            addNewPostsAsHidden(newPostIds, response);
            stopTrackingScrollEvent = false;
            if (afterCheckCallback) afterCheckCallback();
        }
    });
}

function getHiddenNewPosts() {
    return $(".post:hidden");
}

function updateOldPosts(oldPostIds, fromHTML) {
    // iframe
    for (var i = 0; i < oldPostIds.length; i++) {
        var newPost = $("#" + oldPostIds[i], fromHTML);
        var oldPost = $("#" + oldPostIds[i]);
        if (oldPost.find("iframe").length) {
            // Не обновлять весь пост с видео-роликом, во избежание остановки плеера
            oldPost.find(".infopanel").html(newPost.find(".infopanel").html());
            continue;
        }
        if (newPost.length) {
            oldPost.html(newPost.html());
        }
    }
}

function addNewPostsAsHidden(postIds, fromHTML) {
    for (var i = postIds.length - 1; i >= 0; i--) {
        newPost = $("#" + postIds[i], fromHTML);
        newPost.hide(); // будут показаны когда юзер попросит
        $(".posts").prepend(newPost);
    }
    if (extensionOptions.getScoreForAllPosts) {
        getScoreForAllPosts();
    }
    setNewTopicsCount(getHiddenNewPosts().length); // перевыставляем бэйджик
}

function setNewTopicsCount(count) {
    if (count <= 0) {
        $(".new-posts").remove();
        Tinycon.setBubble(0);
        return;
    }
    var counterSpan = $(".new-posts .count");
    var topics = count > 1 ? count > 4 ? "записей" : "записи" : "запись"; // works till 20 only :(
    var tsya = count > 1 ? "лись" : "лась";
    if (counterSpan.length) {
        counterSpan.html(count + ' ' + topics);
        $(".new-posts .tsya").html(tsya);
    } else {
        var settingsLink = chrome.extension.getURL("options.html");
        if (getUsername()) {
            settingsLink = "http://habrahabr.ru/settings/more/"
        }
        $(".posts").prepend(
            '<div id="global_notify" class="new-posts">' +
                '<div class="inner">' +
                '<span class="buttons">' +
                '&nbsp;<input type="button" class="expand" value="Показать">' +
                '&nbsp;<input type="button" id="posts-check-now" class="preview" value="Проверить еще">&nbsp;' +
                '&nbsp;<a href="' + settingsLink + '" target="_blank"><img src="' + chrome.extension.getURL('images/settings.png') + '"></a>' +
                '</span>' +
                'Пока вы читали, на этой странице появи<span class="tsya">' + tsya + '</span> еще ' +
                '<span class="count">' + count + ' ' + topics + '</span>' +
                '</div></div>'
        );
    }
    // Add badge to the favicon
    Tinycon.setBubble(count);
}

function getPostIds(where) {
    var postIds = [];
    $(".post", where).each(function () {
        var postId = $(this).attr("id");
        postIds.push(postId);
    });
    return postIds;
}

Array.prototype.diff = function (a) {
    return this.filter(function (i) {
        return !(a.indexOf(i) > -1);
    });
};

$(document).on("click", "#posts-check-now", function () {
    scheduleCheckingNewPosts(extensionOptions.maxChecksForNew); // пролонгируем лимит проверки, поскольку юзер жив
    checkForNewPosts();
    return false;
});

$(document).on("click", ".new-posts .expand", function () {
    scheduleCheckingNewPosts(extensionOptions.maxChecksForNew); // пролонгируем лимит проверки, поскольку юзер жив
    var newPosts = getHiddenNewPosts();
    $(".loaded-before").remove(); // удаляем предыдущий разделитель
    newPosts.show().last().after('<p class="loaded-before">Загруженные ранее:</p>');
    setNewTopicsCount(0);
    return false;
});

$(document).on("click", "#next_page", function () {
    var nextPrevBlock = $(".next-prev"); // блок с кнопками Сюда/Туда
    nextPrevBlock.addClass("started"); // флаг начала процесса дозагрузки
    var href = $(this).attr("href"); // ссылка кнопки Туда
    window.morePostsCounter = setTimeout(function () {
        $.ajax({
            url:href,
            success:function (response) {
                if (!nextPrevBlock.hasClass("started")) {
                    // Пользователь успел отменить до ответа, но после запроса.
                    return;
                }
                nextPrevBlock.removeClass("started"); // убираем флаг

                $([
                    ".comments_list", // догружаем комментарии /users/boomburum/comments/
                    ".posts", // догружаем посты (большинство страниц)
                    ".users", // юзеров на /users/
                    ".hubs_list .hubs", // блоги на /hubs/
                    ".companies", // /companies/
                    ".events_list:not(.posts_list)" // события /events/coming/ (исключение :not для /feed/new/, где есть оба: class="posts_list events_list")
                ]).each(function (key, value) {
                    $(value).append($(response).find(value).html());
                });

                $([
                    ".tracker_comments tbody", // записи в трекере /tracker/
                    ".tracker_folowers tbody", // записи в трекере /tracker/subscribers/
                    ".tracker_mentions tbody", // записи в трекере /tracker/mentions/
                    ".inbox_page tbody" // сообщения в личке /users/%USERNAME%/mail/
                ]).each(function (key, value) {
                    var nextPageRows = $(response).find(value);
                    nextPageRows.find("th").closest("tr").remove(); // кроме tr с заголовками
                    $(value).append(nextPageRows.html());
                });

                if (extensionOptions.getScoreForAllPosts) {
                    getScoreForAllPosts();
                }

                // заменяем блок туда/сюда/пэйджинг на новый
                $(".page-nav").html($(".page-nav", response).html());
                prepareAdvancedNextPageLink();
                stopTrackingScrollEvent = false;
            }
        });
    }, 1000 * extensionOptions.nextPageDelay); // начать через N секунд, чтобы юзер мог успеть отменить
    return false;
});

$(document).on("click", ".next-prev .cancel", function () {
    // killScroll = false; // commented, so after user clicked "stop" scroll won't activate it again, unless after user click "load more" manually
    clearTimeout(window.morePostsCounter);
    $(".next-prev").removeClass("started");
    return false;
});

function prepareAdvancedNextPageLink() {
    var nextPageLink = $("#next_page").attr("href");
    if (!nextPageLink) {
        // нечего делать если ссылки нет (например это последняя страница)
        return;
    }
    $(".next-prev").append(// добавляем скрытый блок с аякс крутилкой и кнопкой отмены
        '<li class="more-posts">' +
            '<span class="buttons" style="background-image: url(' + chrome.extension.getURL('images/ajax.gif') + ')">' +
            '<input type="submit" class="cancel btn btn-big" value="Стой, дальше не надо"/>' +
            '</span>' +
            '</li>'
    );
}

var stopTrackingScrollEvent = false;
$(window).scroll(function () {
    if (stopTrackingScrollEvent) {
        return;
    }
    if ($(window).scrollTop() + 10 >= ($(document).height() - ($(window).height()))) { // за 10 пикселов до конца страницы
        stopTrackingScrollEvent = true; // отключаем этот уловитель скролла на время дозагрузки
        $("#next_page").click(); // кликаем ссылку "Туда"
    }
    if ($(window).scrollTop() == 0) { // юзер доскроллил до начала странцы
        stopTrackingScrollEvent = true; // отключаем этот уловитель скролла на время дозагрузки
        scheduleCheckingNewPosts(extensionOptions.maxChecksForNew); // пролонгируем лимит проверки, поскольку юзер жив
        checkForNewPosts();
    }
});

// Cancel autoload next page if <Esc> pressed
$(document).keyup(function (e) {
    if (e.keyCode == 27) { // esc
        $('.more-posts .cancel').click();
    }
});

function getUsername() {
    return $("#header .username").text();
}

function getQATopicId() {
    return window.location.href.match(/\/qa\/\d+\//g);
}

function highlightUnreadQAAnswers() {
    var qaTopic = getQATopicId();
    if (!qaTopic) {
        return;
    }
    var maxAnswerId = localStorage.getItem(qaTopic + "answer");
    var maxCommentId = localStorage.getItem(qaTopic + "comment");
    var userWasHereAlready = maxAnswerId !== null; // when something is cached already
    maxAnswerId = lastAnswerId = parseInt(maxAnswerId) || 0; // for correct int comparison below
    maxCommentId = lastCommentId = parseInt(maxCommentId) || 0; // parseInt(null) is NaN, using 0 instead

    $("div.answer > .info").each(function () {
        var id = parseInt($(this).attr("rel"));
        maxAnswerId = Math.max(id, maxAnswerId);
        if (userWasHereAlready && id > lastAnswerId) {
            $(this).addClass("is_new");
        }
    });
    $("div.comment_item").each(function () {
        var id = parseInt($(this).attr("id").replace(/comment_/, ''));
        maxCommentId = Math.max(id, maxCommentId);
        if (userWasHereAlready && id > lastCommentId) {
            $(this).addClass("is_new");
        }
    });
    localStorage.setItem(qaTopic + "answer", maxAnswerId);
    localStorage.setItem(qaTopic + "comment", maxCommentId);
}

function alwaysShowSubscribeCheckbox() {
    $(".infopanel").append($(".subscribe_comments"));
}

function hideSocialButtons() {
    $(".infopanel .twitter").hide();
    $(".infopanel .vkontakte").hide();
    $(".infopanel .facebook").hide();
    $(".infopanel .googleplus").hide();
}

function showKarma(username) {
    $.get('http://habrahabr.ru/api/profile/' + username + '/', null, function (response) {
        $("#charge_string").removeAttr("id").prepend(
            'Карма <span class="karma">' + $(response).find("karma").text() + '</span>' +
                ', рейтинг <span class="rating">' + $(response).find("rating").text() + '</span>. ');
    });
}

function addMoreLinksToPersonalStuff() {
    var username = getUsername();
    $("#header .bottom").append(
        '<a href="/users/' + username + '/topics/">топики</a>' +
            '<a href="/users/' + username + '/qa/questions/">вопросы</a>' +
            '<a href="/users/' + username + '/comments/">комментарии</a>'
    );
}

function getScoreForAllPosts() {
    $(".infopanel .score").click().prop("onclick", "");
}
