class Terminal extends BaseComponent {
    tagName() {
        return 'terminal';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.css',
            '/assets/css/terminaltwo.min.css',
            'https://cdnjs.cloudflare.com/ajax/libs/jquery.terminal/2.9.0/css/jquery.terminal.min.css',
        ]);
    }

    getJsDependencies() {
        return ([
            'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jquery.terminal/2.9.0/js/jquery.terminal.min.js',
            '/assets/js/terminaltwo.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node, data } = this;

        const mainDiv = document.createElement('div');
        mainDiv.id = 'terminalOne';
        mainDiv.className = 'shell';
        node.append(mainDiv);
        // jQuery(($, undefined) => {
        setTimeout(() => {
            $('.shell').terminal({
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
        }, 2000);

        // });
    }
}

module.exports = Terminal;
