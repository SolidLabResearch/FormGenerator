import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

export default class IndexController extends Controller {
  @service store;

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
  sortEndAction(event) {
    console.log('sortEndAction', this.fields);
  }
}
