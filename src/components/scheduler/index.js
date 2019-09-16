class Scheduler extends BaseComponent {
    tagName() {
        return 'scheduler';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/scheduler.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/scheduler.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const container = document.createElement('div');
        container.id = 'container';
        node.append(container);
        $(document).ready(() => {
            $('#container').simpleCalendar({
                // event dates
                events: ['2019-03-04', '2019-03-05', '2019-03-06', '2019-03-07'],
                // event info to show
                eventsInfo: ['Event 1', 'Event 2', 'Event 3', 'Event 4'],
            });
        });
    }
}

module.exports = Scheduler;
