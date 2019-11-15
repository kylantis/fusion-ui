class ActivityTimeline extends BaseComponent {
    tagName() {
        return 'activityTimeline';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/custom-feed.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return [''];
    }

    render() {
        const { node } = this;
        const { data } = this;
        const ulTag = document.createElement('ul');
        ulTag.className = 'activity-list activityListClass';
        data['>'].forEach((eve) => {
            const liTag = document.createElement('li');
            liTag.className = eve['@color'];
            const activityTime = this.appendNode(liTag, 'time', 'text-muted');
            activityTime.setAttribute('datetime', eve['@timePosted']);
            activityTime.textContent = eve['@timeDifference'];
            const pTag = this.appendNode(liTag, 'p', '');
            pTag.textContent = eve['@activityText'];
            ulTag.append(liTag);
        });
        node.append(ulTag);
    }
}

module.exports = ActivityTimeline;
