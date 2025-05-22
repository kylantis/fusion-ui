
module.exports = {
    pkgName: 'com.kylantis.apps.api.fusion.client.components.platform',
    baseComponent: ["LightningComponent"],
    /**
     * In some cases, during component imports, we may need to load an arbitrary scalar
     * component, hence we pick from this list
     */
    scalarComponents: ["Icon"],
    
    extendedWindowProperties: [
        'HTMLElement', 'Element', 'Node', 'ResizeObserver'
    ],
}