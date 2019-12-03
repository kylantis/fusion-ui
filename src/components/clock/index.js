class Clock extends BaseComponent {
    tagName() {
        return 'clock';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/clock.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;

        const ul = document.createElement('ul');
        ul.id = 'clock';
        const secondHand = document.createElement('li');
        secondHand.id = 'sec';
        const hourHand = document.createElement('li');
        hourHand.id = 'hour';
        const minHand = document.createElement('li');
        minHand.id = 'min';
        ul.appendChild(secondHand);
        ul.appendChild(hourHand);
        ul.appendChild(minHand);
        node.appendChild(ul);

        $(document).ready(() => {
            setInterval(() => {
                const seconds = new Date().getSeconds();
                const sdegree = seconds * 6;
                const srotate = `rotate(${sdegree}deg)`;

                $('#sec').css({ '-moz-transform': srotate, '-webkit-transform': srotate });
            }, 1000);


            setInterval(() => {
                const hours = new Date().getHours();
                const mins = new Date().getMinutes();
                const hdegree = hours * 30 + (mins / 2);
                const hrotate = `rotate(${hdegree}deg)`;

                $('#hour').css({ '-moz-transform': hrotate, '-webkit-transform': hrotate });
            }, 1000);


            setInterval(() => {
                const mins = new Date().getMinutes();
                const mdegree = mins * 6;
                const mrotate = `rotate(${mdegree}deg)`;

                $('#min').css({ '-moz-transform': mrotate, '-webkit-transform': mrotate });
            }, 1000);
        });
        this.isRendered(this.getComponentId());
    }
}

module.exports = Clock;
