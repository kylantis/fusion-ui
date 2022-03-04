
module.exports = {
    /**
    * Define the component load order in this file. Note: you don't have to define
    * all components in this file, but it is guaranteed that those declared here
    * will be loaded first, in the order defined.
    */
    loadOrder: [
        // All components extend AbstractComponent, hence this must be first
        "abstract-component",
    ],
    /**
     * In some cases, during component imports, we may need to load an arbitrary scalar
     * component, hence we pick from this list
     */
    scalarComponents: ["icon"]
}