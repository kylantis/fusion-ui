class Terminal extends BaseComponent {
    tagName() {
        return 'terminal';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['/assets/css/jquery.terminal.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/jquery-terminal.min.js', '/assets/js/jquery-mousewheel.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    // initializeTerminal(el) {
    //     $(el).terminal({
    //         add(a, b) {
    //             this.echo(a + b);
    //         },
    //         foo: 'foo.php',
    //         bar: {
    //             sub(a, b) {
    //                 this.echo(a - b);
    //             },
    //         },
    //         echo(arg1) {
    //             this.echo(arg1);
    //         },
    //     }, {
    //         greetings: 'JavaScript Interpreter',
    //         name: 'js_demo',
    //         height: 200,
    //         prompt: 'js> ',
    //     });
    // }

    render() {
        const { node } = this;
        const { data } = this;

        const mainDiv = document.createElement('div');
        mainDiv.id = data['@id'];
        node.append(mainDiv);

        $('body').terminal({
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
    }
}

module.exports = Terminal;
