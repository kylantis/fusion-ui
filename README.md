
## Project Panther FE

This repository contains the tools needed to compile component libraries for the kylantis enterprise server. It also includes sample components to help you learn quickly how to build your own components. The sample components here are based on Lightning Design: https://www.lightningdesignsystem.com, but you can use any css library of your choice


### Setup
To setup this project locally:
- Clone the repository:
 `git clone git@github.com:tonyobanon/project_panther_fe.git`
- Install `nvm` if you don't already have it
- `nvm use`
- `npm install`
- Run `npm run build-all` (If this is your first time running the project)
- Compile `npm run build-watch`
- The in another terminal, run `npm start`
- Visit `localhost:8090/components/<component_name>` to render a component
