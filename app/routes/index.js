import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { v4 as uuid } from 'uuid';
import { namedNode } from 'rdflib';
import { tracked } from '@glimmer/tracking';

export default class IndexRoute extends Route {
  queryParams = {
    form: {
      refreshModel: true,
    },
  };

  @service solidAuth;
  @service store;

  supportedClass;
  @tracked form;

  @tracked loadedFormUri;

  @tracked vocabulary = 'http://www.w3.org/ns/shacl#';

  async model({ form }) {
    await this.solidAuth.ensureLogin();

    console.log('editing form', form);
    this.configureStorageLocations(form);

    await this.fetchGraphs(form !== null);

    if (form) {
      this.loadForm();
    } else {
      this.initiateNewShaclForm();
    }
    return this;
  }

  configureStorageLocations(form) {
    const storageLocation = form ? form : `private/tests/forms/${uuid()}.ttl`;
    this.loadedFormUri = storageLocation;
    this.store.classForModel('hydra-class').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('rdf-form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('rdf-form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('rdf-form-option').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form-option').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form-choice').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('shacl-form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('shacl-form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('shacl-form-option').solid.defaultStorageLocation =
      storageLocation;
  }

  async fetchGraphs(removeN3Rules = false) {
    // Remove all N3 rules from the resource.
    let matches;
    if (removeN3Rules) {
      matches = await this.removeN3RulesFromResource();
    }

    await this.store.fetchGraphForType('hydra-class', true);
    await this.store.fetchGraphForType('rdf-form', true);
    await this.store.fetchGraphForType('rdf-form-field', true);
    await this.store.fetchGraphForType('rdf-form-option', true);
    await this.store.fetchGraphForType('ui-form', true);
    await this.store.fetchGraphForType('ui-form-field', true);
    await this.store.fetchGraphForType('ui-form-option', true);
    await this.store.fetchGraphForType('ui-form-choice', true);
    await this.store.fetchGraphForType('shacl-form', true);
    await this.store.fetchGraphForType('shacl-form-field', true);
    await this.store.fetchGraphForType('shacl-form-option', true);

    // Add N3 rules back to the resource.
    if (removeN3Rules) {
      await this.addN3RulesToResource(matches);
    }
  }

  initiateNewRdfForm() {
    this.supportedClass = this.store.create('hydra-class', {
      method: 'POST',
    });
    this.form = this.store.create('rdf-form', {
      endpoint: namedNode('https://httpbin.org/post'),
      supportedClass: this.supportedClass,
    });
  }

  initiateNewSolidUiForm(fields) {
    this.form = this.store.create('ui-form', {
      fields: fields,
    });
  }

  initiateNewShaclForm() {
    this.form = this.store.create('shacl-form', {});
  }

  loadForm() {
    // Try rdf-form vocabulary first.
    this.supportedClass = this.store.all('hydra-class')[0];
    this.form = this.store.all('rdf-form')[0];
    this.vocabulary = 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
    if (this.form === undefined) {
      // Try solid-ui vocabulary.
      this.form = this.store.all('ui-form')[0];
      this.vocabulary = 'http://www.w3.org/ns/ui#';
    }
    if (this.form === undefined) {
      // Try shacl vocabulary.
      this.form = this.store.all('shacl-form')[0];
      this.vocabulary = 'http://www.w3.org/ns/shacl#';
    }
    console.log('loaded form', this.form);
    console.log('loaded supportedClass', this.supportedClass);
  }

  async removeN3RulesFromResource() {
    const fetch = this.solidAuth.session.fetch;

    const response = await fetch(this.loadedFormUri, {
      method: 'GET',
    });

    // Get content-type.
    const contentType = response.headers.get('content-type');

    // Get content.
    let text = await response.text();
    console.log(text);

    // Match prefixes.
    const prefixRegex = /(@prefix|PREFIX)\s+[^:]*:\s*<[^>]*>\s*\.?\n/g;
    const prefixes = text.match(prefixRegex);

    // Match N3 rules.
    const rulesRegex =
      /\{[^{}]*}\s*(=>|[^\s{}]*implies[^\s{}]*)\s*{[^{}]*}\s*\./g;
    const rules = text.match(rulesRegex);
    console.log(rules);

    // Remove N3 rules.
    rules?.forEach((match) => {
      text = text.replace(match, '');
    });

    // Save resource without N3 rules.
    await fetch(this.loadedFormUri, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: text,
    });

    return { rules, prefixes };
  }

  async addN3RulesToResource(matches) {
    const { rules, prefixes } = matches;
    const fetch = this.solidAuth.session.fetch;

    const response = await fetch(this.loadedFormUri, {
      method: 'GET',
    });

    // Get content-type.
    const contentType = response.headers.get('content-type');

    // Get content.
    let text = await response.text();

    // Match prefixes.
    const prefixRegex = /(@prefix|PREFIX)\s+[^:]*:\s*<[^>]*>\s*\.?\n/g;
    const matchedPrefixes = text.match(prefixRegex);

    // Add prefixes in front if not already present.
    prefixes?.forEach((prefix) => {
      if (!matchedPrefixes?.includes(prefix)) {
        text = prefix + text;
      }
    });

    // Add N3 rules.
    rules.forEach((match) => {
      text += match;
    });

    // Save resource with N3 rules.
    await fetch(this.loadedFormUri, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: text,
    });
  }
}
