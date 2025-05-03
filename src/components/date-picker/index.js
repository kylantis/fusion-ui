/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class DatePicker extends components.Input {

    static DEFAULT_LOCALE = 'en-US';
    static DEFAULT_FORMAT = 'DD/MM/YY';

    #yearInView;
    #monthInView;

    #datesCache;

    beforeCompile() {
        this.getInput().displayOnHover;
        this.getInput().startDate;
        this.getInput().rangeStart;
        this.getInput().rangeEnd;

        this.getInput().locale;
        this.getInput().format;
    }

    beforeRender() {

        const input = this.getInput();
        const { placeholder, rangeStart, rangeEnd } = input;

        if (!rangeStart) {
            this.#setDefaultRangeStart();
        }

        if (!rangeEnd) {
            this.#setDefaultRangeEnd();
        }

        if (!placeholder) {
            input.placeholder = this.generatePlaceholder();
        }

        if (this.isMobile()) {

            input.type = 'date';
            input.rightButton = null;

        } else {

            // This will ensure that the border color and background color maintains it's
            // non-transparent color, even when the HTML input element is set to readonly
            // For more info, see the Input component
            input.hasWidget = true;

            input.type = 'text';
            input.rightButton = 'event';
        }
    }

    initializers() {
        const { DEFAULT_FORMAT, DEFAULT_LOCALE } = DatePicker;
        return {
            ['format']: DEFAULT_FORMAT,
            ['locale']: DEFAULT_LOCALE,
        }
    }

    onMount() {
        if (!this.isMobile()) {
            BaseComponent.on('bodyClick', () => {
                this.hideDatePickerContainer();
            });
        }

        this.#ensureRangeStartIsValid();

        this.#ensureRangeEndIsValid();

        this.#ensureStartDateIsValid();
    }

    eventHandlers() {
        const _this = this;

        return {
            ['insert.displayOnHover']: ({ value }) => {
                this.toggleDisplayOnHover(value);
            },
            ['insert.readonly']: ({ value }) => {
                if (value) {
                    this.hideDatePickerContainer();
                }
            },
            ['insert.rangeStart']: () => {
                this.#ensureRangeStartIsValid();
                this.#ensureRangeEndIsValid();
                this.#ensureStartDateIsValid();
                this.refreshValue();
            },
            ['insert.rangeEnd']: () => {
                this.#ensureRangeEndIsValid();
                this.#ensureStartDateIsValid();
                this.refreshValue();
            },
            ['insert.startDate']: () => {
                this.#ensureStartDateIsValid();
                this.refreshValue();
            },
            ['insert.value']: function () {
                // We don't want this event to bubble to the DOM because:
                // * If on mobile: the change was already on the DOM before this hook was called
                // * If on desktop: the change was made because  <input.value> was programmatically updated and the user is not expected
                //                  to see an an ISO string or some other weird value in the input element. Instead, we will update the DOM
                //                  ourselves in refreshValue()

                this.preventDefault();

                _this.refreshValue();

                const { value } = _this.getInput();

                if (value) {
                    // The change went through, dispatch select and change events
                    const date = _this.createDate(value);

                    _this.dispatchEvent('select', date.getDate(), date.getMonth() + 1, date.getFullYear());

                    _this.dispatchEvent('change', value);
                }
            }
        }
    }

    afterMount() {
        this.on('insert.displayOnHover', 'insert.displayOnHover');
        this.on('insert.readonly', 'insert.readonly');
        this.on('insert.rangeStart', 'insert.rangeStart');
        this.on('insert.rangeEnd', 'insert.rangeEnd');
        this.on('insert.startDate', 'insert.startDate');
        this.on('insert.value', 'insert.value');
    }

    setStartDate(isoString) {
        const input = this.getInput();
        input.startDate = isoString;
    }

    behaviours() {
        return [
            'setStartDate',
        ];
    }

    #setDefaultRangeStart() {
        // default to epoch
        this.getInput().rangeStart = new Date(0).toISOString();
    }

    #setDefaultRangeEnd() {

        // default to 1 year in the future
        const oneYearFromNow = this.createDate();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        this.getInput().rangeEnd = oneYearFromNow.toISOString();
    }

    #isDateWithinRange(isoString, start, end) {
        assert(isoString);
        const date = this.createDate(isoString);

        if (start && this.createDate(start) > date) {
            return false;
        }

        if (end && this.createDate(end) < date) {
            return false;
        }

        return true;
    }

    #ensureRangeStartIsValid() {
        const { rangeStart } = this.getInput();

        if (
            !rangeStart ||
            !this.isValidIsoDateString(rangeStart)
        ) {
            this.executeDiscrete(() => {
                this.#setDefaultRangeStart();
            });

            if (this.isMobile()) {
                this.getInputElement().min = null;
            }

            return false;
        }

        if (this.isMobile()) {
            this.getInputElement().min = rangeStart.split("T")[0];
        }

        return true;
    }

    #ensureRangeEndIsValid() {
        const { rangeStart, rangeEnd } = this.getInput();

        if (
            !rangeEnd ||
            !this.isValidIsoDateString(rangeEnd) ||
            !this.#isDateWithinRange(rangeEnd, rangeStart)
        ) {
            this.executeDiscrete(() => {
                this.#setDefaultRangeEnd();
            });

            if (this.isMobile()) {
                this.getInputElement().max = null;
            }

            return false;
        }

        if (this.isMobile()) {
            this.getInputElement().max = rangeEnd.split("T")[0];
        }

        return true;
    }

    #ensureStartDateIsValid() {
        const input = this.getInput();
        const { startDate, rangeStart, rangeEnd } = input;

        if (
            !startDate ||
            !this.isValidIsoDateString(startDate) ||
            !this.#isDateWithinRange(startDate, rangeStart) ||
            !this.#isDateWithinRange(startDate, null, rangeEnd)
        ) {
            this.executeDiscrete(() => {
                input.startDate = null;
            });
            return false;
        }
        return true;
    }

    #ensureValueIsValid(notify) {
        const input = this.getInput();
        const { value, startDate, rangeStart, rangeEnd } = input;

        const cb = (start, end) => {
            this.executeDiscrete(() => {
                input.value = null;
            });
            if (notify) {
                if (start) {
                    alert(`Selected Date "${this.toPrettyString(value)}" cannot be a date before "${this.toPrettyString(start)}"`);
                }
                if (end) {
                    alert(`Selected Date "${this.toPrettyString(value)}" cannot be a date after "${this.toPrettyString(end)}"`);
                }
            }
            return false;
        }

        if (!value || !this.isValidIsoDateString(value)) {
            return cb();
        }
        if (!this.#isDateWithinRange(value, startDate)) {
            return cb(startDate);
        }
        if (!this.#isDateWithinRange(value, rangeStart)) {
            return cb(rangeStart);
        }
        if (!this.#isDateWithinRange(value, null, rangeEnd)) {
            return cb(null, rangeEnd);
        }

        return true;
    }

    refreshValue() {

        let { value } = this.getInput();

        this.getInputElement().value = this.#ensureValueIsValid(true)
            ? this.isMobile() ? value.slice(0, 10) : this.toPrettyString(value)
            : null;

        if (!this.isMobile()) {
            // Load widget

            value = this.getInput().value;

            if (value) {
                const date = this.createDate(value);
                this.#renderWidget(date.getMonth() + 1, date.getFullYear());
            } else {
                this.#loadWidget();
            }
        }
    }

    onChange() {

        if (this.isMobile()) {
            const value = this.getInputElement().value;

            this.getInput().value = value ? new Date(Date.parse(value)).toISOString() : null;

        } else {

            // On desktop, we want to do nothing whenever the DOM value changes because the input accepts free-form 
            // texts (i.e. type="text") and all changes to <value> needs to happen either by programmatically updating 
            // <input.value> or using the widget, rather than using the DOM API
        }
    }

    loadStandaloneControl() {
        super.loadStandaloneControl();

        if (!this.isMobile()) {

            const { displayOnHover } = this.getInput();

            this.#getDatePickerTriggers()
                .forEach(node => {
                    node.setAttribute(this.getOverlayAttribute(), true)
                })

            this.toggleDisplayOnHover(displayOnHover);
        }

        this.refreshValue();
    }

    prettifyTransform(value) {
        return value ? this.toPrettyString(value) : '';
    }

    #getDatePickerTriggers() {
        const { readonly } = this.getInput();

        return readonly ?
            // If <readonly>, the below node elements will not be on the DOM
            [] :
            [
                this.getInputElement(),
                this.getDatePickerTriggerButton().getButton()
            ]
    }

    events() {
        return ['select'];
    }

    getDatePickerContainer() {
        return this.getNode().querySelector('.slds-datepicker');
    }

    isDatePickerContainerVisible() {
        return this.getNode().classList.contains('slds-is-open');
    }

    showDatePickerContainer() {
        if (this.isMobile()) {
            this.getInputElement().showPicker();
        } else {
            const { readonly } = this.getInput();

            this.toggleCssClass(!readonly, 'slds-is-open');
            this.getDatePickerContainer().setAttribute('aria-hidden', false);
        }
    }

    hideDatePickerContainer() {
        if (this.isMobile()) {
            return;
        }

        this.toggleCssClass(false, 'slds-is-open');
        this.getDatePickerContainer().setAttribute('aria-hidden', true)
    }

    getDatePickerTriggerClickListener() {

        return this.datePickerTriggerClickListener ||
            (this.datePickerTriggerClickListener = ({ currentTarget }) => {

                if (!this.isDatePickerContainerVisible()) {
                    this.showDatePickerContainer();
                } else if (currentTarget == this.getDatePickerTriggerButton().getButton()) {
                    this.hideDatePickerContainer();
                }
            });
    }

    getDatePickerTriggerButton() {
        return this.getInlineComponent('rightButton');
    }

    toggleDisplayOnHover(displayOnHover) {
        if (this.isMobile()) {
            return;
        }

        if (displayOnHover) {
            this.#getDatePickerTriggers().forEach(n => {
                n.removeEventListener('click', this.getDatePickerTriggerClickListener());
            });
        } else {
            this.#getDatePickerTriggers().forEach(n => {
                n.addEventListener('click', this.getDatePickerTriggerClickListener());
            });
        }
    }

    isValidIsoDateString(s) {
        return !isNaN(new Date(s))
    }

    createDate(...args) {

        const cache = this.#datesCache || (this.#datesCache = {});
        let cacheKey;

        if (args.length) {
            // Check cache, so we don't create new date instances every time

            cacheKey = args.map(v => JSON.stringify(v)).join(',');

            if (cache[cacheKey]) {
                return cache[cacheKey];
            }
        }

        const date = new Date(...args);

        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);

        if (cacheKey) {
            cache[cacheKey] = date;
        }

        return date;
    }

    #loadWidget() {
        const { value, startDate, rangeStart, rangeEnd } = this.getInput();

        const currentDate = this.createDate();

        let date = value ? this.createDate(value) :
            startDate ? this.createDate(startDate) :
                rangeEnd ? this.createDate(rangeEnd) :
                    rangeStart ? this.createDate(rangeStart) :
                        currentDate;

        if (date > currentDate && this.#isDateWithinRange(currentDate.toISOString(), rangeStart, rangeEnd)) {
            date = currentDate;
        }

        this.#renderWidget(date.getMonth() + 1, date.getFullYear());
    }

    #renderWidget(month, year) {

        this.#monthInView = month;
        this.#yearInView = year;

        this.#renderWidget0();
    }

    async #renderWidget0() {
        this.renderDecorator('date_picker', this.getPopupWidgetContainer());

        // Add transition here, if applicable
    }

    toPrettyString(date) {
        const d = (typeof date == 'string') ? this.createDate(date) : date;
        return isNaN(d.getTime()) ? '' : this.getDateTimeFormat().format(d);
    }

    getDateTimeFormat() {
        const { DEFAULT_FORMAT, DEFAULT_LOCALE } = DatePicker;
        const { locale, format } = this.getInput();

        try {
            return new Intl.DateTimeFormat(locale, format);
        } catch (e) {
            return new Intl.DateTimeFormat(DEFAULT_LOCALE, DEFAULT_FORMAT);
        }
    }

    generatePlaceholder() {
        return this.getDateTimeFormat()
            .formatToParts()
            .map(part => {
                switch (part.type) {
                    case 'day': return 'DD';
                    case 'month': return 'MM';
                    case 'year': return 'YY';
                    case 'hour': return 'HH';
                    case 'minute': return 'mm';
                    case 'second': return 'ss';
                    case 'literal': return part.value;
                    default: return '';
                }
            }).join('');
    }

    getMonthsInRange(startDate, endDate) {
        const dtf = this.getDateTimeFormat();
        const monthFormat = new Intl.DateTimeFormat(dtf.resolvedOptions().locale, { month: 'long' });

        const months = {};
        let currentDate = new Date(startDate.getTime());

        while (currentDate <= endDate) {
            const monthNumber = currentDate.getMonth() + 1;

            if (months[monthNumber]) {
                break;
            }

            months[monthNumber] = monthFormat.format(currentDate);

            currentDate.setMonth(monthNumber);
            currentDate.setDate(1);
        }

        return months;
    }

    getYearsInRange(startDate, endDate) {
        const years = [];
        let currentYear = startDate.getFullYear();

        while (currentYear <= endDate.getFullYear()) {
            years.push(currentYear)
            currentYear++;
        }

        return years;
    }


    // Helper functions

    getWidgetInfo() {

        const input = this.getInput();

        const rangeStart = this.createDate(input.rangeStart);
        const rangeEnd = this.createDate(input.rangeEnd);

        const years = this.getYearsInRange(rangeStart, rangeEnd);
        assert(years.includes(this.#yearInView));

        const months = this.getMonthsInRange(rangeStart, rangeEnd);
        const monthName = months[this.#monthInView];
        assert(monthName);

        const hasPrevious = this.#monthsApart(this.#monthInView, this.#yearInView, rangeStart.getMonth() + 1, rangeStart.getFullYear()) > 0;

        const hasNext = this.#monthsApart(this.#monthInView, this.#yearInView, rangeEnd.getMonth() + 1, rangeEnd.getFullYear()) > 0;

        return {
            years, year: this.#yearInView,
            monthName, hasPrevious, hasNext,
            month: this.#monthInView,
            monthString: this.#monthInView.toString().padStart(2, '0'),
            currentDate: this.createDate().toISOString(),
        }
    }

    setYearInView(year) {

        const input = this.getInput();

        const rangeStart = this.createDate(input.rangeStart);
        const rangeEnd = this.createDate(input.rangeEnd);

        const isRangeStartYear = year == rangeStart.getFullYear();
        const isRangeEndYear = year == rangeEnd.getFullYear();

        if (isRangeStartYear && rangeStart.getMonth() + 1 > this.#monthInView) {
            this.#monthInView = rangeStart.getMonth() + 1;
        }

        if (isRangeEndYear && rangeEnd.getMonth() + 1 < this.#monthInView) {
            this.#monthInView = rangeEnd.getMonth() + 1;
        }

        this.#yearInView = year;
        this.#renderWidget0();
    }

    #offsetMonthInView(offset) {
        const { month, year } = this.#adjustMonthYear(
            this.#monthInView,
            this.#yearInView,
            offset
        )

        this.#monthInView = month;
        this.#yearInView = year;

        this.#renderWidget0();
    }

    currentMonth() {
        const currentDate = this.createDate();

        this.#monthInView = currentDate.getMonth() + 1;
        this.#yearInView = currentDate.getFullYear();

        this.#renderWidget0();
    }

    previousMonth() {
        this.#offsetMonthInView(-1);
    }

    nextMonth() {
        this.#offsetMonthInView(1);
    }

    getDaysOfTheWeek() {
        const daysOfTheWeek = {};
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < weekdays.length; i++) {
            daysOfTheWeek[weekdaysShort[i]] = weekdays[i];
        }

        return daysOfTheWeek;
    }

    getMonthDates(year, month) {
        let dates = [];

        const date = this.createDate(year, month - 1, 1);
        const firstDayOfWeek = date.getDay();

        // Add dates from previous month if first day of month is not Sunday
        if (firstDayOfWeek !== 0) {
            const prevMonthLastDate = this.createDate(year, month - 1, 0).getDate();
            const numDaysToAdd = firstDayOfWeek;
            for (let i = numDaysToAdd - 1; i >= 0; i--) {
                const prevDate = this.createDate(year, month - 2, prevMonthLastDate - i);
                dates.push({
                    date: prevDate,
                    isPrevMonth: true,
                });
            }
        }

        // Add dates from current month
        const lastDate = this.createDate(year, month, 0).getDate();
        for (let i = 1; i <= lastDate; i++) {
            const currDate = this.createDate(year, month - 1, i);
            dates.push({
                date: currDate,
            });
        }

        // Add dates from next month if last day of month is not Saturday
        const lastDayOfWeek = this.createDate(year, month - 1, lastDate).getDay();
        if (lastDayOfWeek !== 6) {
            const numDaysToAdd = 6 - lastDayOfWeek;
            for (let i = 1; i <= numDaysToAdd; i++) {
                const nextDate = this.createDate(year, month, i);
                dates.push({
                    date: nextDate,
                    isNextMonth: true,
                });
            }
        }

        dates = dates.map((dateInfo) => {
            const { date } = dateInfo;

            return {
                ...dateInfo,
                isoString: date.toISOString(),
                day: date.getDate(),
                label: this.toPrettyString(date),
                isToday: this.#isToday(date.getFullYear(), date.getMonth() + 1, date.getDate()),
                withinRange: this.isDateInRange(date),
                isSelected: this.#isDateSelected(date),
            }
        });

        dates = dates.map((dateInfo, index) => {
            const { isSelected } = dateInfo;

            const prev = dates[index - 1];
            const next = dates[index + 1];

            return {
                ...dateInfo,
                isSelectedRange: isSelected && ((prev && prev.isSelected) || (next && next.isSelected)),
            };
        });

        // split dates into sub-arrays, each sub-array represents a week
        assert(dates.length % 7 == 0);

        const arr = [];
        let currentWeek;

        for (let i = 0; i < dates.length; i++) {
            if (i % 7 == 0) {

                const prevWeek = arr.length ? arr[arr.length - 1] : null;

                if (prevWeek) {
                    prevWeek.hasSelectedRange = prevWeek.days
                        .reduce(
                            (accumulator, { isSelectedRange }) => accumulator || isSelectedRange,
                            false
                        );
                }

                currentWeek = { days: [] };
                arr.push(currentWeek);
            }
            currentWeek.days.push(dates[i]);
        }

        return arr;
    }

    selectDate(isoString) {
        this.getInput().value = isoString;
    }

    isDateInRange(date) {
        const { rangeStart, rangeEnd } = this.getInput();
        return this.#isDateWithinRange((typeof date == 'string') ? date : date.toISOString(), rangeStart, rangeEnd);
    }

    #isDateSelected(date) {
        assert(date instanceof Date);

        const input = this.getInput();

        const value = input.value ? this.createDate(input.value) : null;
        const startDate = input.startDate ? this.createDate(input.startDate) : null;

        if (startDate) {
            if (value) {
                if (date >= startDate && date <= value) {
                    return true;
                }
            } else if (date.getTime() == startDate.getTime()) {
                return true;
            }
        } else if (value) {
            return date.getTime() == value.getTime();
        }

        return false;
    }

    #isToday(year, month, day) {
        const today = this.createDate();
        return today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
    }

    #monthsApart(m1, y1, m2, y2) {
        var monthDiff = (y2 - y1) * 12 + (m2 - m1);
        return Math.abs(monthDiff);
    }

    #adjustMonthYear(month, year, offset) {
        const date = new Date(year, month - 1 + offset, 1);
        return { month: date.getMonth() + 1, year: date.getFullYear() };
    }
}

module.exports = DatePicker;