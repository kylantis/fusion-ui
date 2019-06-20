

/* eslint-disable */

class AppShell extends BaseComponent {
    // Todo: We need to have a standard icon system, that fusion recognizes

    // Todo: Set document.title to this.data.brandInfo.name

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

    getCssDependencies() {
        return super.getCssDependencies().concat([
            '/assets/css/transition.min.css', '/assets/css/accordion.min.css',
            '/assets/css/dropdown.min.css', '/assets/css/tab.min.css',
            '/assets/css/sidebar.min.css', '/assets/css/progress.min.css',
            '/assets/css/menu.min.css', '/assets/css/statistic.min.css',
            '/assets/css/input.min.css', '/assets/css/grid.min.css',
            '/assets/css/feed.min.css', '/assets/css/checkbox.min.css',
            '/assets/css/icon.min.css', '/assets/css/form.min.css',
            '/assets/css/button.min.css', '/assets/css/image.min.css',
            '/assets/css/label.min.css', '/assets/css/flag.min.css',
            '/assets/css/divider.min.css',

            // External deps
            'https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.0/css/ionicons.min.css',
            '/assets/css/app-shell.min.css'
        ]);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat([
            '/assets/js/transition.min.js', '/assets/js/accordion.min.js',
            '/assets/js/dropdown.min.js', '/assets/js/tab.min.js',
            '/assets/js/sidebar.min.js', '/assets/js/progress.min.js',
            '/assets/js/checkbox.min.js',
            // External deps
            'https://cdn.jsdelivr.net/npm/jquery.counterup@2/jquery.counterup.min.js',
            'https://cdn.jsdelivr.net/npm/waypoints@4/lib/jquery.waypoints.min.js',
            'https://cdn.jsdelivr.net/npm/pace-js@1/pace.min.js',
            //'https://cdn.jsdelivr.net/npm/jquery.nicescroll@3/jquery.nicescroll.min.js',
            'https://cdn.jsdelivr.net/npm/moment@2/moment.min.js'
        ]);
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

        // Todo: Update DOM for remaining hardcoded nodes

        // Todo: Replace ion icons with semantic one


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
                        this.loadWidgets();
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
                    menu.append(`<div class="item" data-url="${v.listingPageUrl}"><img class="ui avatar image" src="${Object.keys(v).indexOf('icon') !== -1 ? v.icon : '/assets/images/no-image.png'}" alt="label-image" />${this.getTranslateNode(v.name).outerHTML}</div>`);
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
            itemTitle.appendChild(this.getTranslateNode(itemsData[item.id].title));
            this.appendNode(itemTitle, 'i', 'dropdown icon');

            const itemContent = document.createElement('div');
            itemContent.className = 'content';

            for (const subItem of item['>']) {
                const subItemLink = this.appendNode(itemContent, 'a', 'item');
                subItemLink.href = '/'; // Todo
                subItemLink.appendChild(this.getTranslateNode(itemsData[subItem].title));
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
            itemTitle.appendChild(this.getTranslateNode(itemsData[item.id].title));

            if (itemsData[item.id].icon) {
                this.appendNode(itemContainer, 'i', `ion-${itemsData[item.id].icon} icon`);
            }

            const menu = this.appendNode(itemContainer, 'div', 'menu');

            const header = this.appendNode(menu, 'div', 'header');
            header.appendChild(this.getTranslateNode(itemsData[item.id].title));

            this.appendNode(menu, 'div', 'ui divider');

            for (const subItem of item['>']) {
                const subItemLink = this.appendNode(menu, 'a', 'item');
                subItemLink.href = '/'; // Todo
                subItemLink.appendChild(this.getTranslateNode(itemsData[subItem].title));
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

            if (!this.data.config.activityStream.canView) {

                // Remove Sidebar Container
                $('#appshell-activity-stream-sidebar').remove();
                // Remove Sidebar Drawer
                $('#appshell-activity-stream-toggle').remove();

                return resolve();
            }

            // Populate activity stream settings
            const addSettings = (() => {
                const settingsContainer = $('#appshell-activity-stream-settings')[0];

                // Add label
                this.appendNode(settingsContainer, 'label').innerHTML = this.getTranslateNode('activity_stream_setting').outerHTML;

                // Add settings
                (() => {
                    const field = this.appendNode(settingsContainer, 'div', 'field');
                    const toggle = this.appendNode(field, 'div', 'ui toggle checkbox');
                    const input = this.appendNode(toggle, 'input');
                    input.setAttribute('type', 'checkbox');
                    input.setAttribute('name', 'appshell-activity-stream-enabled');
                    this.appendNode(toggle, 'label', 'coloring red').innerHTML = this.getTranslateNode('enabled').outerHTML;
                })();

                // Add onchange listener
                const _this = this;
                $("input[name='appshell-activity-stream-enabled']").on('change', function () {
                    const checked = $(this).prop('checked');
                    switch (checked) {
                        case true:
                            _this.mocks.enableActivityStream();
                            // Todo: Determine what should be done here ?
                            break;
                        case false:
                            _this.mocks.disableActivityStream();
                            // Todo: Determine what should be done here ?
                            break;
                    }
                });

                // Set value
                return this.mocks.isActivityStreamEnabled().then((data) => {
                    $("input[name='appshell-activity-stream-enabled']")
                        .prop('checked', data.isEnabled === true);
                });
            })();

            // Populate activity stream timelines
            const addTimelines = (() => {
                const timelines = globals.activityStream.timelines;
                const timelinesContainer = $('#appshell-activity-stream-timelines')[0];

                // Add label
                this.appendNode(timelinesContainer, 'label').innerHTML = this.getTranslateNode('activity_timeline').outerHTML;

                // Add timelines
                for (const name in timelines) {
                    const value = timelines[name];
                    const field = this.appendNode(timelinesContainer, 'div', 'field');
                    const slider = this.appendNode(field, 'div', 'ui slider checkbox');
                    const input = this.appendNode(slider, 'input');
                    input.setAttribute('type', 'radio');
                    input.setAttribute('name', 'appshell-activity-stream-timeline');
                    input.setAttribute('value', `${value}`);
                    this.appendNode(slider, 'label').innerHTML = this.getTranslateNode(name).outerHTML;
                }

                // Add onchange listener
                const _this = this;
                $("input[name='appshell-activity-stream-timeline']").on('change', function () {
                    _this.mocks.setActivityStreamTimeline($(this).prop('value'));
                    _this.refreshActivityStream();
                });

                // Set value
                return this.mocks.getActivityStreamTimeline().then((data) => {
                    $(`input[name='appshell-activity-stream-timeline'][value=${data.timeline}]`).prop('checked', true);
                });
            })();

            Promise.all([addSettings, addTimelines]).then(() => {

                if ($("input[name='appshell-activity-stream-enabled']")
                    .prop('checked') === true) {
                    this.refreshActivityStream();
                } else {
                    this.notifyUserOfNoEvents();
                }
                resolve();
            });
        });
    }

    notifyUserOfNoEvents() {
        $('#appshell-activity-stream-container')
            .empty()
            .append($('<div style="font-size: 16px;line-height: 1em;">No timeline events available</div>'));
    }

    refreshActivityStream() {
        $('#appshell-activity-stream-container').empty();

        // Add events container
        const container = this.appendNode(
            $('#appshell-activity-stream-container')[0],
            'div', 'ui small feed'
        );
        container.setAttribute('id', 'appshell-activity-stream-events');

        // Add title
        this.appendNode(container, 'h4', 'ui header').innerHTML = this.getTranslateNode('activity_stream').outerHTML;

        this.data.config.activityStream.currentToDate = moment();
        this.data.config.activityStream.listingContext = null;
        this.data.config.activityStream.recursionCount = 0;

        this.getNextActivityStream();
    }

    addActivityStreamNextContainer() {
        const container = this.appendNode(
            $('#appshell-activity-stream-container')[0], 'div');
        container.setAttribute('id', 'appshell-activity-stream-next-container');
        this.appendNode(container, 'div', 'ui divider');
        const button = this.appendNode(container, 'button', 'ui mini button');
        button.setAttribute('id', 'appshell-activity-stream-next-button');
        button.innerHTML = this.getTranslateNode('show_more').outerHTML;
        $(button).on('click', () => {
            this.getNextActivityStream();
        });
    }

    removeActivityStreamNextContainer() {
        $('#appshell-activity-stream-next-button').remove();
        $('#appshell-activity-stream-next-container').remove();
    }

    getNextActivityStream() {

        this.removeActivityStreamNextContainer();

        if (this.data.config.activityStream.recursionCount > this.data.config.activityStream.recursionMax) {
            console.log(`No activities were recorded in the past ${this.data.config.activityStream.recursionMax} ${this.getActivityStreamTimelineAsString()}`);

            if (!$('#appshell-activity-stream-events > .event').size()) {
                this.notifyUserOfNoEvents();
            }
            return;
        }

        console.log('starting getNextActivityStream workflow..');

        return new Promise((resolve, reject) => {

            if (this.data.config.activityStream.listingContext === null) {
                return resolve(false);
            }

            console.log('Checking hasListingCursor for ctx: ' + this.data.config.activityStream.listingContext);
            this.mocks.hasListingCursor(globals.cursorMoveTypes.next, this.data.config.activityStream.listingContext).then(data => resolve(data));

        }).then((hasCurrentContext) => {
            console.log('hasContext: ' + hasCurrentContext);
            switch (hasCurrentContext) {
                case true:
                    console.log('Using existing activity timeline listing context');
                    return {
                        hasNext: true,
                        contextKey: this.data.config.activityStream.listingContext,
                    };
                case false:
                    var nextTimeline = this.getNextActivityStreamTimeline();
                    console.log(`Creating new listing context, for activity timeline: ${nextTimeline.from.fromNow()}  to  ${nextTimeline.to.fromNow()}`);

                    return this.mocks.newListContext(globals.listingTypes.default.activityStream, 20, [{
                        filters: {
                            'date >': nextTimeline.from.format('YYYY-MM-DDTHH:mm:ss.SSS'),
                            'date <=': nextTimeline.to.format('YYYY-MM-DDTHH:mm:ss.SSS'),
                        },
                    }], '-date')
            };

        }).then((data) => {
            const { contextKey } = data;
            if (!data.hasNext) {
                console.log('Checking hasListingCursor again since new context: ' + contextKey + ' was created');
            }
            return data.hasNext ? data : this.mocks.hasListingCursor(globals.cursorMoveTypes.next, contextKey).then((hasNext) => {
                return {
                    contextKey: contextKey,
                    hasNext
                }
            });

        }).then(({ hasNext, contextKey }) => {

            if (!hasNext) {
                console.log('Timeline does not have any activity stream. Continuing to next timeline');

                this.data.config.activityStream.recursionCount++;
                this.data.config.activityStream.listingContext = null;

                return this.getNextActivityStream();
            }

            this.data.config.activityStream.recursionCount = 0;
            this.data.config.activityStream.listingContext = contextKey;

            console.log('Fetching next result list ..');
            return this.mocks.nextListingResults(globals.listingTypes.default.activityStream, contextKey)
                .then((results) => {

                    const container = $('#appshell-activity-stream-events');

                    for (const v of results) {
                        const now = moment(v.date);
                        const date = `${now.format('ddd, h:mm A')} (${now.fromNow()})`;
                        const html = v.html;
                        const image = v.subjectImageUrl ? v.subjectImageUrl : '/assets/images/no-image.png';
                        const div = `<div class="event"><div class="label"><img src="${image}" alt="label-image"></div><div class="content"><div class="summary">${html}.<div class="date">${date}</div></div></div></div>`;
                        container.append(div);
                    }

                    this.addActivityStreamNextContainer();
                });
        });
    }

    getNextActivityStreamTimeline() {
        const currentTimeline = parseInt($("input[name='appshell-activity-stream-timeline']:checked").attr('value'));
        const toDate = this.data.config.activityStream.currentToDate;
        let fromDate;
        switch (currentTimeline) {
            case globals.activityStream.timelines.hourly:
                fromDate = moment(toDate).hour(toDate.hour() - 1);
                break;
            case globals.activityStream.timelines.daily:
                fromDate = moment(toDate).day(toDate.day() - 1);
                break;
            case globals.activityStream.timelines.weekly:
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
            case globals.activityStream.timelines.hourly:
                return 'hours';
            case globals.activityStream.timelines.daily:
                return 'days';
            case globals.activityStream.timelines.weekly:
                return 'weeks';
        }
    }

    getTranslateNode(text) {
        const elem = document.createElement('span');
        elem.className = 'ce-translate';
        elem.innerHTML = text;
        return elem;
    }

    ce_translate_page() {
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

    loadWidgets() {
        this.loadSidebar();
        this.initComponents();
        this.setupFullScreen();
    }

    loadSidebar() {

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

            // The sidebar scroll is a bit distortive due to its relatively
            // small height

            // $("body")
            //     .getNiceScroll()
            //     .remove();
            // $(".sidebar")
            //     .getNiceScroll()
            //     .remove();

            $('.computer.only').toggleClass('displaynone');
            $('.colhidden').toggleClass('displaynone');
            
        } else {

            // The sidebar scroll is a bit distortive due to its relatively
            // small height

            // $("body").niceScroll({
            //     cursorcolor: "#3d3b3b",
            //     cursorwidth: 5,
            //     cursorborderradius: 0,
            //     cursorborder: 0,
            //     scrollspeed: 50,
            //     autohidemode: true,
            //     zindex: 9999999
            // });

            // $(".sidebar").niceScroll({
            //     cursorcolor: "#3d3b3b",
            //     cursorwidth: 2,
            //     cursorborderradius: 0,
            //     cursorborder: 0,
            //     scrollspeed: 50,
            //     autohidemode: true,
            //     zindex: 9999999
            // });

            // $(".displaynone .menu").niceScroll({
            //     cursorcolor: "#3d3b3b",
            //     cursorwidth: 5,
            //     cursorborderradius: 0,
            //     cursorborder: 0,
            //     scrollspeed: 50,
            //     autohidemode: true,
            //     zindex: 9999999
            // });
        }

        // using context
        $('.ui.right.sidebar')
            .sidebar({
                context: $('#contextWrap .pusher'),
                transition: 'slide out',
                silent: true,
            })
            .sidebar('attach events', '.rightsidebar');

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
    }

    initComponents() {

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

    setupFullScreen(elem) {

        $('#fullscreen-toggle').on('click', () => {
            toggleFullScreen(document.body);
        });

        const toggleFullScreen = (elem) => {
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
    }
}
