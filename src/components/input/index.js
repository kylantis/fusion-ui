// eslint-disable-next-line no-unused-vars
class Input extends BaseComponent {
    tagName() {
        return 'input';
    }

    getCssDependencies() {
        if (this.data['@type'] === 'radio' || this.data['@type'] === 'checkbox' || this.data['@type'] === 'boolean') {
            return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/checkbox.min.css']);
        }
        if (this.data['@type'] === 'signature') {
            return (['/assets/css/input-signature.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/input.min.css']);
    }

    required(element) {
        if (this.data['@required']) {
            element.setAttribute('required', '');
        }
    }

    checked(element) {
        if (this.data['@checked']) {
            element.setAttribute('checked', '');
        }
    }

    disabled(element) {
        if (this.data['@disabled']) {
            element.setAttribute('disabled', '');
        }
    }

    getInput() {

    }

    setInput(inputData) {
        console.log(inputData);
    }

    render() {
        const { node } = this;
        const inputId = [];
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');

        if (this.data['@type'] === 'text') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);

            inputDiv.setAttribute('type', 'text');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        } else if (this.data['@type'] === 'checkbox') {
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            if (this.data['@disabled']) {
                inputDiv.setAttribute('disabled', 'disabled');
            }

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'signature') {
            const canvaDiv = document.createElement('canvas');
            const submitButton = document.createElement('button');
            const eraseButton = document.createElement('button');
            uiDiv.appendChild(canvaDiv);
            canvaDiv.setAttribute('width', '300px');
            canvaDiv.setAttribute('height', '150px');
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
                let isMouseDown = false;
                const stopDrawing = () => { isMouseDown = false; };
                const startDrawing = (event) => {
                    isMouseDown = true;
                    [x, y] = [event.offsetX, event.offsetY];
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
                    }
                };
                paintCanvas.addEventListener('mousedown', startDrawing);
                paintCanvas.addEventListener('mousemove', drawLine);
                paintCanvas.addEventListener('mouseup', stopDrawing);
                paintCanvas.addEventListener('mouseout', stopDrawing);
                $('#clear').on('click', () => {
                    context.fillStyle = backgroundColor;
                    context.clearRect(0, 0, canvaDiv.width, canvaDiv.height);
                    context.fillRect(0, 0, canvaDiv.width, canvaDiv.height);
                });
                $('#save').on('click', () => {
                    const signatureImage = paintCanvas.toDataURL('image/jpeg', 0.5);
                    console.log(signatureImage);
                });
            });
        } else if (this.data['@type'] === 'radio') {
            uiDiv.classList.add('radio');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'radio');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
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
            uiDiv.append(labelDiv);
        } else {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            this.required(inputDiv);

            inputDiv.setAttribute('type', this.data['@type']);
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        }

        const id = `input-${this.getRandomInt()}`;
        inputId.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        node.append(uiDiv);
    }
}
