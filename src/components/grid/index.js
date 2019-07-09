
class Grid extends BaseComponent {
    tagName() {
        return 'grid';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/grid.min.css']);
    }

    createNewRow() {
        const div = document.createElement('div');
        div.className = 'grid stackable';
        if (this.data['@equalWidth']) {
            div.className += ' equal width';
        }
        return div;
    }

    render() {
        const { node } = this;
        const uiDiv = this.createNewRow();

        const first = this.data['>'];
        function traverse(somedata) {
            somedata.forEach((element) => {
                if (element['@tag'] === 'column') {
                    const div = document.createElement('div');
                    div.className = 'column';
                    div.id = element['@columnId'];
                    uiDiv.appendChild(div);
                }
            });
        }
        first.forEach((element) => {
            if (element['@tag'] === 'row') {
                uiDiv.appendChild(this.createNewRow());
                traverse(element['>']);
            }
        });

        node.append(uiDiv);
    }
}
module.exports = Grid;
