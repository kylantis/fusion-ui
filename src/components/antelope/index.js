class Antelope extends BaseComponent {
    getInitTasks() {
        // If you are using non-basic partial declarations in your template, you can
        // register them here
        // i.e. return ['title'].map(e => this.registerNonBasicPartials(e));
    }

    getType() {
        return BaseComponent.VISUAL_COMPONENT_TYPE;
    }

    tagName() {
        return 'antelope';
    }

    capitalize(name) {
        const c = 'Hi';
        return this.tagName(c);
    }

    getComponentId() {
        return this.id;
    }

    // eslint-disable-next-line no-unused-vars
    invokeBehavior(behavior, data) {
    }

    transformData() {
        // Do transformations here

        return {
            ...this.data,

            // Add extra data here that goes into the template
            // Also, for all Json Data, stop using @ for attributes
        };
    }
}

module.exports = Antelope;
