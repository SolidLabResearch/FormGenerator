import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { namedNode } from 'rdflib';

export default class IndexController extends Controller {
  queryParams = ['form'];

  @tracked form = null;

  @service store;
  @service solidAuth;

  @tracked isRdfFormVocabulary =
    this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
  @tracked isSolidUiVocabulary =
    this.model.vocabulary === 'http://www.w3.org/ns/ui#';
  @tracked isShaclVocabulary =
    this.model.vocabulary === 'http://www.w3.org/ns/shacl#';

  @tracked success = null;
  @tracked error = null;

  @tracked
  fields = this.loadFields();

  loadFields() {
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
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
      fields = A(this.store.all('shacl-form-field').sortBy('order'));
      fields.forEach((field) => {
        field.widget = this.getWidgetTypeFromShaclDatatypeOrNodeKind(
          field.datatype,
          field.nodeKind
        );
        field.isSelect =
          field.nodeKind?.value === 'http://www.w3.org/ns/shacl#IRI';
        field.options.forEach((option) => {
          option.binding = option.uri;
        });
      });
    }
    return fields;
  }

  /**
   * Used in the template.
   */
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
      } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
        let options = {};
        if (type === 'dropdown') {
          options = {
            nodeKind: namedNode('http://www.w3.org/ns/shacl#IRI'),
          };
        } else if (type === 'string') {
          options = {
            datatype: namedNode('http://www.w3.org/2001/XMLSchema#string'),
          };
        } else if (type === 'date') {
          options = {
            datatype: namedNode('http://www.w3.org/2001/XMLSchema#date'),
          };
        } else if (type === 'checkbox') {
          options = {
            datatype: namedNode('http://www.w3.org/2001/XMLSchema#boolean'),
          };
        }
        const field = this.store.create('shacl-form-field', options);
        field.widget = type;
        field.isSelect = type === 'dropdown';
        this.fields = [...this.fields, field];
      }
    }
  }

  @action
  async save(event) {
    event.preventDefault();

    event.target.disabled = true;
    event.target.innerText = 'Saving...';

    if (!this.validateInputs()) {
      event.target.disabled = false;
      event.target.innerText = 'Save';
      return;
    }

    // Remove all N3 rules from the resource.
    const matches = await this.model.removeN3RulesFromResource();

    this.fields.forEach((field, i) => {
      field.order = i;

      // Ugly reassignments to fix the bug where property was not written back as it was only assigned using binding.
      field.label = field.label.trim();
      field.required = !field.required;
      field.required = !field.required;
      field.multiple = !field.multiple;
      field.multiple = !field.multiple;
      if (field.isSelect) {
        field.options = [...field.options];
        field.options.forEach((option) => {
          option.label = option.label.trim();
        });
      }
      if (field.canHavePlaceholder && field.placeholder) {
        field.placeholder = field.placeholder?.trim();
      }
      if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
        field.minCount = field.minCount || 0;
        field.maxCount = field.maxCount || 1;
      }
    });
    this.model.form.fields = this.fields;

    await this.store.persist();

    // Re-add the N3 rules to the resource.
    await this.model.addN3RulesToResource(matches);

    this.success = 'Successfully saved the form definition!';
    event.target.disabled = false;
    event.target.innerText = 'Save';
  }

  validateInputs() {
    let valid = true;

    if (!this.model.form.binding?.value.trim()) {
      this.model.form.error = 'Please fill in a binding.';
    }
    valid &= !this.model.form.error;

    this.fields.forEach((field) => {
      if (!field.binding?.value.trim()) {
        field.error = 'Please fill in a binding.';
      }
      valid &= !field.error;

      if (field.isSelect) {
        field.options.forEach((option) => {
          if (!option.binding?.value.trim()) {
            option.error = 'Please fill in a binding.';
          }
          valid &= !option.error;
        });

        if (field.canHaveChoiceBinding) {
          valid &= !field.choice.error;
        }
      }
    });
    return valid;
  }

  @action
  async updateBinding(element, event) {
    this.error = null;
    element.error = '';

    let binding = event.target.value?.trim();

    if (!binding) {
      element.error = 'Please fill in a binding.';
      return;
    }

    if (binding.includes(':')) {
      if (!binding.includes('://')) {
        binding = await this.replacePrefixInBinding(binding);
        if (!binding) {
          element.error = 'Please fill in a valid binding.';
          return;
        }
      }
    } else {
      element.error = 'Please fill in a valid binding.';
      return;
    }
    if (element.isUiFormOption || element.isShaclFormOption) {
      element.setUri(namedNode(binding));
    }
    element.binding = namedNode(binding);
  }

  @action
  async updateChoiceBinding(element, event) {
    this.error = null;
    element.choice.error = '';

    let binding = event.target.value?.trim();

    if (!binding) {
      element.choice.error = 'Please fill in a binding.';
      return;
    }

    if (binding.includes(':')) {
      if (!binding.includes('://')) {
        binding = await this.replacePrefixInBinding(binding);
        if (!binding) {
          element.choice.error = 'Please fill in a valid binding.';
          return;
        }
      }
    } else {
      element.choice.error = 'Please fill in a valid binding.';
      return;
    }
    element.choice.setUri(namedNode(binding));
    element.options.forEach((option) => {
      option.setRdfType(element.choice.uri);
    });
  }

  async replacePrefixInBinding(binding) {
    // Do call to prefix.cc to get the full URI
    const [prefix, suffix] = binding.split(':');
    const response = await fetch(`https://prefix.cc/${prefix}.file.json`);
    const json = await response.json();
    const uri = json[prefix];
    if (uri) {
      binding = uri + suffix;
    } else {
      this.error = `Could not find a prefix for '${prefix}'!`;
      return undefined;
    }
    return binding;
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
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
      const option = this.store.create('shacl-form-option', {});
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
    this.clearForm();

    // Update the vocabulary.
    this.model.vocabulary = event.target.value;

    // Create new form.
    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      this.model.initiateNewRdfForm();
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
      this.model.initiateNewSolidUiForm(this.fields);
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
      this.model.initiateNewShaclForm();
    }

    this.isRdfFormVocabulary =
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
    this.isSolidUiVocabulary =
      this.model.vocabulary === 'http://www.w3.org/ns/ui#';
    this.isShaclVocabulary =
      this.model.vocabulary === 'http://www.w3.org/ns/shacl#';
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

  getWidgetTypeFromShaclDatatypeOrNodeKind(datatype, nodeKind) {
    if (datatype) {
      if (datatype.value === 'http://www.w3.org/2001/XMLSchema#string') {
        return 'string';
      } else if (datatype.value === 'http://www.w3.org/2001/XMLSchema#date') {
        return 'date';
      } else if (
        datatype.value === 'http://www.w3.org/2001/XMLSchema#boolean'
      ) {
        return 'checkbox';
      } else {
        return null;
      }
    } else if (nodeKind) {
      if (nodeKind.value === 'http://www.w3.org/ns/shacl#IRI') {
        return 'dropdown';
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  @action
  clearSuccess() {
    this.success = null;
  }

  @action
  clearError() {
    this.error = null;
  }

  clearForm() {
    this.fields?.forEach((field) => {
      this.removeField(field);
    });
    this.model.form?.destroy();
    this.model.supportedClass?.destroy();
  }

  @action
  async loadForm(event) {
    event.preventDefault();
    document.getElementById('load-btn').disabled = true;
    document.getElementById('load-btn').innerText = 'Loading...';

    this.clearForm();

    this.form = this.model.loadedFormUri;
    this.model.configureStorageLocations(this.form);
    await this.model.fetchGraphs(true);

    this.model.loadForm();

    this.isRdfFormVocabulary =
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
    this.isSolidUiVocabulary =
      this.model.vocabulary === 'http://www.w3.org/ns/ui#';
    this.isShaclVocabulary =
      this.model.vocabulary === 'http://www.w3.org/ns/shacl#';

    this.fields = this.loadFields();

    document.getElementById('load-btn').disabled = false;
    document.getElementById('load-btn').innerText = 'Load';
  }

  @action
  async logout() {
    await this.solidAuth.ensureLogout();
    this.model.refresh();
  }
}
