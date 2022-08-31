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

  @tracked isRdfFormVocabulary =
    this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
  @tracked isSolidUiVocabulary =
    this.model.vocabulary === 'http://www.w3.org/ns/ui#';

  @tracked success = null;

  @tracked formTarget = this.form;

  @tracked
  fields = (() => {
    let fields;
    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      fields = A(this.store.all('rdf-form-field').sortBy('order'));
      fields.forEach((field) => {
        field.isSelect = field.widget === 'dropdown';
        field.canHavePlaceholder =
          field.rdfType.value ===
            'http://rdf.danielbeeke.nl/form/form-dev.ttl#Field' &&
          (field.widget === 'string' || field.widget === 'textarea');
      });
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
      fields = A([
        ...this.store.all('ui-form-field', {
          rdfType: namedNode('http://www.w3.org/ns/ui#SingleLineTextField'),
        }),
        ...this.store.all('ui-form-field', {
          rdfType: namedNode('http://www.w3.org/ns/ui#MultiLineTextField'),
        }),
        ...this.store.all('ui-form-field', {
          rdfType: namedNode('http://www.w3.org/ns/ui#Choice'),
        }),
        ...this.store.all('ui-form-field', {
          rdfType: namedNode('http://www.w3.org/ns/ui#DateField'),
        }),
        ...this.store.all('ui-form-field', {
          rdfType: namedNode('http://www.w3.org/ns/ui#BooleanField'),
        }),
      ]).sortBy('order');
      fields.forEach((field) => {
        field.widget = this.getWidgetTypeFromSolidUiRdfType(field.rdfType);
        field.isSelect =
          field.rdfType.value === 'http://www.w3.org/ns/ui#Choice';
        field.options = this.store.all('ui-form-option', {
          rdfType: field.choice?.uri,
        });
        field.options.forEach((option) => {
          option.binding = option.uri;
        });
      });
    }
    return fields;
  })();

  isEqual = (a, b) => {
    return a === b;
  };

  @action
  addFormElement(type) {
    if (type) {
      if (
        this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
      ) {
        const field = this.store.create('rdf-form-field', {
          widget: type,
        });
        field.isSelect = type === 'dropdown';
        field.canHavePlaceholder = type === 'string' || type === 'textarea';
        this.fields = [...this.fields, field];
      } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
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

    event.target.disabled = true;
    event.target.innerText = 'Saving...';

    if (this.formTarget !== this.form) {
      this.model.configureStorageLocations(this.formTarget);
      await this.model.fetchGraphs();
      this.store.changeGraph(namedNode(this.form), namedNode(this.formTarget));

      /*this.model.form.defaultGraph = namedNode(this.formTarget);
      if (this.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#') {
        this.model.supportedClass.defaultGraph = namedNode(this.formTarget);
      }
      this.fields.forEach((field) => {
        field.defaultGraph = namedNode(this.formTarget);
        if (field.isSelect) {
          if (this.vocabulary === 'http://www.w3.org/ns/ui#') {
            field.choice.defaultGraph = namedNode(this.formTarget);
          }
          field.options.forEach((option) => {
            option.defaultGraph = namedNode(this.formTarget);
          });
        }
      });*/

      console.log(this.store.match(undefined, undefined, undefined, this.form));
    }

    this.fields.forEach((field, i) => {
      field.order = i;
      field.label = field.label.trim();
      field.required = field.required || false;
      if (
        this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
      ) {
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

    if (this.formTarget !== this.form) {
      console.log('Changing query parameter form');
      this.form = this.formTarget;
    }

    this.success = 'Successfully saved the form definition!';
    event.target.disabled = false;
    event.target.innerText = 'Save';
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

    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      const option = this.store.create('rdf-form-option', {});
      field.options = [...field.options, option];
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
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

      if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
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
    this.model.vocabulary = event.target.value;

    // Create new form.
    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      this.model.initiateNewRdfForm();
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
      this.model.initiateNewSolidUiForm(this.fields);
    }

    this.isRdfFormVocabulary =
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
    this.isSolidUiVocabulary =
      this.model.vocabulary === 'http://www.w3.org/ns/ui#';
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

  getWidgetTypeFromSolidUiRdfType(type) {
    if (type.value === 'http://www.w3.org/ns/ui#SingleLineTextField') {
      return 'string';
    } else if (type.value === 'http://www.w3.org/ns/ui#MultiLineTextField') {
      return 'textarea';
    } else if (type.value === 'http://www.w3.org/ns/ui#Choice') {
      return 'dropdown';
    } else if (type.value === 'http://www.w3.org/ns/ui#DateField') {
      return 'date';
    } else if (type.value === 'http://www.w3.org/ns/ui#BooleanField') {
      return 'checkbox';
    } else {
      return null;
    }
  }

  @action
  clearSuccess() {
    this.success = null;
  }
}
