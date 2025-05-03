
## Fusion UI

Fusion UI is a next-generation UI framework that enables developers create UI components using web technologies, and then embed these components into their server-side applications written in java and other server-side languages.

We currently support Java, but support for other languages is coming soon. If you want to add support for your favorite server-side language, feel free to issue a PR.

This repository contains the tools needed to compile ui component libraries for the Kylantis enterprise server (or any server that implements the fusion archiecture). The tools include:
- The template compiler
- UI rendering engine
- Schema modelling tooling
- Sample components

Out of the box, we provide 100+ reference components to help you quickly learn how to build your own components. These reference components are based on Salesforce Lightning Design, but you can use any css library of your choice.

### Philosophy

We believe that the future of web development is templating-based and model-driven, and this cutting edge web framework aims to explore this new frontier.

From our research, we know that the current paradigm for building web applications is not sustainable, as it is unable to evolve to meet the demands of tomorrow's data-driven applications.

Hence, we propose a new paradigm for architecting web applications.

Our approach is simple:

- Developers create components using the familiar technologies they know and love, i.e. HTML, CSS and Javascript. Using a custom handlebars dialect, control flow logic can be embedded into the markup.
- As part of the development process, developers are able to model the component's data domain - using a myriad of techniques.
- Components are compiled into a format - which can be embedded into any server-side application.

### Setup
- Clone the repository
- Run `npm install` (If you use nvm, run `nvm use` first)
- Run `npm run build` to build all assets
- Run `npm run start-server`
- Visit `localhost:8090/components/<component_name>` to render a component (each compiled component is stored in `dist/components/<component_name>` folder)

### Contact
Feel free to drop us a line - web_engineering@kylantis.com

## License
This software is licensed under GPLv3

