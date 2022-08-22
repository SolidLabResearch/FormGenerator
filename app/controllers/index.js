import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { namedNode } from 'rdflib';

export default class IndexController extends Controller {
  @service store;
  @service solidAuth;

  @tracked
  fields = A([]);

  @action
  addFormElement(type) {
    if (type) {
      console.log('addFormElement', type);
      const field = this.store.create('form-field', {
        widget: type,
      });
      this.fields = [...this.fields, field];
    }
  }

  @action
  async save(event) {
    event.preventDefault();

    this.fields.forEach((field, i) => {
      field.order = i;
      field.label = field.label.trim();
      field.required = field.required || false;
    });

    await this.store.persist();
  }

  @action
  updateBinding(field, event) {
    field.binding = namedNode(event.target.value);
  }
}
