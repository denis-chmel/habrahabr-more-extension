var MAX_CHECKS_FOR_NEW_POSTS = 60; // times, to not waste traffic if user is AFK. Counts only timered checks. Doesn't count checks when user scrolls to top.
var CHECK_FOR_NEW_POSTS_EACH = 60; // seconds

$(function () {
    prepareAdvancedNextPageLink();
    startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS);
});

function startCheckingNewPosts(limit) {
    $("#warning-suspended-checks").remove();
    clearTimeout(window.checkNewPostsTimer); // должен существовать только один таймер
    window.checkNewPostsTimer = setTimeout(function () {
        checkForNewPosts(function () {
            if (limit > 0) {
                startCheckingNewPosts(limit - 1); // re-schedule itself
            } else {
                $(".new-posts .inner").append(
                    '<p id="warning-suspended-checks"><br>Автоматическая проверка приостановлена, поскольку вас не было около '
                        + Math.ceil(MAX_CHECKS_FOR_NEW_POSTS * CHECK_FOR_NEW_POSTS_EACH / 60) + " минут." + '</p>'
                );
            }
        });
    }, CHECK_FOR_NEW_POSTS_EACH * 1000);
}

function checkForNewPosts(afterCheckCallback) {
    if ($(".posts").length == 0) {
        // это вообще не страница с постами, уходим
        return;
    }
    $(".posts").prepend('<div class="new-posts-ajax"><img src="' + chrome.extension.getURL('images/ajax.gif') + '"/></div>');
    $.ajax({
        url:window.location.href,
        success:function (response) {
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
    for (var i = 0; i < oldPostIds.length; i++) {
        var newPost = $("#" + oldPostIds[i], fromHTML);
        if (newPost.length) {
            $("#" + oldPostIds[i]).html(newPost.html());
        }
    }
}

function addNewPostsAsHidden(postIds, fromHTML) {
    for (var i = postIds.length - 1; i >= 0; i--) {
        newPost = $("#" + postIds[i], fromHTML);
        newPost.hide(); // будут показаны когда юзер попросит
        $(".posts").prepend(newPost);
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
        $(".posts").prepend(
            '<div id="global_notify" class="new-posts"><div class="inner">' +
                'Пока вы читали, на этой странице появи<span class="tsya">' + tsya + '</span> еще ' +
                '<a class="count" href="#load">' + count + ' ' + topics + '</a>' + ' (<a href="#checknow" id="posts-check-now">проверить снова</a>)' +
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
    startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS); // пролонгируем лимит проверки, поскольку юзер жив
    checkForNewPosts();
    return false;
});

$(document).on("click", ".new-posts a.count", function () {
    startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS); // пролонгируем лимит проверки, поскольку юзер жив
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
                    ".posts", // догружаем посты (большинство страниц)
                    ".users", // юзеров на /users/
                    ".hubs_list .hubs", // блоги на /hubs/
                    ".companies", // /companies/
                    ".events_list" // события /events/coming/
                ]).each(function (key, value) {
                        $(value).append($(response).find(value).html());
                    });

                // сообщения в личке /users/%USERNAME%/mail/
                var nextPageRows = $(response).find(".inbox_page tbody");
                nextPageRows.find("th").closest("tr").remove(); // кроме tr с заголовками
                $(".inbox_page tbody").append(nextPageRows.html());

                // заменяем блок туда/сюда/пэйджинг на новый
                $(".page-nav").html($(".page-nav", response).html());
                prepareAdvancedNextPageLink();
                stopTrackingScrollEvent = false;
            }
        });
    }, 1000); // начать через 1 секунду, чтобы юзер мог успеть отменить
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
        startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS); // пролонгируем лимит проверки, поскольку юзер жив
        checkForNewPosts();
    }
});

// Cancel autoload next page if <Esc> pressed
$(document).keyup(function (e) {
    if (e.keyCode == 27) { // esc
        $('.more-posts .cancel').click();
    }
});
