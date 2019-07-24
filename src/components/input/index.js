
class Input extends BaseComponent {
    tagName() {
        return 'input';
    }

    getCssDependencies() {
        if (this.data['@type'] === 'radio' || this.data['@type'] === 'checkbox'
            || this.data['@type'] === 'boolean') {
            return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/checkbox.min.css']);
        }
        if (this.data['@type'] === 'signature') {
            return (['/assets/css/input-signature.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/input.min.css']);
    }

    getJsDependencies() {
        if (this.data['@type'] === 'radio' || this.data['@type'] === 'checkbox'
            || this.data['@type'] === 'boolean') {
            return super.getJsDependencies().concat(['/assets/js/checkbox.min.js']);
        }
        return super.getJsDependencies();
    }

    required(element) {
        if (this.data['@required']) {
            element.setAttribute('required', '');
            return true;
        }
        return false;
    }

    checked(element) {
        if (this.data['@checked']) {
            element.setAttribute('checked', '');
            return true;
        }
        return false;
    }

    disabled(element) {
        if (this.data['@disabled']) {
            element.setAttribute('disabled', '');
            return true;
        }
        return false;
    }

    setCheckedInput() {

    }

    getCheckedInput(element) {
        return $(element).attr('checked');
    }

    getValue(element) {
        // console.log($(element).val());
        return $(element).val();
    }

    setValue(element, value) {
        $(element).val(value);
    }

    validateEntry(element) {
        // pass in the element to be validated and pass in the conditions to pass
        // return true or false
        if ($(element).val() === '') {
            console.log('Invalid Entry');
            return false;
        }
        console.log($(element).val());
        return true;
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');
        const id = `input-${this.getRandomInt()}`;
        const inputId = [];
        inputId.push(`#${id}`);


        if (this.data['@type'] === 'plain') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);

            inputDiv.setAttribute('type', 'text');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            $(inputDiv).on('focusout', () => {
                if (this.validateEntry(inputDiv)) {
                    this.getValue(inputDiv);
                }
            });
        } else if (this.data['@type'] === 'secret') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'password');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            $(inputDiv).on('focusout', () => {
                if (this.validateEntry(inputDiv)) {
                    this.getValue(inputDiv);
                }
            });
        } else if (this.data['@type'] === 'email') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'email');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            inputDiv.setAttribute('pattern', '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$');
            // Get data from the subcomponent'
            $(inputDiv).on('focusout', () => {
                if (this.validateEntry(inputDiv)) {
                    this.getValue(inputDiv);
                }
            });
        } else if (this.data['@type'] === 'amount') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'number');
            inputDiv.setAttribute('step', '0.01');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.getValue(inputDiv);
        } else if (this.data['@type'] === 'number2l' || this.data['@type'] === 'number3l'
            || this.data['@type'] === 'number4l' || this.data['@type'] === 'number') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'number');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            this.required(inputDiv);
            if (this.data['@type'] === 'number2l') {
                inputDiv.setAttribute('min', '-99');
                inputDiv.setAttribute('max', '99');
            } else if (this.data['@type'] === 'number3l') {
                inputDiv.setAttribute('min', '-999');
                inputDiv.setAttribute('max', '999');
            } else if (this.data['@type'] === 'number4l') {
                inputDiv.setAttribute('min', '-9999');
                inputDiv.setAttribute('max', '9999');
            }
            $(inputDiv).on('focusout', () => {
                if (this.validateEntry(inputDiv)) {
                    this.getValue(inputDiv);
                }
            });
        } else if (this.data['@type'] === 'phone') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'tel');
            inputDiv.setAttribute('pattern', '[0-9]*');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            $(inputDiv).on('focusout', () => {
                if (this.validateEntry(inputDiv)) {
                    this.getValue(inputDiv);
                }
            });
        } else if (this.data['@type'] === 'signature') {
            const canvaDiv = document.createElement('canvas');
            const submitButton = document.createElement('button');
            const eraseButton = document.createElement('button');
            uiDiv.appendChild(canvaDiv);
            canvaDiv.setAttribute('width', this.data['@canvaWidth']);
            canvaDiv.setAttribute('height', this.data['@canvaHeight']);
            canvaDiv.className = 'js-paint paint-canvas';
            canvaDiv.setAttribute('id', 'signature-pad');
            submitButton.setAttribute('id', 'save');
            eraseButton.setAttribute('id', 'clear');
            submitButton.className = 'button submit';
            eraseButton.className = 'button erase';
            submitButton.innerHTML = 'Submit';
            eraseButton.innerHTML = 'Clear';
            uiDiv.appendChild(submitButton);
            uiDiv.appendChild(eraseButton);

            $(canvaDiv).ready(() => {
                const paintCanvas = document.getElementById('signature-pad');
                const context = paintCanvas.getContext('2d');
                const backgroundColor = '#fff';
                context.lineCap = 'round';
                context.strokeStyle = '#000';
                context.lineWidth = 2;
                context.fillStyle = backgroundColor;
                context.fillRect(0, 0, canvaDiv.width, canvaDiv.height);

                let x = 0;
                let y = 0;
                let userInput = false;
                let isMouseDown = false;
                const stopDrawing = () => { isMouseDown = false; };
                const startDrawing = (event) => {
                    isMouseDown = true;
                    [x, y] = [event.offsetX, event.offsetY];
                    userInput = true;
                };
                const drawLine = (event) => {
                    if (isMouseDown) {
                        const newX = event.offsetX;
                        const newY = event.offsetY;
                        context.beginPath();
                        context.moveTo(x, y);
                        context.lineTo(newX, newY);
                        context.stroke();
                        [x, y] = [newX, newY];
                        userInput = true;
                    }
                };
                paintCanvas.addEventListener('mousedown', startDrawing);
                paintCanvas.addEventListener('mousemove', drawLine);
                paintCanvas.addEventListener('mouseup', stopDrawing);
                paintCanvas.addEventListener('mouseout', stopDrawing);
                $('#clear').on('click', () => {
                    userInput = false;
                    context.fillStyle = backgroundColor;
                    context.clearRect(0, 0, canvaDiv.width, canvaDiv.height);
                    context.fillRect(0, 0, canvaDiv.width, canvaDiv.height);
                });
                $('#save').on('click', () => {
                    if (userInput) {
                        const signatureImage = paintCanvas.toDataURL('image/jpeg', 0.5);
                        console.log(signatureImage);
                        this.validateEntry(this.data['@type'], true);
                    } else {
                        this.validateEntry(this.data['@type'], false);
                    }
                });
            });
        } else if (this.data['@type'] === 'slider') {
            uiDiv.classList.add('slider');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'boolean') {
            uiDiv.classList.add('toggle');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.appendChild(labelDiv);
        } else {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            this.required(inputDiv);

            inputDiv.setAttribute('type', this.data['@type']);
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        }

        uiDiv.setAttribute('id', id);
        node.append(uiDiv);
    }
}

module.exports = Input;
