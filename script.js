var MAX_CHECKS_FOR_NEW_POSTS = 60; // times, to not waste traffic if user is AFK. Counts only timered checks. Doesn't count checks when user scrolls to top.
var CHECK_FOR_NEW_POSTS_EACH = 60; // seconds

$(function () {
	prepareAdvancedNextPageLink();
	startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS);
});

function startCheckingNewPosts(limit) {
	window.limitChecks = limit;
	clearInterval(window.checkNewPostsTimer);
	window.checkNewPostsTimer = setInterval(function () {
		window.limitChecks--;
		if (window.limitChecks < 0) {
			// self-destroy timer
			clearInterval(window.checkNewPostsTimer);
		} else {
			checkForNewPosts();
		}
	}, CHECK_FOR_NEW_POSTS_EACH * 1000);
}

function checkForNewPosts(andLoadThem) {
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
            var newPosts = getPostIds(response).diff(getPostIds());
            setNewTopicsCount(newPosts.length); // выставляем бэйджик
            if (andLoadThem && newPosts.length) {
                addNewPosts(newPosts, response);
            }
        }
    });
}

function addNewPosts(postIds, fromHTML) {
    for (var i = postIds.length - 1; i >= 0; i--) {
        $(".posts").prepend($("#" + postIds[i], fromHTML));
    }
    $(".new-posts").remove();
    Tinycon.setBubble(0);
    startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS); // пролонгируем лимит проверки, поскольку юзер жив
}

function setNewTopicsCount(count) {
    if (count <= 0) {
        $(".new-posts").remove();
        Tinycon.setBubble(0);
        return;
    }
    var counterSpan = $(".new-posts .count");
    var topics = count > 1 ? count > 4 ? "записей" : "записи" : "запись"; // works till 20 only, but there won't be more
    var tsya = count > 1 ? "лись" : "лась";
    if (counterSpan.length) {
        counterSpan.html(count + ' ' + topics);
        $(".new-posts .tsya").html(tsya);
    } else {
        $(".posts").prepend(
            '<div id="global_notify" class="new-posts"><div class="inner">Пока вы читали, на этой странице появи<span class="tsya">' + tsya + '</span> еще ' +
                '<a class="count" href="#load">' + count + ' ' + topics + '</a></div></div>'
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

$(document).on("click", ".new-posts a.count", function () {
    checkForNewPosts(true);
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
                $(".posts").append($(response).find(".posts").html()); // добавляем посты в конец списка
                $(".page-nav").html($(".page-nav", response).html()); // и заменяем ссылки туда/сюда/страницы на новые
                prepareAdvancedNextPageLink();
                stopTrackingScrollToBottom = false; // описание флага будет ниже
            }
        });
    }, 1000); // начать через 1 секунду, чтобы юзер мог успеть отменить
    return false;
});

$(document).on("click", ".next-prev .cancel", function () {
    // killScroll = false; // commented, so after user clicked "stop" scroll won't activate it again, unless after user click "load more" manually
    clearTimeout(window.morePostsCounter);
    $(".next-prev").removeClass("started");
});

function prepareAdvancedNextPageLink() {
    var nextPageLink = $("#next_page").attr("href");
    if (!nextPageLink) {
        // нечего делать если ссылки нет (например это последняя страница)
        return;
    }
    $(".next-prev").append( // добавляем скрытый блок с аякс крутилкой и кнопкой отмены
        '<li class="more-posts">' +
            '<span class="buttons" style="background-image: url('+ chrome.extension.getURL('images/ajax.gif') + ')">' +
                '<input type="submit" class="cancel btn btn-big" value="Стой, дальше не надо"/>' +
            '</span>' +
        '</li>'
    );
}

var stopTrackingScrollToBottom = false;
$(window).scroll(function () {
    if ($(window).scrollTop() + 10 >= ($(document).height() - ($(window).height()))) { // за 10 пикселов до конца страницы
        if (stopTrackingScrollToBottom == false) { // проверяем не инициирован ли уже процесс дозагрузки
            stopTrackingScrollToBottom = true; // отключаем этот уловитель скролла на время дозагрузки
            $("#next_page").click(); // кликаем ссылку "Туда"
        }
    }
    if ($(window).scrollTop() == 0) { // юзер доскроллил до начала странцы
        startCheckingNewPosts(MAX_CHECKS_FOR_NEW_POSTS); // пролонгируем лимит проверки, поскольку юзер жив
        checkForNewPosts();
    }
});

// Canel autoload if <Esc> pressed
$(document).keyup(function (e) {
    if (e.keyCode == 27) { // esc
        $('.more-posts .cancel').click();
    }
});
