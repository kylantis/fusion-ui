class Terminal extends BaseComponent {
    tagName() {
        return 'terminal';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['/assets/css/jquery.terminal.min.css']);
    }

    getJsDependencies() {
        return (['/cdn/jquery-3.4.1.min.js', '/assets/js/jquery-terminal.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node, data } = this;

        const mainDiv = document.createElement('div');
        mainDiv.id = 'terminalOne';
        node.append(mainDiv);
        // jQuery(($, undefined) => {

        $('#terminalOne').terminal({
            add(a, b) {
                this.echo(a + b);
            },
            foo: 'foo.php',
            bar: {
                sub(a, b) {
                    this.echo(a - b);
                },
            },
            echo(arg1) {
                this.echo(arg1);
            },
        }, {
            greetings: 'JavaScript Interpreter',
            name: 'js_demo',
            height: 200,
            prompt: 'js> ',
        });
        this.isRendered(this.getComponentId());
        // });
    }
}

module.exports = Terminal;
