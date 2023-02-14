# form-generator

A form generator app with Solid - Google Forms but the Solid way.

This application functions as a proof of concept for the Solid ecosystem. It is a form generator that allows users to
create form definitions and share them with other users. The generated form definition as RDF is stored in a user's Pod
and can then be used together with a form renderer to render the form.

Such a form renderer is not part of this repository, but can be found
at [phochste/FormViewer](https://github.com/phochste/FormViewer).

This application functions as the solution for
the [[SolidLabResearch/Challenges#64] Drag & drop form builder app to build a basic RDF form definition](https://github.com/SolidLabResearch/Challenges/issues/64)
challenge which is part of
the [[SolidLabResearch/Challenges#19] Solid basic form builder (Google Forms but the Solid way)](https://github.com/SolidLabResearch/Challenges/issues/19)
scenario.

A live version of this application can be found at [https://formgenerator.smessie.com/](https://formgenerator.smessie.com/).

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (with npm)
* [Ember CLI](https://cli.emberjs.com/release/)
* [Google Chrome](https://google.com/chrome/)

## Installation

* `git clone <repository-url>` this repository
* `cd form-generator`
* `npm install`

## Running / Development

* `ember serve` (or `npx ember serve` if ember not installed globally)
* Visit your app at [http://localhost:4200](http://localhost:4200).
* Visit your tests at [http://localhost:4200/tests](http://localhost:4200/tests).

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `ember test`
* `ember test --server`

### Linting

* `npm run lint`
* `npm run lint:fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

Just upload the content in `dist/` to your webserver after building as described above.

## Contribution

We make use of [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

When making changes to a pull request, we prefer to update the existing commits with a rebase instead of appending new
commits.

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://cli.emberjs.com/release/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
