## Overview

- beforeCompile()
- component lifecycle


## Guidelines
- If your component wants to load other components before it is fully mounted itself, either await component.load(...) or this.futures.push(component.load(...)). Don't just do a blanket component.load(...) because this will cause problems when your component is rendered on the server side. The server will wait for the top-level component to be loaded, after which browser globals will be cleared from Node and html written.

## Technical guidelines

- When creating custom Boolean Operators, the names must be specified in uppercase, else it will be inaccessible from your template

## Architectural guidelines
When creating components, there are some architectural guidelines you need to need to keep in mind, in order to create high-quality components

- Use Shared Enums where possible: Enums are a set of pre-determined values, a concept that exist in many programming languages. Enums can be defined individually for each field, but if you see that there are fields that share the same value set across components, you should create a shared enum, and have the components reference that instead.

- Create a consistent data model: Often times when a component has multiple variations, it becomes easy for the data model to become complex because you need to cater for multiple fields across the spectrum. In the initial component design, consistency in the data model should be a major determinant of how you construct the template

- Use partials: Partials are a great way to keep your templates clean, concise and maintainable. Use inline template for smaller snippets and external (file-based) templates for larger ones. 
// TODO: REMOVE TEXT BELOW:
The compiler will make best effort to perform ahead of time partial inlining. There are two main scenarios when the partials are loaded at runtime. Either the partial statement is inside a custom context, or it's in the root context, but one or more hashes is a sub expression, method invocation or ternary expression.

- Take advantage of type merging: For larger components, multiple fields may have intersecting object signatures - in which case it is necessary to enable type merging so that a shared type can be created and then referenced accross the component. It is indeed necessary to do so, because otherwise there will be errors during the schema generation because of multiple class names.

- Test your components on the server: You may be tempted to focus more on the browser rendering of our components when testing, and this ignore the server rendered version - but this is strongly discouraged. Ideally, you want to ensure that your DOM manipulation code (specifically query selectors) works exactly the same way irrespective of where it is rendered.

- Make your helper invocations async: When using template helpers that perform long-running tasks (relatively speaking), it's best to make these invocations async, so that they don't drastically increase the initial rendering time of your component. The only disadvantage in doing so is that: paths in an async context cannot access paths in an iteration context. To make async, add the hash "async=true" to either your mustache statement or custom block. When dealing with asynchronousity, note the following:
    - If the actual method being called returns a promise, then it must be marked accordingly as async in the template.
    - An async method cannot be the target of an #each or #with block. If it is used on an #if block, it will always evaluate to true

- Subclass existing components where necessary: Even though each component has it's own template file that is not shared, components can extend a component class. If subclassing, make sure both component classes have a compatible data model, i.e. ensure that either the fields are unique, or the intersecting fields have the same type, else you will experience compilation errors during model generation due to conflicting method signatures. Also, if Y extends X, it implies that all fields in X are applicable to Y. If this is not the case, then Y should not be extending X.

- Use variables as necessary. It's good practice to use variables especially when expressions are reused in multiple template location. That said, in some cases, you must use variables. For example: to embed an expression in a MustacheGroup e.g. 
    ```
    {{var prefix=(isMale ? "Mr" : "Mrs")}}
    {{"${welcomeMsg}, ${prefix} Doe."}}
    ```
    Since mustache groups can only contain literals and PathExpressions, we are able to embed expressions in it with the use use of variables



- Learn by looking at the built-in components: This framework comes pre-loaded with an exhaustive list of components that you can use out of the box and also learn from.



## Creating Components
- Your component test.js file should contain polyfills for a test environment, i.e. mocking SPI calls, If you have a function called getDataFromAPI(...) in component .js file, you need to add a method called getDataFromAPI(...) to test.js file as well and return mock data


## Collections

- #each
    - Ternary expressions are supported


- #with


- Collections can generally contain null members, but you should avoid nulls on the first and last members of a collection at any given point, if your #each block uses @first and @last. This is because null collection members are always represented as an empty strings, hence any conditional expression targeting @first and @last will not be executed if nulls are present on the first and last members respectively

### Manipulating collection members

- Setting a member to undefined will detach it from the DOM list
- Seeting a member to null will cause the list item to be updated to an empty string
- If non-last member(s) are removed, subsequent items are moved to the left by the number of removed members
- If non-last member(s) are added, subsequent items are moved to the right by the number of added members
- If sparse indexes are created when a new index is added to an array, they are backfilled with empty string


## Partials

- A partial statement is used to render either a decorator block or an external file

- When creating partials that may be used accross a myriad of components, you should prefix "free-form" paths with "this" to access paths in the current context, so that the compiler does not match it to a scope qualifier in an outer context, i.e. you should do {{this.abc}} instead of {{abc}} if you want to be extra sure that `abc` will resolve in the current context; 

    - Examples of non-free form paths include: {{[0]}} , {{.././.}}, {{@index}}, e.t.c
    - Exampmple of free-form paths include {{abc}}

- Loading partials from unverified sources is potentially unsafe, hence developers need to take extra precaution. If in a custom context and you want to prevent access to the root context from a partial, add the hash "allowRootAccess=false" to the enclosing custom block.

 - If a property on the root context of a partial is the same as a global variable name, the global variable will always take precedence. For example: If a global variable called "abc" exists, accessing {{@root.abc}} in a partial will refer to the global variable, not the property in the current context

 - When {{@root}} is used inside a partial, it references the context from which the partial was loaded

 ## Reserved browser globals
 The following properties exists in the global namespace:
 - `Handlebars`
 - `clientUtils`
 - `customCtxHelpers`
 - `RootProxy`
 - `BaseRenderer`
 - `RootCtxRenderer`
 - `CustomCtxRenderer`
 - `WebRenderer`
 - `BaseComponent`
 - `Handlebars`
 - `appContext`
 - `isServer`
 - `rootComponent`

 They are used internally to provide framework functionality, and making any modifications to these properties will break all your components.


 ## Notable differences with handlebars

- New frames are created for all blocks including #with blocks.
- If multiple pairs have the same key in a hash, then the last occuring pair is used, instead of the first


 ## Global Variables

- Global vatriables resolve leniently by default
- TODO

 ## Component Configuration

- src/components/config
- src/components/**/config


## Variables
Variables cannot be accessed like ../../x

## Transform
A transform is the name of a component method that receives the resolved value of a mustache or block expression, and returns the new value you want to transform it to.



## Component Class

- When defining a component class, there should only be one top-level class declaration (that is, the one which is exported)