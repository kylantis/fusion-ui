
// Todo: Populate this file and refractor project
class SchemaError extends Error {
    constructor(message) {
        super(message);
        this.name = SchemaError.name;
    }
}
module.exports = SchemaError;