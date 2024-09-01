
// Note: In this file, use the src folder name of the component, not the className

module.exports = {
    /**
     * In some cases, during component imports, we may need to load an arbitrary scalar
     * component, hence we pick from this list
     */
    scalarComponents: ["Icon"],
    
    extendedWindowProperties: [
        'HTMLElement', 'Element', 'Node', 'ResizeObserver'
    ],

    componentReferences: ["Tooltip"],

    serverExludedFiles: [
        "/components/*/config.json"
    ],
}