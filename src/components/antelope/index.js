class Antelope extends BaseComponent {

    getType() {
        return BaseComponent.VISUAL_COMPONENT_TYPE;
    }

    tagName() {
        return 'antelope';
    }

    capitalize(name) {
        const c = 'Hello';
        return this.tagName(c);
    }

    getComponentId() {
        return this.id;
    }

    sayHello(name, age) {
        return `Hello ${name}. You are ${age} years old`;
    }

    /**
     * Synthetic Method
     */
    getAge(year) {
        return 2020 - year;
    }

    createPerson() {

    }
}

module.exports = Antelope;
