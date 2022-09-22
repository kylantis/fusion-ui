## Overview

- initCompile()
- component lifecycle


## Guidelines
- If your component wants to load other components before it is fully mounted itself, either await component.load(...) or this.futures.push(component.load(...)). Don't just do a blanket component.load(...) because this will cause problems when your component is rendered on the server side. The server will wait for the top-level component to be loaded, after which browser globals will be cleared from Node and html written.

## Technical guidelines

- When creating custom Boolean Operators, the names must be specified in uppercase, else it will be inaccessible from your template

## Architectural guidelines
When creating components, there are some architectural guidelines you need to need to keep in mind, in order to create high-quality components

- Use Shared Enums where possible: Enums are a set of pre-determined values, a concept that exist in many programming languages. Enums can be defined individually for each field, but if you see that there are fields that share the same value set across components, you should create a shared enum, and have the components reference that instead.

- Create a consistent data model: Often times when a component has multiple variations, it becomes easy for the data model to become complex because you need to cater for multiple fields across the spectrum. In the initial component design, consistency in the data model should be a major determinant of how you construct the template

- Use partials: Partials are a great way to keep your templates clean, concise and maintainable. Use inline template for smaller snippets and external (file-based) templates for larger ones. The compiler will make best effort to perform ahead of time partial inlining. There are two main scenarios when the partials are loaded at runtime. Either the partial statement is inside a custom context, or it's in the root context, but one or more hashes is a sub expression, method invocation or ternary expression.

- Take advantage of type merging: For larger components, multiple fields may have intersecting object signatures - in which case it is necessary to enable type merging so that a shared type can be created and then referenced accross the component. It is indeed necessary to do so, because otherwise there will be errors during the schema generation because of multiple class names.

- Test your components on the server: You may be tempted to focus more on the browser rendering of our components when testing, and this ignore the server rendered version - but this is strongly discouraged. Ideally, you want to ensure that your DOM manipulation code (specifically query selectors) works exactly the same way irrespective of where it is rendered.

- Make your helper invocations async: When using template helpers that perform long-running tasks (relatively speaking), it's best to make these invocations async, so that they don't drastically increase the initial rendering time of your component. For mustache statements and custom blocks, add the hash async=true

- Subclass existing components where necessary: Even though each component has it's own template file that is not shared, components can extend a component class. If subclassing, make sure both component classes have a compactible data model, i.e. ensure that either the fields are unique, or the intersecting fields have the same type, else you will experience compilation errors during model generation due to conflicting method signatures. Also, if Y extends X, it implies that all fields in X are applicable to Y. If this is not the case, then Y should not be extending X.

- Use variables as necessary.

- Learn by looking at the built-in components: This framework comes pre-loaded with an exhaustive list of components that you can use out of the box and also learn from.


## Debugging Templating issues
For beginners, when creating templates you may encounter some parser error. Below are some tips that may be helpful.

- For block statements, hashes comes before params, while for partial statements the reverse is the case.

## Data binding 

- If you want to data-bind on any of the data variables of a collection, ensure that it's an object collection not a scalar one, else data binding will not work for the data variable.