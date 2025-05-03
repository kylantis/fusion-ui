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

class TextArea extends components.FormElement {

    loadStandaloneControl() {
        this.getTextAreaElement()
            .addEventListener('click', () => {
                this.dispatchEvent('click');
            });
    }

    eventHandlers() {
        return {
            ['insert.value']: ({ value, afterMount }) => {
                afterMount(() => {
                    this.dispatchEvent('change', value);
                })
            },
            ['insert.disabled']: ({ value: disabled, parentObject }) => {
                parentObject.editable = !disabled;
            }
        }
    }

    beforeRender() {
        this.on('insert.disabled', 'insert.disabled');
    }
    
    afterMount() {
        this.on('insert.value', 'insert.value');
    }
    
    getTextAreaElement() {
        return this.getNode().querySelector('textarea');
    }

    getValue() {
        return this.getInput().value || null;
    }

    events() {
        return ['click', 'enter'];
    }

    isCompound() {
        return false;
    }

    onChange(evt) {
        const { value } = evt.target;

        this.executeDiscrete(() => {
            this.getInput().value = value;
        });

        this.dispatchEvent('change', value);
    }

    onKeyDown(evt) {
        if (evt.key == 'Enter') {
            this.dispatchEvent('enter');
        }
    }

    prettifyTransform(value) {
        return value || '';
    }
}

module.exports = TextArea;