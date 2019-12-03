class ActivityTimeline extends BaseComponent {
    tagName() {
        return 'activityTimeline';
    }

    componentId = this.getId();

    getComponentId() {
        return this.componentId;
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/custom-feed.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return ['includeActivity'];
    }

    invokeBehavior(behavior, data) {
        const parentEl = document.getElementById(this.getComponentId());
        switch (behavior) {
        case 'includeActivity': {
            const ulTag = parentEl.querySelector('ul');
            this.createList(ulTag, data);
            break;
        }
        default:
            break;
        }
    }

    includeActivity(data) {
        this.invokeBehavior('includeActivity', data);
    }

    createList(parent, data) {
        data.forEach((eve) => {
            const liTag = document.createElement('li');
            liTag.className = eve['@color'];
            const activityTime = this.appendNode(liTag, 'time', 'text-muted');
            activityTime.setAttribute('datetime', eve['@timePosted']);
            activityTime.textContent = eve['@timeDifference'];
            const pTag = this.appendNode(liTag, 'p', '');
            pTag.textContent = eve['@activityText'];
            parent.append(liTag);
        });
    }

    render() {
        const { node } = this;
        const { data } = this;
        const mainDiv = document.createElement('div');
        mainDiv.id = this.getComponentId();
        const ulTag = document.createElement('ul');
        ulTag.className = 'activity-list activityListClass';
        this.createList(ulTag, data['>']);
        mainDiv.appendChild(ulTag);
        node.append(mainDiv);
        this.isRendered(this.getComponentId());
    }
}

module.exports = ActivityTimeline;
