import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { namedNode } from 'rdflib';

export default class IndexController extends Controller {
  queryParams = ['form'];

  @service store;
  @service solidAuth;

  @tracked
  fields = (() => {
    const fields = A(this.store.all('form-field').sortBy('order'));
    fields.forEach((field) => {
      field.isSelect = field.widget === 'dropdown';
    });
    return fields;
  })();

  @action
  addFormElement(type) {
    if (type) {
      console.log('addFormElement', type);
      const field = this.store.create('form-field', {
        widget: type,
      });
      field.isSelect = type === 'dropdown';
      field.canHavePlaceholder = type === 'string' || type === 'textarea';
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
      field.multiple = field.multiple || false;
      if (field.isSelect) {
        field.options = [...field.options];
        field.options.forEach((option) => {
          option.label = option.label.trim();
        });
      }
      if (field.canHavePlaceholder && field.placeholder) {
        field.placeholder = field.placeholder?.trim();
      }
    });

    await this.store.persist();
  }

  @action
  updateBinding(element, event) {
    element.binding = namedNode(event.target.value);
  }

  @action
  addOption(field, event) {
    event.preventDefault();
    event.target.closest('.btn').disabled = true;

    const option = this.store.create('form-option', {
      field: field,
    });
    field.options = [...field.options, option];

    event.target.closest('.btn').disabled = false;
  }

  @action
  removeOption(field, option, event) {
    event.preventDefault();
    field.options = field.options.filter((o) => o.uuid !== option.uuid);
    option.destroy();
  }

  @action
  removeField(field, event) {
    event.preventDefault();

    // Remove all the options of the field if it is a select.
    if (field.isSelect) {
      field.options.forEach((option) => {
        option.destroy();
      });
      field.options.clear();
    }
    this.fields = this.fields.filter((f) => f.uuid !== field.uuid);
    field.destroy();
  }
}
