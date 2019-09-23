class Scheduler extends BaseComponent {
    tagName() {
        return 'scheduler';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/calendar-core.min.css', '/assets/css/calendar-daygrid.min.css', '/assets/css/calendar-timegrid.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/calendar-core.min.js', '/assets/js/calendar-interaction.min.js', '/assets/js/calendar-daygrid.min.js', '/assets/js/calendar-timegrid.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    currentDate() {
        const currentDate = new Date();
        return currentDate.toJSON().slice(0, 10).replace(/,/g, '');
    }

    render() {
        const { node } = this;
        const container = document.createElement('div');
        container.id = 'calendar';
        node.append(container);

        $(document).ready(() => {
            const calendarEl = document.getElementById('calendar');

            const calendar = new FullCalendar.Calendar(calendarEl, {
                plugins: ['interaction', 'dayGrid', 'timeGrid'],
                header: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay',
                },
                defaultDate: this.currentDate(),
                navLinks: true, // can click day/week names to navigate views
                selectable: true,
                selectMirror: true,
                select(arg) {
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
                events: [
                    {
                        title: 'All Day Event',
                        start: '2019-08-01',
                    },
                    {
                        title: 'Long Event',
                        start: '2019-08-07',
                        end: '2019-08-10',
                    },
                    {
                        groupId: 999,
                        title: 'Repeating Event',
                        start: '2019-08-09T16:00:00',
                    },
                    {
                        groupId: 999,
                        title: 'Repeating Event',
                        start: '2019-08-16T16:00:00',
                    },
                    {
                        title: 'Conference',
                        start: '2019-08-11',
                        end: '2019-08-13',
                    },
                    {
                        title: 'Meeting',
                        start: '2019-08-12T10:30:00',
                        end: '2019-08-12T12:30:00',
                    },
                    {
                        title: 'Lunch',
                        start: '2019-08-12T12:00:00',
                    },
                    {
                        title: 'Meeting',
                        start: '2019-08-12T14:30:00',
                    },
                    {
                        title: 'Happy Hour',
                        start: '2019-08-12T17:30:00',
                    },
                    {
                        title: 'Dinner',
                        start: '2019-08-12T20:00:00',
                    },
                    {
                        title: 'Birthday Party',
                        start: '2019-08-13T07:00:00',
                    },
                    {
                        title: 'Click for Google',
                        url: 'http://google.com/',
                        start: '2019-08-28',
                    },
                ],
            });

            calendar.render();
        });
    }
}

module.exports = Scheduler;
