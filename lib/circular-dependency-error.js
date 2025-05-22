
class CircularDependencyError extends Error {

    constructor(target, source) {
        super(`Circular dependency detected for component: ${target} in ${source}`);
    }
}

module.exports = CircularDependencyError;