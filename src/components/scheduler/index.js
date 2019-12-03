class Scheduler extends BaseComponent {
    tagName() {
        return 'scheduler';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/calendar-core.min.css', '/assets/css/calendar-daygrid.min.css', '/assets/css/calendar-timegrid.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/calendar-core.min.js', '/assets/js/calendar-interaction.min.js', '/assets/js/calendar-daygrid.min.js', '/assets/js/calendar-timegrid.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    currentDate() {
        return new Date().toJSON().slice(0, 10).replace(/,/g, '');
    }

    initCalendar() {
        const { data } = this;

        const calendarEl = document.getElementById('calendar');

        const calendar = new FullCalendar.Calendar(calendarEl, {
            plugins: ['interaction', 'dayGrid', 'timeGrid'],
            header: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            },
            // dateClick: (info) => {
            //     alert(`Clicked on: ${info.dateStr}`);
            //     alert(`Coordinates: ${info.jsEvent.pageX},${info.jsEvent.pageY}`);
            //     alert(`Current view: ${info.view.type}`);
            //     // change the day's background color just for fun
            //     info.dayEl.style.backgroundColor = 'red';
            // },
            defaultDate: this.currentDate(),
            navLinks: true, // can click day/week names to navigate views
            selectable: true,
            selectMirror: true,
            select: (arg) => {
                // eslint-disable-next-line no-alert
                const title = prompt('Event Title:');
                if (title) {
                    calendar.addEvent({
                        title,
                        start: arg.start,
                        end: arg.end,
                        allDay: arg.allDay,
                    });
                }
                calendar.unselect();
            },
            editable: true,
            eventLimit: true, // allow "more" link when too many events
            events: data['>']
            ,
        });

        calendar.render();
    }

    render() {
        const { node } = this;

        const container = document.createElement('div');
        container.id = 'calendar';
        node.append(container);

        $(document).ready(() => {
            this.initCalendar();
        });
        this.isRendered(this.getComponentId());
    }
}

module.exports = Scheduler;
