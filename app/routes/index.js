import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { v4 as uuid } from 'uuid';
import { namedNode } from 'rdflib';

export default class IndexRoute extends Route {
  queryParams = {
    form: {
      refreshModel: true,
    },
  };

  @service solidAuth;
  @service store;

  supportedClass;
  form;

  async model({ form }) {
    await this.solidAuth.ensureLogin();

    console.log('editing form', form);
    this.configureStorageLocations(form);

    await this.store.fetchGraphForType('hydra-class');
    await this.store.fetchGraphForType('form');
    await this.store.fetchGraphForType('form-field');
    await this.store.fetchGraphForType('form-option');

    if (form) {
      this.loadForm();
    } else {
      this.initiateNewForm();
    }
    return this.form;
  }

  configureStorageLocations(form) {
    const storageLocation = form ? form : `private/tests/forms/${uuid()}.ttl`;
    this.store.classForModel('hydra-class').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('form-option').solid.defaultStorageLocation =
      storageLocation;
  }

  initiateNewForm() {
    this.supportedClass = this.store.create('hydra-class', {
      method: 'POST',
    });
    this.form = this.store.create('form', {
      endpoint: namedNode('https://httpbin.org/post'),
      supportedClass: this.supportedClass,
    });
  }

  loadForm() {
    this.supportedClass = this.store.all('hydra-class')[0];
    this.form = this.store.all('form')[0];
    console.log('loaded form', this.form);
    console.log('loaded supportedClass', this.supportedClass);
  }
}
