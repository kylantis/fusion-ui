
class Mail extends BaseComponent {
    tagName() {
        return 'mail';
    }

    componentId = this.getId();

    #rowData;

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/grid.min.css', '/assets/css/rating.min.css', '/assets/css/table.min.css', '/assets/css/segment.min.css', '/assets/css/transition.min.css', '/assets/css/menu.min.css', '/assets/css/button.min.css', '/assets/css/checkbox.min.css', '/assets/css/icon.min.css', '/assets/css/custom-mail.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/assets/js/rating.min.js', '/assets/js/transition.min.js', '/assets/js/checkbox.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    behaviorNames() {
        return ['addNewMessage', 'deleteMessage', ''];
    }

    setRowData(data) {
        this.#rowData = data;
    }

    getRowData() {
        return this.#rowData;
    }

    invokeBehavior(behaviorName, data) {
        switch (behaviorName) {
        case 'deleteMessage':
            $(data).remove();
            break;
        default:
            break;
        }
    }

    onComposeSubmit(subject, recepient, messageBody) {
        console.log(subject, recepient, messageBody);
    }

    appendRow(data) {
        const lastRow = $('#workingTableBody');
        this.createRows(data, lastRow[0]);
        this.initializeCheckbox();
        this.initializeRating();
    }

    prependRow(data) {
        const firstRow = $('#workingTableBody');
        this.createRows(data, firstRow[0]);
        this.initializeCheckbox();
        this.initializeRating();
    }

    initializeCheckbox() {
        // Figure out a way to get Checked values
        const checkedValues = new Set();
        // eslint-disable-next-line no-unused-vars
        function getCheckedValues(val) {
            checkedValues.add(val);
        }

        // function intersection(a, b) {
        //     const intersect = new Set();
        //     for (const elem of b) {
        //         if (a.has(b)) {
        //             intersect.add(elem);
        //         }
        //     }
        //     return intersect;
        // }

        // function removeUncheckedValues(val) {
        //     calcUnchecked.add(val);
        //     checkedValues = intersection(checkedValues, calcUnchecked);
        //     console.log(checkedValues);
        // }

        $('.ui.checkbox')
            .checkbox({
                onChecked() {
                    let element;
                    $('input:checkbox:checked').closest('tr').each((a, val) => {
                        if (val.id === 'optionsRow') {
                            $('input:checkbox').not('#selectAll').prop('checked', this.checked);
                            $('tr').not('#optionsRow').css('background-color', '#f2f2f2');
                        } else {
                            element = val.id;
                            $(`#${element}`).css('background-color', '#f2f2f2');
                        }
                    });
                },
                onUnchecked() {
                    $('input:checkbox').closest('tr').each((a, val) => {
                        if (val.id === 'workingTableBody') {
                            $('input[name="mailCheckbox"]').prop('checked', false);
                            $('tr').not('#optionsRow').css('background-color', '#ffffff');
                        } else {
                            $(`#${val.id}`).css('background-color', '#ffffff');
                        }
                    });
                },
            });
    }

    // Delete Modal

    modalData = {
        '@id': 'mailModal',
        '@title': 'Delete Message?',
        '@modalStyle': 'confirm',
        '@size': 'tiny',
        '@descriptionText': 'Are you sure you want to delete this message?',
        '@approveButtonText': 'Yes',
        '@denyButtonText': 'No',
        '@hasServerCallback': true,
        '@clientCallback': () => {
            this.deleteMessage(this.getRowData());
        },
    };

    loadDeleteModal(loc) {
        const confirmBox = BaseComponent.getComponent('modal', this.modalData, loc);
        return confirmBox;
    }

    // Delete Modal End

    // Compose Modal

    modalComposeData = {
        '@id': 'composeModal',
        '@title': 'Write something down',
        '@modalStyle': 'form',
        '@size': '',
        '@descriptionText': '',
        '@approveButtonText': 'Done',
        '@denyButtonText': 'Close',
        '@hasServerCallback': true,
        '@clientCallback': () => {
            this.testFunc();
        },
    };

    loadComposeModal(loc) {
        const confirmBox = BaseComponent.getComponent('modal', this.modalComposeData, loc);
        return confirmBox;
    }

    // Compose Modal End

    testFunc() {
        this.loadComposeModal().then((data) => {
            // eslint-disable-next-line no-unused-vars
            const x = Object.getPrototypeOf(data);
            console.log(data);
        });
    }

    initializeRating() {
        $('.ui.rating')
            .rating({
                initialRating: this.data['@data-rating'],
                maxRating: this.data['@data-max-rating'],
            });
    }

    // NavBar config
    navBar = {
        '@id': 'mailNav',
        '@title': 'Navbar Mail',
        '@navBarType': 'standard',
        '@orientation': 'vertical',
        '>': [{
            '@tag': 'group',
            '@position': 'left',
            '>': [{
                '@tag': 'item',
                '@title': 'Inbox',
                '@iconName': 'mail',
                '@iconColor': 'red',
                '@badge': '',
                '@iconOnly': false,
                '@iconPosition': 'right',
                '@url': '',
            }, {
                '@tag': 'item',
                '@title': 'Starred',
                '@iconOnly': true,
                '@iconName': 'star',
                '@iconColor': 'yellow',
                '@iconPosition': 'right',
                '@url': '',
            }, {
                '@tag': 'item',
                '@title': 'Sent',
                '@iconOnly': true,
                '@iconName': 'send',
                '@iconColor': 'teal',
                '@iconPosition': 'right',
                '@url': '',
            }, {
                '@tag': 'item',
                '@title': 'Important',
                '@iconOnly': true,
                '@iconName': 'warning',
                '@iconColor': 'red',
                '@iconPosition': 'right',
                '@url': '',
            }, {
                '@tag': 'item',
                '@title': 'Draft',
                '@iconOnly': true,
                '@iconName': 'protect',
                '@iconColor': 'blue',
                '@iconPosition': 'right',
                '@url': '',
            }, {
                '@tag': 'item',
                '@title': 'Trash',
                '@iconOnly': true,
                '@iconName': 'trash',
                '@iconColor': 'black',
                '@iconPosition': 'right',
                '@url': '',
            }],
        }],
    }

    deleteMessage(el) {
        this.invokeBehavior('deleteMessage', el);
    }

    createRows(data, parent) {
        if (data.length > 0) {
            let rowId = 0;
            for (let i = 0; i < data.length; i++) {
                const rowData = data[i];
                if (rowData['@tag'] === 'mail') {
                    const trBody = parent.insertRow(0);
                    if (!rowData['@id']) {
                        trBody.id = `mail-${rowId += 1}`;
                    } else {
                        trBody.id = rowData['@id'];
                    }
                    const innerRowData = rowData['>'];
                    const iconCell = trBody.insertCell(0);
                    const senderCell = trBody.insertCell(1);
                    const subjectCell = trBody.insertCell(2);
                    const entryTimeCell = trBody.insertCell(3);
                    const optionsCell = trBody.insertCell(-1);
                    for (let j = 0; j < innerRowData.length; j++) {
                        for (const [key, value] of Object.entries(rowData['>'][j])) {
                            if (key === '@icon') {
                                iconCell.className = 'left aligned first';
                                const checkBoxUi = document.createElement('div');
                                checkBoxUi.className = 'ui checkbox';
                                const checkBox = document.createElement('input');
                                checkBox.type = 'checkbox';
                                checkBox.name = 'mailCheckbox';
                                checkBoxUi.appendChild(checkBox);
                                const rating = document.createElement('div');
                                rating.className = 'ui star rating';
                                rating.setAttribute('data-max-rating', 1);
                                iconCell.appendChild(checkBoxUi);
                                iconCell.appendChild(rating);
                            }
                            if (key === '@sender') {
                                senderCell.className = 'second';
                                senderCell.textContent = value;
                            }
                            if (key === '@subject') {
                                subjectCell.className = 'third';
                                subjectCell.textContent = value;
                            }
                            if (key === '@entryTime') {
                                entryTimeCell.className = 'right aligned fourth';
                                entryTimeCell.textContent = value;
                            }
                            if (key === '@options') {
                                optionsCell.className = 'right aligned fifth';
                                const trashIcon = document.createElement('i');
                                trashIcon.className = 'icon trash optTrash';
                                optionsCell.appendChild(trashIcon);
                                $(trashIcon).hide();
                                $(trashIcon).click(() => {
                                    this.setRowData(trBody);
                                    this.loadDeleteModal().then((trig) => {
                                        const x = Object.getPrototypeOf(trig);
                                        x.openModal(this.modalData);
                                    });
                                });
                            }
                        }
                    }
                    $(trBody).mouseenter(() => {
                        $(trBody).find('.optTrash').show();
                    });
                    $(trBody).mouseleave(() => {
                        $(trBody).find('.optTrash').hide();
                    });
                }
            }
        }
    }

    generateEmailList(parent, data) {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.className = 'ui selectable unstackable single line fixed table';
        tbody.id = 'workingTableBody';
        const originalData = data['>'];
        table.append(tbody);
        this.createRows(originalData, tbody);

        parent.appendChild(table);
    }

    createOptionsTable(parent) {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.className = 'ui unstackable single line fixed table';
        table.append(tbody);
        const trBody = tbody.insertRow(-1);
        trBody.id = 'optionsRow';
        const iconCell = trBody.insertCell(-1);
        // eslint-disable-next-line no-unused-vars
        const anotherCell = trBody.insertCell(-1);
        // eslint-disable-next-line no-unused-vars
        const someCell = trBody.insertCell(-1);
        const checkBoxUi = document.createElement('div');
        checkBoxUi.className = 'ui checkbox';
        const checkBox = document.createElement('input');
        checkBox.id = 'selectAll';
        checkBox.type = 'checkbox';
        const ref = document.createElement('i');
        ref.className = 'ui grey refresh icon';
        checkBoxUi.appendChild(checkBox);
        iconCell.appendChild(checkBoxUi);
        iconCell.appendChild(ref);
        parent.append(table);
    }

    render() {
        const { node } = this;
        const mailIds = [];

        const rowDiv = document.createElement('div');
        rowDiv.classList.add('row');
        rowDiv.setAttribute('id', this.getComponentId());

        const menuCol = this.appendNode(rowDiv, 'div', 'sixteen wide tablet three wide computer column');
        const mailCol = this.appendNode(rowDiv, 'div', 'sixteen wide tablet thirteen wide computer column');

        const segmentsTag = this.appendNode(menuCol, 'div', 'ui segments');
        const menuSeg = this.appendNode(segmentsTag, 'div', 'ui segment');
        const headerMenu = this.appendNode(menuSeg, 'h5', 'ui header');
        headerMenu.textContent = 'Menu';
        const contentSegment = this.appendNode(segmentsTag, 'div', 'ui segment');
        const menuTag = this.appendNode(contentSegment, 'div', 'ui vertical fluid menu no-border no-radius');
        const buttonDiv = this.appendNode(menuTag, 'div', 'ui vertical menu');
        const editButton = this.appendNode(buttonDiv, 'button', 'ui green fluid button');
        // eslint-disable-next-line no-unused-vars
        const buttonIcon = this.appendNode(editButton, 'i', 'icon edit');
        const textCont = 'Compose';
        $(editButton).click(() => {
            this.loadDeleteModal().then((trig) => {
                const x = Object.getPrototypeOf(trig);
                x.openModal(this.modalComposeData);
            });
        });
        editButton.append(textCont);
        // eslint-disable-next-line no-unused-vars
        const component = BaseComponent.getComponent('navbar', this.navBar, menuTag);
        const segmentsTagTwo = this.appendNode(mailCol, 'div', 'ui segments');
        const mailSeg = this.appendNode(segmentsTagTwo, 'div', 'ui segment');
        const mailHeader = this.appendNode(mailSeg, 'h5', 'ui header');
        mailHeader.textContent = 'inbox';
        const mailContentSegment = this.appendNode(segmentsTagTwo, 'div', 'ui segment');
        this.createOptionsTable(mailContentSegment);
        this.generateEmailList(mailContentSegment, this.data);

        mailIds.push(`#${rowDiv.getAttribute('id')}`);
        this.loadComposeModal(mailCol);
        this.loadDeleteModal(rowDiv);
        node.append(rowDiv);

        this.initializeRating();
        this.initializeCheckbox();
    }
}
module.exports = Mail;
