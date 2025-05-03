/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class Form extends components.LightningComponent {

    beforeCompile() {
        this.getInput().layoutType;
        this.getInput().editing;
        this.getInput().formValues['@mapKey'];
    }

    initializers() {
        return {
            ['editing']: true,
            ['layoutType']: 'horizontal',
            ['elements']: () => [],
            ['elements_$']: () => [],
        };
    }

    eventHandlers() {
        return {
            ['insert.layoutType']: ({ value: layoutType }) => {
                this.#getElements()
                    .forEach(element => {
                        const input = element.getInput();
                        if (!input.layoutType) {
                            input.layoutType = layoutType;
                        }
                    });
            },
            ['insert.editing']: ({ value: editing }) => {
                this.#getElements()
                    .forEach(element => {
                        const input = element.getInput();
                        input.editing = editing;
                    });
            },
        }
    }

    #getElements() {
        const { elements } = this.getInput();
        const ret = [];

        elements.forEach(row => {
            row
                .filter(e => e)
                .forEach(e => ret.push(e));
        });

        return ret;
    }

    beforeRender() {
        this.on('insert.layoutType', 'insert.layoutType');
        this.on('insert.editing', 'insert.editing');
    }

    behaviours() {
        return ['submit'];
    }

    events() {
        return ['submit'];
    }

    submit() {
        const form = this.getNode();

        if (!form.reportValidity()) {
            return;
        }

        var formValues = {};

        this.#getElements().forEach(e => {
            var { name } = e.getInput();
            formValues[name] = e.getValue();
        });

        this.dispatchEvent('submit', formValues);
    }
}
module.exports = Form;