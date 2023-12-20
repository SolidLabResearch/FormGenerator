import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { v4 as uuid } from 'uuid';
import {
  fetch,
  getDefaultSession,
  handleIncomingRedirect,
  login,
  logout,
} from '@smessie/solid-client-authn-browser';
import { service } from '@ember/service';
import { n3reasoner } from 'eyereasoner';

export default class IndexController extends Controller {
  queryParams = ['form'];

  @tracked form = null;

  @service solidAuth;

  @tracked authError;
  @tracked oidcIssuer = '';

  /**
   * Used in the template.
   */
  isEqual = (a, b) => {
    return a === b;
  };

  @action
  addFormElement(type) {
    if (type && !type.startsWith('policy-')) {
      // Get base uri from form uri
      const baseUri = this.model.loadedFormUri.split('#')[0];
      let field = {
        uuid: uuid(),
        uri: `${baseUri}#${uuid()}`,
        widget: type,
        label: '',
        property: '',
        order: this.model.fields.length,
        isSelect: type === 'dropdown',
        options: [],
      };

      if (
        this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
      ) {
        field = {
          ...field,
          ...{
            type: type,
            required: false,
            multiple: false,
            canHavePlaceholder: type === 'string' || type === 'textarea',
            placeholder: '',
            canHaveChoiceBinding: false,
          },
        };
      } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
        field = {
          ...field,
          ...{
            type: this.getSolidUiRdfTypeFromWidgetType(type),
            required: false,
            multiple: false,
            listSubject: `${baseUri}#${uuid()}`,
            canHavePlaceholder: false,
            canHaveChoiceBinding: true,
          },
          ...(type === 'dropdown'
            ? {
                choice: `${baseUri}#${uuid()}`,
              }
            : {}),
        };
      } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
        field = {
          ...field,
          ...this.getShaclDatatypeOrNodeKindFromWidgetType(type),
          ...{
            minCount: 0,
            maxCount: 1,
            canHavePlaceholder: false,
            canHaveChoiceBinding: false,
          },
        };
      }

      this.model.fields = [...this.model.fields, field];
    }
  }

  @action
  async save(event) {
    event.preventDefault();

    event.target.disabled = true;
    event.target.innerText = 'Saving...';

    if (!(await this.validateInputs())) {
      event.target.disabled = false;
      event.target.innerText = 'Save';
      return;
    }

    // Update order of fields.
    this.model.fields.forEach((field, index) => {
      field.order = index;
    });

    // Calculate differences between the original form and the current form and save those using N3 Patch.
    const fieldsToInsert = [];
    const fieldsToDelete = [];

    // Find all new fields.
    this.model.fields.forEach((field) => {
      // Check if it is not already in the original form by checking the uuid.
      if (!this.model.originalFields.find((f) => f.uuid === field.uuid)) {
        fieldsToInsert.push(field);
      }
    });

    // Find all deleted fields.
    this.model.originalFields.forEach((field) => {
      // Check if it is not already in the current form by checking the uuid.
      if (!this.model.fields.find((f) => f.uuid === field.uuid)) {
        fieldsToDelete.push(field);
      }
    });

    // Find all the updated fields.
    this.model.fields.forEach((field) => {
      // Find the original field.
      const originalField = this.model.originalFields.find(
        (f) => f.uuid === field.uuid
      );
      if (originalField) {
        // Check if the field has been updated.
        if (
          field.property !== originalField.property ||
          field.label !== originalField.label ||
          field.order !== originalField.order ||
          field.required !== originalField.required ||
          field.multiple !== originalField.multiple ||
          field.placeholder !== originalField.placeholder ||
          field.choice !== originalField.choice ||
          field.nodeKind !== originalField.nodeKind ||
          field.minCount !== originalField.minCount ||
          field.maxCount !== originalField.maxCount ||
          field.placeholder !== originalField.placeholder ||
          !this.optionsAreEqual(field.options, originalField.options)
        ) {
          fieldsToInsert.push(field);
          fieldsToDelete.push(originalField);
        }
      }
    });

    if (
      this.model.formTargetClass === this.model.originalFormTargetClass &&
      fieldsToInsert.length === 0 &&
      fieldsToDelete.length === 0 &&
      this.policiesAreEqual(this.model.policies, this.model.originalPolicies)
    ) {
      this.model.success = 'No changes detected. No need to save!';
      event.target.disabled = false;
      event.target.innerText = 'Save';
      return;
    }

    // Remove all N3 rules from the resource.
    let matches = await this.model.removeN3RulesFromResource();

    console.log('old fields', this.model.originalFields);
    console.log('new fields', this.model.fields);

    // Form the N3 Patch.
    let n3Patch = `
        @prefix solid: <http://www.w3.org/ns/solid/terms#>.
        @prefix ui: <http://www.w3.org/ns/ui#>.
        @prefix sh: <http://www.w3.org/ns/shacl#>.
        @prefix form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#>.
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
        @prefix skos: <http://www.w3.org/2004/02/skos/core#>.
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.

        _:test a solid:InsertDeletePatch;
          solid:inserts {
            ${this.stringifyFormSubject(
              this.model.loadedFormUri,
              this.model.formTargetClass,
              this.model.fields
            )}
            ${this.stringifyFields(
              this.model.loadedFormUri,
              this.model.formTargetClass,
              fieldsToInsert
            )}
          }`;
    if (this.model.newForm) {
      n3Patch += ` .`;
    } else {
      n3Patch += ` ;
          solid:deletes {
            ${this.stringifyFormSubject(
              this.model.loadedFormUri,
              this.model.originalFormTargetClass,
              this.model.originalFields
            )}
            ${this.stringifyFields(
              this.model.loadedFormUri,
              this.model.originalFormTargetClass,
              fieldsToDelete
            )}
          } .
        `;
    }

    // Apply the N3 Patch.
    const response = await fetch(this.model.loadedFormUri, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'text/n3',
      },
      body: n3Patch,
    });
    if (!response.ok) {
      this.model.error = `Could not save the form definition!`;

      // We still need to re-add the N3 rules to the resource.
      await this.model.addN3RulesToResource(matches);

      event.target.disabled = false;
      event.target.innerText = 'Save';
      return;
    }

    // Remove all N3 rules that are Submit event policies as we are regenerating them after this.
    const keepRules = await Promise.all(
      matches.rules.map(
        async (rule) => await this.isEventSubmitRule(rule, matches.prefixes)
      )
    );
    matches.rules = matches.rules.filter((rule, index) => !keepRules[index]);

    // Add the generated N3 rules to the matches list.
    for (const policy of this.stringifyPolicies(this.model.policies)) {
      matches.rules.push(policy);
    }

    // Make sure the used prefixes are still part of the resource.
    matches.prefixes = this.model.addIfNotIncluded(
      matches.prefixes,
      'ex',
      'http://example.org/'
    );
    matches.prefixes = this.model.addIfNotIncluded(
      matches.prefixes,
      'fno',
      'https://w3id.org/function/ontology#'
    );
    matches.prefixes = this.model.addIfNotIncluded(
      matches.prefixes,
      'pol',
      'https://www.example.org/ns/policy#'
    );

    // Re-add the N3 rules to the resource.
    if (await this.model.addN3RulesToResource(matches)) {
      this.model.success = 'Successfully saved the form definition!';

      // On successful save, update the original fields to the current fields.
      this.model.originalFields = JSON.parse(JSON.stringify(this.model.fields));
      this.model.originalPolicies = JSON.parse(
        JSON.stringify(this.model.policies)
      );
      this.model.originalFormTargetClass = this.model.formTargetClass;
    } else {
      this.model.error = `Could not save the policies as part of the form definition!`;
    }
    this.model.newForm = false;
    event.target.disabled = false;
    event.target.innerText = 'Save';
  }

  async validateInputs() {
    let valid = true;

    if (!this.model.formTargetClass.trim()) {
      this.model.formTargetClassError = 'Please fill in a binding.';
    }
    valid &= !this.model.formTargetClassError;

    this.model.fields.forEach((field) => {
      if (!field.property?.trim()) {
        field.error = 'Please fill in a binding.';
      }
      valid &= !field.error;

      if (field.isSelect) {
        field.options.forEach((option) => {
          if (!option.property?.trim()) {
            option.error = 'Please fill in a binding.';
          }
          valid &= !option.error;
        });

        if (field.canHaveChoiceBinding) {
          valid &= !field.choiceError;
        }
      }
    });

    this.model.policies.forEach((policy) => {
      policy.urlError = '';
      policy.contentTypeError = '';

      if (!policy.url.trim()) {
        policy.urlError = 'Please fill in a URL.';
      }
      valid &= !policy.urlError;

      if (policy.executionTarget === 'http://example.org/httpRequest') {
        if (
          !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(policy.method)
        ) {
          policy.methodError = 'Please choose a valid HTTP method.';
        }
        valid &= !policy.methodError;

        if (!policy.contentType.trim()) {
          policy.contentTypeError = 'Please fill in a Content-Type.';
        }
        valid &= !policy.contentTypeError;
      }
    });

    // Update the fields and policies to trigger a re-render.
    await this.model.updateFields();
    await this.model.updatePolicies();

    return valid;
  }

  @action
  async updateBinding(element, event) {
    this.model.error = null;
    element.error = '';

    const result = await this.expandBinding(event.target.value);

    if (result.error) {
      element.error = result.error;
    } else {
      element.property = result.binding;
    }

    // Update the fields to trigger a re-render.
    await this.model.updateFields();
  }

  @action
  async updateFormBinding() {
    this.model.error = null;
    this.model.formTargetClassError = '';

    const result = await this.expandBinding(this.model.formTargetClass);
    if (result.error) {
      this.model.formTargetClassError = result.error;
    } else {
      this.model.formTargetClass = result.binding;
    }
  }

  @action
  async updateChoiceBinding(element, event) {
    this.model.error = null;
    element.choiceError = '';

    const result = await this.expandBinding(event.target.value);

    if (result.error) {
      element.choiceError = result.error;
    } else {
      element.choice = result.binding;
    }

    // Update the fields to trigger a re-render.
    await this.model.updateFields();
  }

  async expandBinding(binding_) {
    let binding = binding_?.trim();

    if (!binding) {
      return { error: 'Please fill in a binding.' };
    }

    if (binding.includes(':')) {
      if (!binding.includes('://')) {
        binding = await this.replacePrefixInBinding(binding);
        if (!binding) {
          return { error: 'Please fill in a valid binding.' };
        }
      }
    } else {
      return { error: 'Please fill in a valid binding.' };
    }
    return { binding };
  }

  async replacePrefixInBinding(binding) {
    // Do call to prefix.cc to get the full URI
    const [prefix, suffix] = binding.split(':');
    const response = await fetch(
      `https://prefixcc-proxy.smessie.com/${prefix}.file.json`
    );
    const json = await response.json();
    const uri = json[prefix];
    if (uri) {
      binding = uri + suffix;
    } else {
      this.model.error = `Could not find a prefix for '${prefix}'!`;
      return undefined;
    }
    return binding;
  }

  @action
  async addOption(field, event) {
    event.preventDefault();
    event.target.closest('.btn').disabled = true;

    const baseUri = this.model.loadedFormUri.split('#')[0];
    let option = { uuid: uuid(), label: '', property: '' };
    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      option = {
        ...option,
        uri: `${baseUri}#${uuid()}`,
        listSubject: `${baseUri}#${uuid()}`,
      };
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
      option = {
        ...option,
        listSubject: `${baseUri}#${uuid()}`,
      };
    }
    field.options.push(option);

    // Update the fields to trigger a re-render.
    await this.model.updateFields();

    event.target.closest('.btn').disabled = false;
  }

  @action
  async removeOption(field, option, event) {
    event.preventDefault();
    field.options = field.options.filter((o) => o.uuid !== option.uuid);
    // Update the fields to trigger a re-render.
    await this.model.updateFields();
  }

  @action
  removeField(field, event) {
    event?.preventDefault();
    this.model.fields = this.model.fields.filter((f) => f.uuid !== field.uuid);
  }

  @action
  changeVocabulary(event) {
    // Clear any existing form.
    this.model.clearForm();

    // Update the vocabulary.
    this.model.vocabulary = event.target.value;
  }

  getSolidUiRdfTypeFromWidgetType(type) {
    if (type === 'string') {
      return 'http://www.w3.org/ns/ui#SingleLineTextField';
    } else if (type === 'textarea') {
      return 'http://www.w3.org/ns/ui#MultiLineTextField';
    } else if (type === 'dropdown') {
      return 'http://www.w3.org/ns/ui#Choice';
    } else if (type === 'date') {
      return 'http://www.w3.org/ns/ui#DateField';
    } else if (type === 'checkbox') {
      return 'http://www.w3.org/ns/ui#BooleanField';
    } else {
      return null;
    }
  }

  getShaclDatatypeOrNodeKindFromWidgetType(type) {
    if (type === 'string') {
      return { type: 'http://www.w3.org/2001/XMLSchema#string' };
    } else if (type === 'textarea') {
      return { type: 'http://www.w3.org/2001/XMLSchema#string' };
    } else if (type === 'dropdown') {
      return { nodeKind: 'http://www.w3.org/ns/shacl#IRI' };
    } else if (type === 'date') {
      return { type: 'http://www.w3.org/2001/XMLSchema#date' };
    } else if (type === 'checkbox') {
      return { type: 'http://www.w3.org/2001/XMLSchema#boolean' };
    } else {
      return null;
    }
  }

  @action
  clearSuccess() {
    this.model.success = null;
  }

  @action
  clearError() {
    this.model.error = null;
  }

  @action
  clearInfo() {
    this.model.info = null;
  }

  @action
  async loadForm(event) {
    event.preventDefault();
    document.getElementById('load-btn').disabled = true;
    document.getElementById('load-btn').innerText = 'Loading...';

    this.form = this.model.loadedFormUri;

    await this.model.loadForm(this.form);

    document.getElementById('load-btn').disabled = false;
    document.getElementById('load-btn').innerText = 'Load';
  }

  async isEventSubmitRule(rule, prefixes) {
    const options = { outputType: 'string' };
    const query = `${prefixes ? prefixes.join('\n') : ''}\n${rule}`;
    // TODO: We should replace ?id with the actual form URI.
    const reasonerResult = await n3reasoner(
      '?id <http://example.org/event> <http://example.org/Submit> .',
      query,
      options
    );
    return reasonerResult.length > 0;
  }

  @action
  updatePolicyMethod(policy, event) {
    policy.method = event.target.value?.trim();
  }

  @action
  addPolicy(type) {
    if (type && type.startsWith('policy-')) {
      let policy = { uuid: uuid(), url: '' };
      if (type === 'policy-redirect') {
        policy.executionTarget = 'http://example.org/redirect';
      } else if (type === 'policy-n3-patch') {
        policy.executionTarget = 'http://example.org/n3Patch';
      } else if (type === 'policy-http-request') {
        policy = {
          ...policy,
          method: 'POST',
          contentType: '',
          executionTarget: 'http://example.org/httpRequest',
        };
      }
      this.model.policies = [...this.model.policies, policy];
    }
  }

  @action
  removePolicy(policy, event) {
    event?.preventDefault();
    this.model.policies = this.model.policies.filter(
      (p) => p.uuid !== policy.uuid
    );
  }

  @action
  async login() {
    await handleIncomingRedirect();

    // 2. Start the Login Process if not already logged in.
    if (!getDefaultSession().info.isLoggedIn) {
      await login({
        // Specify the URL of the user's Solid Identity Provider;
        // e.g., "https://login.inrupt.com".
        oidcIssuer: this.oidcIssuer,
        // Specify the URL the Solid Identity Provider should redirect the user once logged in,
        // e.g., the current page for a single-page app.
        redirectUrl: window.location.href,
        // Provide a name for the application when sending to the Solid Identity Provider
        clientName: 'FormGenerator',
      }).catch((e) => {
        this.authError = e.message;
      });
    }
  }

  @action
  async logout() {
    await logout();
    this.model.loggedIn = undefined;
  }

  /**
   * Stringifies the fields.
   * Requires the following prefixes to be defined:
   * @prefix ui: <http://www.w3.org/ns/ui#> .
   * @prefix form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#> .
   * @prefix sh: <http://www.w3.org/ns/shacl#> .
   * @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
   * @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
   * @prefix owl: <http://www.w3.org/2002/07/owl#> .
   * @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
   * @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
   */
  stringifyFields(formUri, targetClass, fields) {
    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      return this.stringifyRdfFormFields(formUri, targetClass, fields);
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
      return this.stringifySoldUiFields(formUri, targetClass, fields);
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
      return this.stringifyShaclFields(formUri, targetClass, fields);
    } else {
      console.error('Unknown vocabulary', this.model.vocabulary);
      return '';
    }
  }

  /**
   * Stringifies the fields in the Solid-UI vocabulary.
   * Requires the following prefixes to be defined:
   * @prefix ui: <http://www.w3.org/ns/ui#> .
   * @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
   * @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
   */
  stringifySoldUiFields(formUri, targetClass, fields) {
    let data = '';
    for (const field of fields) {
      data += `<${field.uri}> a <${field.type}> .\n`;
      data += `<${field.uri}> ui:property <${field.property}> .\n`;
      if (field.label) {
        data += `<${field.uri}> ui:label "${field.label}" .\n`;
      }
      if (field.required !== undefined) {
        data += `<${field.uri}> ui:required "${field.required}"^^xsd:boolean .\n`;
      }
      if (field.multiple !== undefined) {
        data += `<${field.uri}> ui:multiple "${field.multiple}"^^xsd:boolean .\n`;
      }
      if (field.order !== undefined) {
        data += `<${field.uri}> ui:sequence ${field.order} .\n`;
      }
      if (field.choice) {
        data += `<${field.uri}> ui:from <${field.choice}> .\n`;

        // Stringify the options.
        for (const option of field.options) {
          data += `<${option.property}> a <${field.choice}> .\n`;
          if (option.label) {
            data += `<${option.property}> skos:prefLabel "${option.label}" .\n`;
          }
        }
      }
    }
    return data;
  }

  /**
   * Stringifies the fields in the SHACL vocabulary.
   * Requires the following prefixes to be defined:
   * @prefix sh: <http://www.w3.org/ns/shacl#> .
   * @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
   * @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
   * @prefix owl: <http://www.w3.org/2002/07/owl#> .
   */
  stringifyShaclFields(formUri, targetClass, fields) {
    let data = '';
    for (const field of fields) {
      data += `<${field.uri}> a sh:PropertyShape .\n`;
      if (field.property) {
        data += `<${field.uri}> sh:path <${field.property}> .\n`;
      }
      if (field.type) {
        data += `<${field.uri}> sh:datatype <${field.type}> .\n`;
      }
      if (field.nodeKind) {
        data += `<${field.uri}> sh:nodeKind <${field.nodeKind}> .\n`;
      }
      if (field.minCount !== undefined) {
        data += `<${field.uri}> sh:minCount ${field.minCount} .\n`;
      }
      if (field.maxCount !== undefined) {
        data += `<${field.uri}> sh:maxCount ${field.maxCount} .\n`;
      }
      if (field.label) {
        data += `<${field.uri}> sh:name "${field.label}" .\n`;
      }
      if (field.order !== undefined) {
        data += `<${field.uri}> sh:order ${field.order} .\n`;
      }
      if (field.isSelect) {
        data += `<${field.uri}> sh:in ${
          field.options.length ? `<${field.options[0].listSubject}>` : 'rdf:nil'
        } .\n`;

        // Stringify the options.
        for (const option of field.options) {
          data += `<${option.property}> a owl:Class .\n`;
          if (option.label) {
            data += `<${option.property}> rdfs:label "${option.label}" .\n`;
          }
        }

        // Stringify RDF List.
        for (const [index, option] of field.options.entries()) {
          data += `<${option.listSubject}> rdf:first <${option.property}> .\n`;
          data += `<${option.listSubject}> rdf:rest ${
            index === field.options.length - 1
              ? 'rdf:nil'
              : `<${field.options[index + 1].listSubject}>`
          } .\n`;
        }
      }
    }
    return data;
  }

  /**
   * Stringifies the fields in the RDF Form vocabulary.
   * Requires the following prefixes to be defined:
   * @prefix form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#> .
   * @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
   * @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
   */
  stringifyRdfFormFields(formUri, targetClass, fields) {
    let data = '';
    for (const field of fields) {
      data += `<${field.uri}> a form:Field .\n`;
      data += `<${field.uri}> form:widget "${field.type}" .\n`;
      if (field.property) {
        data += `<${field.uri}> form:binding <${field.property}> .\n`;
      }
      if (field.label) {
        data += `<${field.uri}> form:label "${field.label}" .\n`;
      }
      if (field.order !== undefined) {
        data += `<${field.uri}> form:order ${field.order} .\n`;
      }
      if (field.required !== undefined) {
        data += `<${field.uri}> form:required "${field.required}"^^xsd:boolean .\n`;
      }
      if (field.multiple !== undefined) {
        data += `<${field.uri}> form:multiple "${field.multiple}"^^xsd:boolean .\n`;
      }
      if (field.placeholder) {
        data += `<${field.uri}> form:placeholder "${field.placeholder}" .\n`;
      }
      if (field.isSelect) {
        data += `<${field.uri}> form:option ${
          field.options.length ? `<${field.options[0].listSubject}>` : 'rdf:nil'
        } .\n`;

        // Stringify the options.
        for (const option of field.options) {
          if (option.property) {
            data += `<${option.uri}> form:value <${option.property}> .\n`;
          }
          if (option.label) {
            data += `<${option.uri}> form:label "${option.label}" .\n`;
          }
        }

        // Stringify RDF List.
        for (const [index, option] of field.options.entries()) {
          data += `<${option.listSubject}> rdf:first <${option.uri}> .\n`;
          data += `<${option.listSubject}> rdf:rest ${
            index === field.options.length - 1
              ? 'rdf:nil'
              : `<${field.options[index + 1].listSubject}>`
          } .\n`;
        }
      }
    }
    return data;
  }

  /**
   * Stringifies the form subject.
   * Requires the following prefixes to be defined:
   * @prefix ui: <http://www.w3.org/ns/ui#> .
   * @prefix form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#> .
   * @prefix sh: <http://www.w3.org/ns/shacl#> .
   * @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
   */
  stringifyFormSubject(formUri, targetClass, fields) {
    if (
      this.model.vocabulary === 'http://rdf.danielbeeke.nl/form/form-dev.ttl#'
    ) {
      return this.stringifyRdfFormSubject(formUri, targetClass);
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/ui#') {
      return this.stringifySolidUiFormSubject(formUri, targetClass, fields);
    } else if (this.model.vocabulary === 'http://www.w3.org/ns/shacl#') {
      return this.stringifyShaclFormSubject(formUri, targetClass, fields);
    } else {
      console.error('Unknown vocabulary', this.model.vocabulary);
      return '';
    }
  }

  /**
   * Stringifies the form subject in the Solid-UI vocabulary.
   * Requires the following prefixes to be defined:
   * @prefix ui: <http://www.w3.org/ns/ui#> .
   * @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
   */
  stringifySolidUiFormSubject(formUri, targetClass, fields) {
    let data = `<${formUri}> a ui:Form .\n`;
    if (targetClass) {
      data += `<${formUri}> ui:property <${targetClass}> .\n`;
    }
    data += `<${formUri}> ui:parts ${
      fields.length ? `<${fields[0].listSubject}>` : 'rdf:nil'
    } .\n`;
    for (const [index, field] of fields.entries()) {
      data += `<${field.listSubject}> rdf:first <${field.uri}> .\n`;
      data += `<${field.listSubject}> rdf:rest ${
        index === fields.length - 1
          ? 'rdf:nil'
          : `<${fields[index + 1].listSubject}>`
      } .\n`;
    }
    return data;
  }

  /**
   * Stringifies the form subject in the SHACL vocabulary.
   * Requires the following prefixes to be defined:
   * @prefix sh: <http://www.w3.org/ns/shacl#> .
   */
  stringifyShaclFormSubject(formUri, targetClass, fields) {
    let data = `<${formUri}> a sh:NodeShape .\n`;
    if (targetClass) {
      data += `<${formUri}> sh:targetClass <${targetClass}> .\n`;
    }
    for (const field of fields) {
      data += `<${formUri}> sh:property <${field.uri}> .\n`;
    }
    return data;
  }

  /**
   * Stringifies the form subject in the RDF Form vocabulary.
   * Requires the following prefixes to be defined:
   * @prefix form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#> .
   */
  stringifyRdfFormSubject(formUri, targetClass) {
    let data = `<${formUri}> a form:Form .\n`;
    if (targetClass) {
      data += `<${formUri}> form:binding <${targetClass}> .\n`;
    }
    return data;
  }

  stringifyPolicies(policies) {
    const list = [];
    for (const policy of policies) {
      // Add basic properties and N3 rule syntax equal for all policy types.
      let data = `
{
  <${this.model.loadedFormUri}> ex:event ex:Submit.
} => {
  ex:HttpPolicy pol:policy [
    a fno:Execution ;
    fno:executes <${policy.executionTarget}> ;
    ex:url <${policy.url}>`;

      // If the policy is a HTTP request, add the method and content type.
      if (policy.executionTarget === 'http://example.org/httpRequest') {
        data += ` ;
    ex:method "${policy.method}" ;
    ex:contentType "${policy.contentType}"`;
      }

      // Finish the policy syntax.
      data += `
  ] .
} .
    `;

      list.push(data);
    }
    return list;
  }

  optionsAreEqual(a, b) {
    if (!a) {
      return !b;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (const option of a) {
      const equivalentOption = b.find((o) => o.uuid === option.uuid);
      if (!equivalentOption) {
        return false;
      }
      if (
        option.property !== equivalentOption.property ||
        option.label !== equivalentOption.label ||
        option.uri !== equivalentOption.uri
      ) {
        return false;
      }
    }
    return true;
  }

  policiesAreEqual(a, b) {
    if (!a) {
      return !b;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (const policy of a) {
      const equivalentPolicy = b.find((p) => p.uuid === policy.uuid);
      if (!equivalentPolicy) {
        return false;
      }
      if (
        policy.url !== equivalentPolicy.url ||
        policy.executionTarget !== equivalentPolicy.executionTarget ||
        policy.method !== equivalentPolicy.method ||
        policy.contentType !== equivalentPolicy.contentType
      ) {
        return false;
      }
    }
    return true;
  }
}
