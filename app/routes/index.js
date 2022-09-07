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

  loadedFormUri;

  @tracked vocabulary = 'http://www.w3.org/ns/shacl#';

  async model({ form }) {
    await this.solidAuth.ensureLogin();

    console.log('editing form', form);
    this.configureStorageLocations(form);

    await this.fetchGraphs();

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

  async fetchGraphs() {
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
}
