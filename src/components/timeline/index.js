
class Timeline extends BaseComponent {
    tagName() {
        return 'timeline';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/jquery.roadmap.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/jquery.roadmap.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    render() {
        const { node } = this;
        const timelineDiv = document.createElement('div');
        timelineDiv.id = 'my-timeline';
        $(document).ready(() => {
            const myEvents = this.data['>'].map(time => ({
                date: time.date,
                content: time.content,
            }));
            $(timelineDiv).roadmap(myEvents, {
                prevArrow: '<i class="caret left mini red icon"></i>',
                nextArrow: '<i class="caret right mini red icon"></i>',
            });
        });
        node.append(timelineDiv);
    }
}

module.exports = Timeline;
