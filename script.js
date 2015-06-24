var stopTrackingScrollEvent = false;

function onSettingsLoadedCallback() {
	prepareAdvancedNextPageLink();
	if (extensionOptions.appendSideSearch) {
		appendSideSearch();
	}
	scheduleCheckingNewPosts(extensionOptions.maxChecksForNew);
	if (extensionOptions.getScoreForAllPosts) {
		getScoreForAllPosts();
	}

	var $footerBlocks = $('.rotated_posts:visible, .bottom_promo_blocks:visible, .footer_panel:visible');
	if ($footerBlocks.length) {
		var showText = '&darr;&nbsp;Посмотреть&nbsp;футер';
		var hideText = '&uarr;&nbsp;Спрятать&nbsp;футер';
		$('<a href="#toggle-footer" class="toggle-footer">' + showText + '</a><div class="clear"></div>').insertBefore($footerBlocks.first());
		$('<div id="hidden-footer" class="hidden"></div>').insertBefore(".footer_panel");
		$footerBlocks.appendTo('#hidden-footer');

		$('.toggle-footer').click(function () {
			stopTrackingScrollEvent = true;
			var footer = $('#hidden-footer');
			footer.toggleClass('hidden');
			var is_hidden = footer.hasClass('hidden');
			$('.toggle-footer').html(is_hidden ? showText : hideText);
			setTimeout(function () {
				stopTrackingScrollEvent = false;
			}, 100);

			$(window).scrollTop(9999999);
			return false;
		});
	}

	$(document).on("click", "#next_page", function () {
		if (stopTrackingScrollEvent) {
			return;
		}
		stopTrackingScrollEvent = true; // отключаем этот уловитель скролла на время дозагрузки
		var nextPrevBlock = $(".next-prev"); // блок с кнопками Сюда/Туда
		nextPrevBlock.addClass("started"); // флаг начала процесса дозагрузки
		toggleSpinning(true, true);
		var href = $(this).attr("href"); // ссылка кнопки Туда
		window.morePostsCounter = setTimeout(function () {
			$.ajax({
				url: href,
				complete: function () {
					nextPrevBlock.removeClass("started"); // убираем флаг
					toggleSpinning(false, true);
				},
				success: function (response) {
					if (!nextPrevBlock.hasClass("started")) {
						// Пользователь успел отменить до ответа, но после запроса.
						return;
					}

					$([
						".comments_list", // догружаем комментарии /users/boomburum/comments/
						".posts:not(.events_list)", // догружаем посты (большинство страниц)
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
				$("#new-posts > div").append(
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
	toggleSpinning(true);
	$.ajax({
		url: window.location.href,
		complete: function () {
			toggleSpinning(false);
		},
		success: function (response) {
			$("#posts-check-now").removeAttr("disabled");
			// Находим все айдишники постов на текущей странице и сравниваем с айишниками в ответе
			var oldPostIds = getPostIds();
			var newPostIds = getPostIds(response).diff(oldPostIds);
			updateOldPosts(oldPostIds, response); // раз уж загрузили свежие версии старых постов обновим их на текущей странице
			addNewPostsAsHidden(newPostIds, response);
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
	if (extensionOptions && extensionOptions.getScoreForAllPosts) {
		getScoreForAllPosts();
	}
	setNewTopicsCount(getHiddenNewPosts().length); // перевыставляем бэйджик
}

function setNewTopicsCount(count) {
	if (count <= 0) {
		$("#new-posts").remove();
		Tinycon.setBubble(0);
		return;
	}
	var counterSpan = $("#new-posts .count");
	var topics = count > 1 ? count > 4 ? "записей" : "записи" : "запись"; // works till 20 only :(
	var tsya = count > 1 ? "лись" : "лась";
	if (counterSpan.length) {
		counterSpan.html(count + ' ' + topics);
		$("#new-posts .tsya").html(tsya);
	} else {
		var settingsLink = chrome.extension.getURL("options.html");
		if (getUsername()) {
			settingsLink = "http://habrahabr.ru/settings/more/"
		}
		$(".posts").prepend(
			'<div id="new-posts">' +
			'<div>' +
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

$(document).on("click", "#new-posts .expand", function () {
	scheduleCheckingNewPosts(extensionOptions.maxChecksForNew); // пролонгируем лимит проверки, поскольку юзер жив
	var newPosts = getHiddenNewPosts();
	$(".loaded-before").remove(); // удаляем предыдущий разделитель
	newPosts.show().last().after('<p class="loaded-before">Загруженные ранее:</p>');
	setNewTopicsCount(0);
	return false;
});

$(document).on("click", ".next-prev .cancel", function () {
	stopTrackingScrollEvent = false;
	clearTimeout(window.morePostsCounter);
	$(".next-prev").removeClass("started");
	toggleSpinning(false, true);
	return false;
});

function toggleSpinning(spin, bottom_icon) {
	var $icon = $('#navbar .g-icon-gear');
	if (!bottom_icon || !$icon.length) {
		$icon = $("#navbar .g-icon-burger");
	}
	$icon.toggleClass('spinning', spin);
}

function prepareAdvancedNextPageLink() {
	var nextPageLink = $("#next_page").attr("href");
	if (!nextPageLink) {
		// нечего делать если ссылки нет (например это последняя страница)
		return;
	}
	$(".next-prev").append(// добавляем скрытый блок с аякс крутилкой и кнопкой отмены
		'<li class="more-posts">' +
		'<span class="buttons">' +
		'<input type="submit" class="cancel btn btn-big" value="Стой, дальше не надо"/>' +
		'</span>' +
		'</li>'
	);
}

function appendSideSearch() {
	var $sidebar = $('.sidebar_right:visible');
	if (!$sidebar.length) {
		return;
	}
	var width = $sidebar.width() - 15;
	if (width <= 0) {
		return;
	}
	console.log(width);
	$(".page_head").prepend(
		'<form action="/search/" method="get" class="side_search_form inner_search_form">'+
		'<input type="text" name="q" placeholder="Поиск">' +
		'</form>'
	);
	$('.side_search_form input').width(width);
}

$(window).scroll(function () {
	if ($(window).scrollTop() + 10 >= ($(document).height() - ($(window).height()))) { // за 10 пикселов до конца страницы
		$("#next_page").click(); // кликаем ссылку "Туда"
	}
	if ($(window).scrollTop() == 0) { // юзер доскроллил до начала странцы
		if (extensionOptions) {
			scheduleCheckingNewPosts(extensionOptions.maxChecksForNew); // пролонгируем лимит проверки, поскольку юзер жив
		}
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

function getScoreForAllPosts() {

	var sctipt = document.createElement("script");
	sctipt.innerHTML = '$(".infopanel .score[onclick]").each(function(i){ var self = this; setTimeout(function(){ $(self).click().prop("onclick", "") }, i * 500) })';
	document.head.appendChild(sctipt);

}
