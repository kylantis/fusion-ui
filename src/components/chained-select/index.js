// class ChainedSelect extends BaseComponent {
//     tagName() {
//         return 'chainedSelect';
//     }

//     componentId = this.getId();

//     getJsDependencies() {
//         return super.getJsDependencies().concat(['/assets/js/chained-select.min.js', '/assets/js/chained-remote-select.min.js']);
//     }

//     getComponentId() {
//         return this.componentId;
//     }

//     render() {
//         const { node } = this;
//         const { data } = this;
//         const pselect = document.createElement('select');
//         // pselect.id = data['@parentId'];
//         pselect.id = 'parentId';
//         pselect.name = 'parentId';
//         const cselect = document.createElement('select');
//         // cselect.id = data['@childId'];
//         cselect.id = 'childId';
//         cselect.name = 'childId';
//         let parentData;
//         if (data['>']) {
//             parentData = data['>'];
//             parentData.forEach((element) => {
//                 const optionsTag = document.createElement('option');
//                 optionsTag.value = element['@value'];
//                 optionsTag.className = element['@class'];
//                 optionsTag.textContent = element['@name'];
//                 // console.log(optionsTag);
//                 pselect.appendChild(optionsTag);
//                 node.append(pselect);
//                 if (element['>']) {
//                     element['>'].forEach((el) => {
//                         const childOpts = document.createElement('option');
//                         childOpts.value = el['@value'];
//                         childOpts.textContent = el['@name'];
//                         childOpts.className = el['@class'];
//                         cselect.appendChild(childOpts);
//                         node.append(cselect);
//                     });
//                 }
//             });
//         }
//         $('#childId').chained('#parentId');
//         // $(`#${data['@childId']}`).chained(`#${data['@parentId']}`);
//     }
// }

// module.exports = ChainedSelect;

class ChainedSelect extends BaseComponent {
    tagName() {
        return 'chainedSelect';
    }

    componentId = this.getId();

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/chained-select.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const pselect = document.createElement('select');
        pselect.id = data['@parentId'];
        pselect.name = 'parentId';
        const cselect = document.createElement('select');
        cselect.id = data['@childId'];
        cselect.name = 'childId';
        if (data['>']) {
            const parentData = data['>'];
            parentData.forEach((element) => {
                const optionsTag = document.createElement('option');
                optionsTag.value = element['@class'];
                optionsTag.textContent = element['@name'];
                pselect.appendChild(optionsTag);
                node.append(pselect);
                element['>'].forEach((el) => {
                    const childOpts = document.createElement('option');
                    childOpts.value = el['@value'];
                    $(childOpts).attr('data-available-with', el['@class']);
                    childOpts.textContent = el['@name'];
                    cselect.appendChild(childOpts);
                    node.append(cselect);
                });
            });
        }
        $(`#${data['@childId']}`).chainedTo(`#${data['@parentId']}`);
    }
}

module.exports = ChainedSelect;
