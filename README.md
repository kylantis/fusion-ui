

## Fusion UI

Fusion UI is a next-generation web framework used for building the world's best enterprise app experiences. Our library allows you to create UI components using web technologies, that can then be embedded into any server-side language.

This repository contains the tools needed to compile component libraries for kylantis enterprise server - this includes:
- The core compiler
- UI rendering engine
- Schema modelling tooling
- Sample components

The sample components to help you quickly learn how to build your own components. The sample components are provided for your reference and based on Lightning Design: https://www.lightningdesignsystem.com, but you can use any css library of your choice. There are almost 100 UI components for you to choose from.


### Philosophy

We believe that the future of web development is templating-based and model-driven, and this cutting edge platform aims to explore this new frontier.

From our research, we know that the current paradigm for building web applications is not sustainable, as it is unable to evolve to meet the demands of tomorrow's data-driven applications.

Hence, we propose a new paradigm for architecting web applications.

Our approach is simple
- Developers create a Component using the technologies you know and love HTML, CSS and Javascript. We have designed a custom handlebars dialect that allows developers to embed control flow logic into their markup.
- As part of the development process, developers are able model the component's data domain - using multiple paradigms.
- The Component is then compiled into a format - which can be embedded into their Kylantis application
- Our server natively integrates with Fusion UI framework - so you can seamlessly create UI pages using only Java - This is unprecedented.


### Setup
- Clone the repository
- Run `npm install` (If you use nvm, run `nvm use` first)
- Run `npm run build-all` to build all assets
- Run `npm run start-server`
- Visit `localhost:8090/components/<component_name>` to render a component



## Contact
Feel free to reach me at: tony@kylantis.com

