

/* eslint-disable */

class AppShell extends BaseComponent {
    // Todo: We need to have a standard icon system, that fusion recognizes

    // Set document.title to this.data.brandInfo.name

    constructor(data, node) {
        super(data, node);
        this.utils = new AppShellUtils();
        this.data.config = this.utils.mergeDeep(this.data.config, this.getConfigParams());
        this.mocks = new Mocks();
        window.globals = this.data.globals;
        window.appShell = this;
    }

    getConfigParams() {
        return {
            state: {
                isAppShellReady: false,
            },
            activityStream: {
                currentToDate: null,
                listingContext: null,
                recursionCount: 0,
                recursionMax: 3,
            },
        };
    }

    render() {
        // Populate sidebar, while emitting required markup
        // for both desktop and mobile
        this.populateSidebar(['desktop', 'mobile']);

        const paceOptions = {
            restartOnRequestAfter: !1,
        };

        $(document).ajaxStart(() => {
            Pace.restart();
        });


        // Todo: Add MutationObserver for ce-translate

        Promise.resolve()
            .then(() => {
                $('body').show();
            }).then(
                Promise.all([
                    this.populateSupportedCountries(),
                    this.populateGlobalSearchLists(),
                    this.populateUserInformation(),
                ]),
            )
            .then(() => {
                this.populateActivityStream()
                    .then(() => {
                        initComponents();
                    })
                    .then(() => {
                        this.data.config.state.isAppShellReady = true;
                    });
            }, (err) => {
                console.log(err);
            });
    }

    populateUserInformation() {
        return new Promise((resolve, reject) => {
            $('#appshell-signout').on('click', () => {
                this.utils.removeCookie(this.data.config.fusion.sessionTokenCookie);
                window.location = '/';
            });
            this.mocks.getOwnAvatar().then((data) => {
                if (data.imageUrl !== null) {
                    $('#appshell-user-avatar').attr('src', data.imageUrl);
                }
            })
                .then(() => this.mocks.getPersonName())
                .then((data) => {
                    $('#appshell-user-name').html(data.name);
                    resolve();
                });
        });
    }

    populateGlobalSearchLists() {
        return new Promise((resolve, reject) => {
            this.mocks.getSearchableList().then((data) => {
                const menu = $('#appshell-search-list');
                for (const k in data) {
                    const v = data[k];
                    menu.append(`<div class="item" data-url="${v.listingPageUrl}"><img class="ui avatar image" src="${Object.keys(v).indexOf('icon') !== -1 ? v.icon : '/assets/images/no-image.png'}" alt="label-image" />${get_ce_translate_node(v.name)}</div>`);
                }
                menu.find('.item').on('click', function () {
                    window.location = `${$(this).attr('data-url')}?query=${$('#appshell-search-input').val()}`;
                });
                resolve();
            }), () => {
                reject('Error occured while getting searchable entites');
            };
        });
    }

    populateSupportedCountries() {
        return new Promise((resolve, reject) => {
            this.mocks.getAvailableCountries().then((data) => {
                const menu = $('#appshell-available-locales');
                for (const locale in data) {
                    const country = data[locale];
                    menu.append(`<a data-locale="${locale}" class="item"><i class="${country.name.toLowerCase()} flag"></i>${country.name}</a>`);
                }
                const _this = this;
                menu.find('.item').on('click', function () {
                    setCookie(_this.data.config.fusion.defaultLocaleCookie, $(this).attr('data-locale'), !0);
                    const currentLocation = window.location;
                    window.location = currentLocation;
                });
                resolve();
            }, () => {
                reject('Error occured while fetching available locales');
            });
        });
    }

    populateSidebarForDesktop() {
        const hierarchy = this.data.sidebar.hierarchy;
        const itemsData = this.data.sidebar.items;

        const container = $('.ui.sidebar');

        for (const item of hierarchy) {
            const itemTitle = document.createElement('div');
            itemTitle.className = 'title item';

            if (itemsData[item.id].icon) {
                this.appendNode(itemTitle, 'i', `ion-${itemsData[item.id].icon} titleIcon icon`);
            }
            this.appendNode(itemTitle, 'span', 'ce-translate-u').innerHTML = itemsData[item.id].title;
            this.appendNode(itemTitle, 'i', 'dropdown icon');

            const itemContent = document.createElement('div');
            itemContent.className = 'content';

            for (const subItem of item['>']) {
                const subItemLink = this.appendNode(itemContent, 'a', 'item');
                subItemLink.href = '/'; // Todo
                this.appendNode(subItemLink, 'span', 'ce-translate-u').innerHTML = itemsData[subItem].title;
            }
            container.find('> .ui.accordion.inverted')
                .append(itemTitle)
                .append(itemContent);
        }
    }

    populateSidebarForMobile() {
        const hierarchy = this.data.sidebar.hierarchy;
        const itemsData = this.data.sidebar.items;

        const container = $('.ui.sidebar');
        for (const item of hierarchy) {
            const itemContainer = this.appendNode(container[0], 'div', 'ui dropdown item displaynone scrolling');

            const itemTitle = this.appendNode(itemContainer, 'span');
            this.appendNode(itemTitle, 'span', 'ce-translate-u').innerHTML = itemsData[item.id].title;

            if (itemsData[item.id].icon) {
                this.appendNode(itemContainer, 'i', `ion-${itemsData[item.id].icon} icon`);
            }

            const menu = this.appendNode(itemContainer, 'div', 'menu');

            const header = this.appendNode(menu, 'div', 'header');
            this.appendNode(header, 'span', 'ce-translate-u').innerHTML = itemsData[item.id].title;

            this.appendNode(menu, 'div', 'ui divider');

            for (const subItem of item['>']) {
                const subItemLink = this.appendNode(menu, 'a', 'item');
                subItemLink.href = '/'; // Todo
                this.appendNode(subItemLink, 'span', 'ce-translate-u').innerHTML = itemsData[subItem].title;
            }
        }
    }

    populateSidebar(deviceTypes) {
        for (const deviceType of deviceTypes) {
            switch (deviceType) {
            case 'desktop':
                this.populateSidebarForDesktop();
                break;

            case 'mobile':
                this.populateSidebarForMobile();
                break;
            }
        }
    }

    populateActivityStream() {
        return new Promise((resolve, reject) => {
            console.log(JSON.stringify(this.data.config));

            if (!this.data.config.activityStream.canView) {
                // Remove Sidebar Container
                $('#appshell-activity-stream-sidebar').remove();
                // Remove Sidebar Drawer
                $('#appshell-activity-stream-toggle').remove();
                return;
            }

            // Populate activity stream timelines
            (() => {
                const timeslines = globals.activityStream.timelines;
                const timeslinesContainer = $('#appshell-activity-stream-timelines')[0];

                // Add label
                this.appendNode(timeslinesContainer, 'label').innerHTML = this.getTranslateNode('activity_timeline');

                // Add timelines
                for (const name in timelines) {
                    const value = timeslines[name];
                    const field = this.appendNode(timeslinesContainer, 'div', 'field');
                    const slider = this.appendNode(field, 'div', 'ui slider checkbox');
                    const input = this.appendNode(slider, 'input');
                    input.setAttribute('type', 'radio');
                    input.setAttribute('name', 'appshell-activity-stream-timeline');
                    input.setAttribute('value', `${value}`);
                    this.appendNode(slider, 'label').innerHTML = name;
                }

                // Add onchange listener
                const _this = this;
                $("input[name='appshell-activity-stream-timeline']").on('change', function () {
                    _this.mocks.setActivityStreamTimeline($(this).prop('value'));
                    _this.refreshActivityStream();
                });

                // Set value
                this.mocks.getActivityStreamTimeline().then((data) => {
                    $(`input[name='appshell-activity-stream-timeline'][value=${data.timeline}]`).prop('checked', true);
                    this.refreshActivityStream();
                });
            })();

            // Populate activity stream settings
            (() => {
                const settingsContainer = $('#appshell-activity-stream-settings');

                // Add label
                this.appendNode(settingsContainer, 'label').innerHTML = this.getTranslateNode('activity_stream_setting');

                // Add settings
                (() => {
                    const field = this.appendNode(settingsContainer, 'div', 'field');
                    const toggle = this.appendNode(field, 'div', 'ui toggle checkbox');
                    const input = this.appendNode(toggle, 'input');
                    input.setAttribute('type', 'checkbox');
                    input.setAttribute('name', 'appshell-activity-stream-enabled');
                    this.appendNode(toggle, 'label', 'coloring red').innerHTML = this.getTranslateNode('enabled');
                })();

                // Add onchange listener
                const _this = this;
                $("input[name='appshell-activity-stream-enabled']").on('change', function () {
                    const checked = $(this).prop('checked');
                    switch (checked) {
                    case true:
                        _this.mocks.enableActivityStream();
                        break;
                    case false:
                        _this.mocks.disableActivityStream();
                        break;
                    }
                });

                // Set value
                this.mocks.isActivityStreamEnabled().then((data) => {
                    $("input[name='appshell-activity-stream-enabled']")
                        .prop('checked', data.isEnabled === true);
                });
            })();

            resolve();
        });
    }

    refreshActivityStream() {
        this.data.config.activityStream.currentToDate = moment();
        $('#appshell-activity-stream-events > .event').remove();
        this.data.config.activityStream.listingContext = null;
        this.data.config.activityStream.recursionCount = 0;
        this.getNextActivityStream();
    }

    getNextActivityStream() {
        $('#appshell-activity-stream-next-container').hide();

        if (this.data.config.activityStream.recursionCount > this.data.config.activityStream.recursionMax) {
            console.log(`No activities were recorded in the past ${this.data.config.activityStream.recursionMax} ${this.getActivityStreamTimelineAsString()}`);
            $('#appshell-activity-stream-next-container').remove();
            return;
        }

        return Promise.resolve(new Promise((resolve, reject) => {
            if (this.data.config.activityStream.listingContext === null) {
                resolve(!1);
                return;
            }
            return this.mocks.hasListingCursor(globals.cursorMoveTypes.next, this.data.config.activityStream.listingContext).then(data => resolve(data));
        })).then((hasCurrentContext) => {
            switch (hasCurrentContext) {
            case true:
                console.log('Using existing activity timeline listing context');
                return {
                    contextKey: this.data.config.activityStream.listingContext,
                };
            case false:
                var nextTimeline = this.getNextActivityStreamTimeline();
                console.log(`Creating new listing context, for activity timeline: ${nextTimeline.from.fromNow()}  to  ${nextTimeline.to.fromNow()}`);
                return this.mocks.newListContext(4, 20, [{
                    filters: {
                        'date >': nextTimeline.from.format('YYYY-MM-DDTHH:mm:ss.SSS'),
                        'date <=': nextTimeline.to.format('YYYY-MM-DDTHH:mm:ss.SSS'),
                    },
                }], '-date');
            }
        }).then((data) => {
            const contextKey = data.contextKey;

            return this.mocks.hasListingCursor(globals.cursorMoveTypes.next, contextKey)
                .then((hasNext) => {
                    if (!hasNext) {
                        console.log('Timeline does not have any activity stream. Continuing to next timeline');
                        this.data.config.activityStream.recursionCount++;
                        return this.getNextActivityStream();
                    }

                    this.data.config.activityStream.listingContext = contextKey;
                    const container = $('#appshell-activity-stream-events');

                    return nextListingResults(globals.listingTypes.default.activityStream, contextKey).then((results) => {
                        for (const v of results) {
                            const now = moment(v.date);
                            const date = `${now.format('ddd, h:mm A')} (${now.fromNow()})`;
                            const html = v.html;
                            const image = v.subjectImageUrl ? v.subjectImageUrl : '/assets/images/no-image.png';
                            const div = `<div class="event"><div class="label"><img src="${image}" alt="label-image"></div><div class="content"><div class="summary">${html}.<div class="date">${date}</div></div></div></div>`;
                            container.append(div);
                        }
                        $('#appshell-activity-stream-next-container').show();
                    });
                });
        });
    }

    getNextActivityStreamTimeline() {
        const currentTimeline = parseInt($("input[name='appshell-activity-stream-timeline']:checked").attr('value'));
        const toDate = this.data.config.activityStream.currentToDate;
        let fromDate;
        switch (currentTimeline) {
        case 1:
            fromDate = moment(toDate).hour(toDate.hour() - 1);
            break;
        case 2:
            fromDate = moment(toDate).day(toDate.day() - 1);
            break;
        case 3:
            fromDate = moment(toDate).week(toDate.week() - 1);
            break;
        }
        this.data.config.activityStream.currentToDate = fromDate;
        return {
            from: fromDate,
            to: toDate,
        };
    }

    getActivityStreamTimelineAsString() {
        const currentTimeline = parseInt($("input[name='appshell-activity-stream-timeline']:checked").attr('value'));
        switch (currentTimeline) {
        case 1:
            return 'hours';
        case 2:
            return 'days';
        case 3:
            return 'weeks';
        }
    }

    getTranslateNode(text) {
        return `<span class="ce-translate">${text}</span>`;
    }
}

function ce_translate_page() {
    return new Promise((resolve, reject) => {
        const elements = new Map();
        const keys = {};
        $('.ce-translate').each((index) => {
            elements.set(index, this);
            keys[index] = $(this).text().trim();
        });
        getRbEntry(keys).then((data) => {
            for (const k in data) {
                const v = data[k];
                const elem = $(elements.get(parseInt(k)));
                if (elem.attr('class') === 'ce-translate') {
                    elem.replaceWith(v);
                } else {
                    elem.removeClass('ce-translate').text(v);
                }
            }
            resolve();
        }, () => {
            reject('Error while translating page');
        });
    });
}

let sideBarIsHide = !1;
let ManuelSideBarIsHide = !1;
let ManuelSideBarIsState = !1;
$('.openbtn').on('click', () => {
    ManuelSideBarIsHide = !0;
    if (!ManuelSideBarIsState) {
        resizeSidebar('1');
        ManuelSideBarIsState = !0;
    } else {
        resizeSidebar('0');
        ManuelSideBarIsState = !1;
    }
});
$(window).resize(() => {
    if (ManuelSideBarIsHide === !1) {
        if ($(window).width() <= 767) {
            if (!sideBarIsHide); {
                resizeSidebar('1');
                sideBarIsHide = !0;
                $('.colhidden').addClass('displaynone');
            }
        } else {
            if (sideBarIsHide); {
                resizeSidebar('0');
                sideBarIsHide = !1;
                $('.colhidden').removeClass('displaynone');
            }
        }
    }
});
const isMobile = window.matchMedia('only screen and (max-width: 768px)');
if (isMobile.matches) {
    resizeSidebar('1');
    $('.computer.only').toggleClass('displaynone');
    $('.colhidden').toggleClass('displaynone');
} else { }

function resizeSidebar(op) {
    if (op === '1') {
        $('.ui.sidebar.left').addClass('very thin icon');
        $('.navslide').addClass('marginlefting');
        $('.sidebar.left span').addClass('displaynone');
        $('.sidebar .accordion').addClass('displaynone');
        $('.ui.dropdown.item.displaynone').addClass('displayblock');
        $($('.logo img')[0]).addClass('displaynone');
        $($('.logo img')[1]).removeClass('displaynone');
        $('.hiddenCollapse').addClass('displaynone');
    } else {
        $('.ui.sidebar.left').removeClass('very thin icon');
        $('.navslide').removeClass('marginlefting');
        $('.sidebar.left span').removeClass('displaynone');
        $('.sidebar .accordion').removeClass('displaynone');
        $('.ui.dropdown.item.displaynone').removeClass('displayblock');
        $($('.logo img')[1]).addClass('displaynone');
        $($('.logo img')[0]).removeClass('displaynone');
        $('.hiddenCollapse').removeClass('displaynone');
    }
}

function toggleFullScreen(elem) {
    if ((document.fullScreenElement !== undefined && document.fullScreenElement === null) || (document.msFullscreenElement !== undefined && document.msFullscreenElement === null) || (document.mozFullScreen !== undefined && !document.mozFullScreen) || (document.webkitIsFullScreen !== undefined && !document.webkitIsFullScreen)) {
        if (elem.requestFullScreen) {
            elem.requestFullScreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullScreen) {
            elem.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    } else if (document.cancelFullScreen) {
        document.cancelFullScreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

function initComponents() {
    $('.ui.right.sidebar').sidebar({
        context: $('#contextWrap .pusher'),
        transition: 'slide out',
        silent: !0,
    }).sidebar('attach events', '.rightsidebar');
    $('.ui.dropdown').dropdown({
        allowCategorySelection: !0,
        transition: 'fade up',
    });
    $('.ui.accordion').accordion({
        selector: {},
    });
    $(document).ready(() => {
        $('.tabular .item').tab();
    });

    function paceLoading() {
        const paceOptions = {
            restartOnRequestAfter: !1,
        };
        $(document).ajaxStart(() => {
            Pace.restart();
        });
    }
    $('#total_users').progress({
        duration: 200,
        total: 200,
        percent: 45,
    });
    $('#overall_student_performance').progress({
        duration: 200,
        total: 200,
        percent: 68,
    });
    $('.counter').counterUp({
        delay: 60,
        time: 2000,
    });
}
