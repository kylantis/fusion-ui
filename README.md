
## Project Panther FE


Kylantis Studio is a Low Code Platform used for building next generation enterprise-grade applications. 

This repository contains the tools needed to compile component libraries for the kylantis enterprise server (https://github.com/tonyobanon/project_panther) .


### Philosophy

We believe that the future of web development is templating-based and model-driven, and this cutting edge platform aims to explore this new frontier.

From our research, we know that the current paradigm for building web applications is not sustainable, as it is unable to evolve to meet the demands of tomorrow's data-driven applications.

Hence, we propose a new paradigm for architecting web applications.

Our approach is simple
- Developers create a Component using the technologies you know and love HTML, CSS and Javascript. Each component has a one or more view files










### Default Component Set
The default set of components are based on Lightning Design: https://www.lightningdesignsystem.com, and this includes all he css, fonts and images files.


### Getting Started
A comprehensive developer guide will be developed, once we have a feature-complete alpha version. All the current APIs are pretty much prone to change at this point, as we are still in the very early 




### Adding new Components


### Client-side rendering
During the compilation phase, the following component artifacts are geme



### Server-side rendering (Java)
To render your component suite on the Kylantis enterprise server, follow the steps below:
- Install the latest stable JDK version
- Run `git clone https://github.com/tonyobanon/project_panther`
- Run `git checkout feature/snapshot0` (to access the latest changeset)
- Install gradle dependencies
- Add the generated component library (fusion-ui.jar) to the classpath. You can find this file in the `build` folder.
- Add a HelloWorld service to render your component



- Run the application com.re.paas.internal.runtime.spi.Application
- You should see your component rendered  http://localhost:8081/platform/hello/greet

### Setup
To setup this project locally:
- Clone the repository:
 `git clone git@github.com:tonyobanon/project_panther_fe.git`
- Install `nvm` if you don't already have it
- `nvm use`
- `npm install`
- Run `npm run build-all` (If this is your first time running the project)
- Compile `npm run build`
- The in another terminal, run `npm start`
- Visit `localhost:8090/components/<component_name>` to render a component
