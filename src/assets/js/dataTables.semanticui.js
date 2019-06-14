/* eslint-disable */

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery', 'datatables.net'], $ => factory($, window, document));
    } else if (typeof exports === 'object') {
        // CommonJS
        module.exports = function (root, $) {
            if (!root) {
                root = window;
            }

            if (!$ || !$.fn.dataTable) {
                // Require DataTables, which attaches to jQuery, including
                // jQuery if needed and have a $ property so we can access the
                // jQuery object that is used
                $ = require('datatables.net')(root, $).$;
            }

            return factory($, root, root.document);
        };
    } else {
        // Browser
        factory(jQuery, window, document);
    }
}(($, window, document, undefined) => {
    const DataTable = $.fn.dataTable;


    /* Set the defaults for DataTables initialisation */
    $.extend(true, DataTable.defaults, {
        dom:
		"<'ui grid'"
			+ "<'row'"
				+ "<'eight wide column'l>"
				+ "<'right aligned eight wide column'f>"
			+ '>'
			+ "<'row dt-table'"
				+ "<'sixteen wide column'tr>"
			+ '>'
			+ "<'row'"
				+ "<'seven wide column'i>"
				+ "<'right aligned nine wide column'p>"
			+ '>'
		+ '>',
        renderer: 'semanticUI',
    });


    /* Default class modification */
    $.extend(DataTable.ext.classes, {
        sWrapper: 'dataTables_wrapper dt-semanticUI',
        sFilter: 'dataTables_filter ui input',
        sProcessing: 'dataTables_processing ui segment',
        sPageButton: 'paginate_button item',
    });


    /* Bootstrap paging button renderer */
    DataTable.ext.renderer.pageButton.semanticUI = function (settings, host, idx, buttons, page, pages) {
        const api = new DataTable.Api(settings);
        const classes = settings.oClasses;
        const lang = settings.oLanguage.oPaginate;
        const aria = settings.oLanguage.oAria.paginate || {};
        let btnDisplay; let btnClass; let
            counter = 0;

        var attach = function (container, buttons) {
            let i; let ien; let node; let
                button;
            const clickHandler = function (e) {
                e.preventDefault();
                if (!$(e.currentTarget).hasClass('disabled') && api.page() != e.data.action) {
                    api.page(e.data.action).draw('page');
                }
            };

            for (i = 0, ien = buttons.length; i < ien; i++) {
                button = buttons[i];

                if ($.isArray(button)) {
                    attach(container, button);
                } else {
                    btnDisplay = '';
                    btnClass = '';

                    switch (button) {
                    case 'ellipsis':
                        btnDisplay = '&#x2026;';
                        btnClass = 'disabled';
                        break;

                    case 'first':
                        btnDisplay = lang.sFirst;
                        btnClass = button + (page > 0
                            ? '' : ' disabled');
                        break;

                    case 'previous':
                        btnDisplay = lang.sPrevious;
                        btnClass = button + (page > 0
                            ? '' : ' disabled');
                        break;

                    case 'next':
                        btnDisplay = lang.sNext;
                        btnClass = button + (page < pages - 1
                            ? '' : ' disabled');
                        break;

                    case 'last':
                        btnDisplay = lang.sLast;
                        btnClass = button + (page < pages - 1
                            ? '' : ' disabled');
                        break;

                    default:
                        btnDisplay = button + 1;
                        btnClass = page === button
                            ? 'active' : '';
                        break;
                    }

                    const tag = btnClass.indexOf('disabled') === -1
                        ? 'a'
                        : 'div';

                    if (btnDisplay) {
                        node = $(`<${tag}>`, {
                            class: `${classes.sPageButton} ${btnClass}`,
                            id: idx === 0 && typeof button === 'string'
                                ? `${settings.sTableId}_${button}`
                                : null,
                            href: '#',
                            'aria-controls': settings.sTableId,
                            'aria-label': aria[button],
                            'data-dt-idx': counter,
                            tabindex: settings.iTabIndex,
                        })
                            .html(btnDisplay)
                            .appendTo(container);

                        settings.oApi._fnBindAction(
                            node, { action: button }, clickHandler,
                        );

                        counter++;
                    }
                }
            }
        };

        // IE9 throws an 'unknown error' if document.activeElement is used
        // inside an iframe or frame.
        let activeEl;

        try {
            // Because this approach is destroying and recreating the paging
            // elements, focus is lost on the select button which is bad for
            // accessibility. So we want to restore focus once the draw has
            // completed
            activeEl = $(host).find(document.activeElement).data('dt-idx');
        } catch (e) {}

        attach(
            $(host).empty().html('<div class="ui pagination menu"/>').children(),
            buttons,
        );

        if (activeEl) {
            $(host).find(`[data-dt-idx=${activeEl}]`).focus();
        }
    };


    // Javascript enhancements on table initialisation
    $(document).on('init.dt', (e, ctx) => {
        if (e.namespace !== 'dt') {
            return;
        }

        // Length menu drop down
        if ($.fn.dropdown) {
            const api = new $.fn.dataTable.Api(ctx);

            $('div.dataTables_length select', api.table().container()).dropdown();
        }
    });


    return DataTable;
}));
