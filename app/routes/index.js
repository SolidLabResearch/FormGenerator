import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { v4 as uuid } from 'uuid';

export default class IndexRoute extends Route {
  @service solidAuth;
  @service store;

  async model() {
    await this.solidAuth.ensureLogin();

    this.configureStorageLocations();

    await this.store.fetchGraphForType('form');
    await this.store.fetchGraphForType('form-field');
    await this.store.fetchGraphForType('form-option');

    return [];
  }

  configureStorageLocations() {
    const storageLocation = `private/tests/forms/${uuid()}.ttl`;
    this.store.classForModel('form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('form-option').solid.defaultStorageLocation =
      storageLocation;
  }
}
