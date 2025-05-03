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

class FormElementGroup extends components.FormElement {

    initializers() {
        return {
            ['rows']: () => [],
            ['rows_$.fields']: () => [],
            ['rows_$.fields_$.columnSize']: "size_1-of-2",
        }
    }

    transformers() {
        return {
            ['editable']: () => false,
            ['readonly']: () => false,
        }
    }

    eventHandlers() {
        return {
            ['insert.rows_$.fields_$.formElement']: ({ value: formElement }) => {
                if (formElement) {
                    formElement.on('change', new EventHandler(
                        () => this.dispatchChangeEvent(),
                        this,
                    ))
                }
            },
        }
    }

    beforeRender() {
       this.on('insert.rows_$.fields_$.formElement', 'insert.rows_$.fields_$.formElement');
    }

    dispatchChangeEvent() {
        this.dispatchEvent('change', this.getValue());
    }

    getValue() {
        const { rows } = this.getInput();
        return rows
            .map(
                ({ fields }) => fields
                    .filter(({ formElement }) => formElement)
                    .map(({ formElement }) => formElement.getValue())
            )
            .join(',');
    }

    isCompound() {
        return true;
    }
}

module.exports = FormElementGroup;