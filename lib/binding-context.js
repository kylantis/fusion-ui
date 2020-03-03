
const INPUT_TYPE = 1;
const TEXT_NODE_TYPE = 1;

module.exports.BasicBindingContext = class {

    /**
     * @param {String} id This is the unique id is used to identify this
     * mustache statement. The id should be assigned to a surrounding 
     * HTML span element, that will be used later for real-time updates
     * 
     * @param {String} path This is the finalized path after taking into
     * consideration any prior context switching operation(s)
     * 
     * @param bindingType This indicates the bindng type, whether
     * input(two-way) or text node (one-way)
     * 
     * @param helper This indicates the name of the helper (if any) that is attached
     * to this context
     */
    constructor(id, path, bindingType, helper) {
        this.id = id;
        this.path = path;
        this.bindingType = bindingType;
    }

    validatePath(component) {
        const input = component.getSampleInputData();

    }
}

module.exports.ArrayBindingContext = class {



}