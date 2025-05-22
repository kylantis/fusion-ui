
// Todo: Populate this file and refractor project
class TemplateError extends Error {
    constructor(message) {
        super(message);
        this.name = TemplateError.name;
    }
}
module.exports = TemplateError;