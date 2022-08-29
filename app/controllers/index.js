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

  vocabulary = 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';

  @tracked
  fields = (() => {
    let fields;
    if (this.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#') {
      fields = A(this.store.all('rdf-form-field').sortBy('order'));
      fields.forEach((field) => {
        field.isSelect = field.widget === 'dropdown';
        field.canHavePlaceholder =
          field.rdfType.value ===
            'http://rdf.danielbeeke.nl/form/form-dev.ttl#Field' &&
          (field.widget === 'string' || field.widget === 'textarea');
      });
    } else if (this.vocabulary === 'http://www.w3.org/ns/ui#') {
      fields = A(this.store.all('ui-form-field').sortBy('order'));
      fields.forEach((field) => {
        field.isSelect =
          field.rdfType.value === 'http://www.w3.org/ns/ui#Choice';
        field.options = this.store
          .all('ui-form-option')
          .filter((option) => option.rdfType.value === field.choice.uri.value);
      });
    }
    return fields;
  })();

  @action
  addFormElement(type) {
    if (type) {
      if (this.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#') {
        const field = this.store.create('rdf-form-field', {
          widget: type,
        });
        field.isSelect = type === 'dropdown';
        field.canHavePlaceholder = type === 'string' || type === 'textarea';
        this.fields = [...this.fields, field];
      } else if (this.vocabulary === 'http://www.w3.org/ns/ui#') {
        const field = this.store.create('ui-form-field', {});
        field.setRdfType(this.getSolidUiRdfTypeFromWidgetType(type));
        field.widget = type;
        field.isSelect = type === 'dropdown';
        if (field.isSelect) {
          field.choice = this.store.create('ui-form-choice', {
            comment: 'Choice object for a dropdown form field',
          });
        }
        this.fields = [...this.fields, field];
      }
    }
  }

  @action
  async save(event) {
    event.preventDefault();

    this.fields.forEach((field, i) => {
      field.order = i;
      field.label = field.label.trim();
      field.required = field.required || false;
      if (this.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#') {
        field.multiple = field.multiple || false;
      }
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
    this.model.form.fields = this.fields;

    await this.store.persist();
  }

  @action
  updateBinding(element, event) {
    if (element.isUiFormOption) {
      element.setUri(namedNode(event.target.value));
    } else {
      element.binding = namedNode(event.target.value);
    }
  }

  @action
  updateChoiceBinding(element, event) {
    element.choice.setUri(namedNode(event.target.value));
    element.options.forEach((option) => {
      option.setRdfType(element.choice.uri);
    });
  }

  @action
  addOption(field, event) {
    event.preventDefault();
    event.target.closest('.btn').disabled = true;

    if (this.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#') {
      const option = this.store.create('rdf-form-option', {});
      field.options = [...field.options, option];
    } else if (this.vocabulary === 'http://www.w3.org/ns/ui#') {
      const option = this.store.create('ui-form-option', {});
      option.setRdfType(field.choice.uri);
      field.options = [...field.options, option];
    }

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
    event?.preventDefault();

    // Remove all the options of the field if it is a select.
    if (field.isSelect) {
      field.options.forEach((option) => {
        option.destroy();
      });
      field.options.clear();

      if (this.vocabulary === 'http://www.w3.org/ns/ui#') {
        field.choice.destroy();
      }
    }
    field.required = null;
    field.multiple = null;
    this.fields = this.fields.filter((f) => f.uuid !== field.uuid);
    field.destroy();
  }

  @action
  changeVocabulary(event) {
    // Clear any existing form.
    this.fields.forEach((field) => {
      this.removeField(field);
    });
    this.model.form.destroy();
    this.model.supportedClass?.destroy();

    // Update the vocabulary.
    this.vocabulary = event.target.value;

    // Create new form.
    if (this.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#') {
      this.model.initiateNewRdfForm();
    } else if (this.vocabulary === 'http://www.w3.org/ns/ui#') {
      this.model.initiateNewSolidUiForm(this.fields);
    }

    console.log('changeVocabulary', this.vocabulary);
  }

  getSolidUiRdfTypeFromWidgetType(type) {
    if (type === 'string') {
      return namedNode('http://www.w3.org/ns/ui#SingleLineTextField');
    } else if (type === 'textarea') {
      return namedNode('http://www.w3.org/ns/ui#MultiLineTextField');
    } else if (type === 'dropdown') {
      return namedNode('http://www.w3.org/ns/ui#Choice');
    } else if (type === 'date') {
      return namedNode('http://www.w3.org/ns/ui#DateField');
    } else if (type === 'checkbox') {
      return namedNode('http://www.w3.org/ns/ui#BooleanField');
    } else {
      return null;
    }
  }
}
