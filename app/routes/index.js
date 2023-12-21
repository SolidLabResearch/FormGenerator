import Route from '@ember/routing/route';
import { v4 as uuid } from 'uuid';
import { tracked } from '@glimmer/tracking';
import { n3reasoner } from 'eyereasoner';
import { QueryEngine } from '@comunica/query-sparql';
import { fetch } from '@smessie/solid-client-authn-browser';
import { findStorageRoot } from 'solid-storage-root';
import { service } from '@ember/service';

export default class IndexRoute extends Route {
  queryParams = {
    form: {
      refreshModel: true,
    },
  };

  @service solidAuth;

  @tracked loadedFormUri;

  @tracked vocabulary = 'http://www.w3.org/ns/shacl#';

  engine = new QueryEngine();

  originalFields = [];
  originalPolicies = [];
  originalFormTargetClass = '';
  @tracked fields = [];
  @tracked policies = [];
  @tracked formTargetClass;
  @tracked formTargetClassError = '';

  newForm = true;

  @tracked success = null;
  @tracked error = null;
  @tracked info = null;

  async model({ form }) {
    if (form) {
      const loadedForm = this.loadForm(form);
      if (loadedForm) {
        this.loadedFormUri = form;
      }
    } else {
      this.newForm = true;
      if (this.solidAuth.loggedIn) {
        const storageRoot = await findStorageRoot(
          this.solidAuth.loggedIn,
          fetch,
        );
        this.loadedFormUri = `${storageRoot}private/tests/forms/${uuid()}.n3#${uuid()}`;
      } else {
        this.info =
          'Log in to use a random location in your Solid pod or manually provide a form URI to get started.';
      }
    }
    return this;
  }

  async loadForm(formUri) {
    this.clearForm();

    if (!formUri) {
      this.newForm = true;
      return false;
    }
    await this.loadPolicies(formUri);

    if (await this.loadSolidUiForm(formUri)) {
      this.vocabulary = 'http://www.w3.org/ns/ui#';
    } else if (await this.loadShaclForm(formUri)) {
      this.vocabulary = 'http://www.w3.org/ns/shacl#';
    } else if (await this.loadRdfFormForm(formUri)) {
      this.vocabulary = 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
    } else {
      this.newForm = true;
      return false;
    }
    this.newForm = false;
    this.originalFields = JSON.parse(JSON.stringify(this.fields));
    this.originalPolicies = JSON.parse(JSON.stringify(this.policies));
    this.originalFormTargetClass = this.formTargetClass;
    console.log('Form loaded: ', this.fields);
    return true;
  }

  async loadPolicies(formUri) {
    // Get resource content.
    const response = await fetch(formUri, {
      method: 'GET',
    });
    if (!response.ok) {
      this.error = 'Could not load form.';
      return;
    }
    const content = await response.text();

    // Get policies from footprint tasks.
    const options = { outputType: 'string' };
    const reasonerResult = await n3reasoner(
      `<${formUri}> <http://example.org/event> <http://example.org/Submit> .`,
      content,
      options,
    );

    // Parse policies.
    const queryPolicy = `
      PREFIX ex: <http://example.org/>
      PREFIX pol: <https://www.example.org/ns/policy#>
      PREFIX fno: <https://w3id.org/function/ontology#>

      SELECT ?executionTarget ?method ?url ?contentType WHERE {
        ?id pol:policy ?policy .
        ?policy a fno:Execution .
        ?policy fno:executes ?executionTarget .
        ?policy ex:url ?url .
        OPTIONAL { ?policy ex:method ?method } .
        OPTIONAL { ?policy ex:contentType ?contentType } .
      }
      `;
    const bindings = await (
      await this.engine.queryBindings(queryPolicy, {
        sources: [
          {
            type: 'stringSource',
            value: reasonerResult,
            mediaType: 'text/n3',
            baseIRI: formUri.split('#')[0],
          },
        ],
      })
    ).toArray();

    this.policies = bindings.map((row) => {
      return {
        uuid: uuid(),
        executionTarget: row.get('executionTarget').value,
        url: row.get('url').value,
        method: row.get('method')?.value,
        contentType: row.get('contentType')?.value,
      };
    });
  }

  clearForm() {
    this.fields = [];
    this.policies = [];
    this.originalFields = [];
    this.originalPolicies = [];
    this.formTargetClass = '';
    this.originalFormTargetClass = '';
    this.formTargetClassError = '';
    this.success = null;
    this.error = null;
  }

  async removeN3RulesFromResource() {
    const response = await fetch(
      new URL(this.loadedFormUri /*, await this.solidAuth.podBase*/).href,
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      return { rules: [], prefixes: [] };
    }

    // Get content-type.
    const contentType = response.headers.get('content-type');

    // Get content.
    let text = await response.text();

    // Match prefixes.
    const prefixRegex = /(@prefix|PREFIX)\s+[^:]*:\s*<[^>]*>\s*\.?\n/g;
    const prefixes = text.match(prefixRegex);

    // Match N3 rules.
    const rulesRegex =
      /\{[^{}]*}\s*(=>|[^\s{}:]*:implies|<http:\/\/www.w3.org\/2000\/10\/swap\/log#implies>)\s*{[^{}]*}\s*\./g;
    const rules = text.match(rulesRegex);

    // Remove N3 rules.
    rules?.forEach((match) => {
      text = text.replace(match, '');
    });

    // Save resource without N3 rules.
    await fetch(this.loadedFormUri, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: text,
    });

    return { rules: rules || [], prefixes: prefixes || [] };
  }

  async addN3RulesToResource(matches) {
    const { rules, prefixes } = matches;

    if (!rules) {
      // No rules to add.
      return true;
    }

    const response = await fetch(this.loadedFormUri, {
      method: 'GET',
    });

    if (!response.ok) {
      return false;
    }

    // Get content.
    let text = await response.text();

    // Match prefixes.
    const prefixRegex = /(@prefix|PREFIX)\s+[^:]*:\s*<[^>]*>\s*\.?\n/g;
    const matchedPrefixes = text.match(prefixRegex);

    // Add prefixes in front if not already present.
    prefixes?.forEach((prefix) => {
      if (!matchedPrefixes?.includes(prefix)) {
        text = prefix + '\n' + text;
      }
    });

    // Add N3 rules.
    rules?.forEach((match) => {
      text += match + '\n';
    });

    // Save resource with N3 rules.
    const response2 = await fetch(this.loadedFormUri, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/n3',
      },
      body: text,
    });

    return response2.ok;
  }

  async loadSolidUiForm(uri) {
    const query = `
      PREFIX ui: <http://www.w3.org/ns/ui#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      SELECT ?targetClass ?type ?field ?property ?label ?from ?required ?multiple ?sequence ?listSubject
      WHERE {
        <${uri}> a ui:Form;
                 ui:parts ?list ;
                 ui:property ?targetClass .
        ?list rdf:rest*/rdf:first ?field .
        ?listSubject rdf:first ?field .
        ?field a ?type;
               ui:property ?property.
        OPTIONAL { ?field ui:label ?label. }
        OPTIONAL { ?field ui:from ?from. }
        OPTIONAL { ?field ui:required ?required. }
        OPTIONAL { ?field ui:multiple ?multiple. }
        OPTIONAL { ?field ui:sequence ?sequence. }
      }
    `;

    const bindings = await (
      await this.engine.queryBindings(query, { sources: [uri], fetch })
    ).toArray();

    if (!bindings.length) {
      return false;
    }

    let formTargetClass;
    const fields = bindings.map((row) => {
      formTargetClass = row.get('targetClass').value;
      return {
        uuid: uuid(),
        uri: row.get('field').value,
        type: row.get('type').value,
        widget: this.solidUiTypeToWidget(row.get('type').value),
        property: row.get('property').value,
        label: row.get('label')?.value,
        choice: row.get('from')?.value,
        required: row.get('required')?.value === 'true',
        multiple: row.get('multiple')?.value === 'true',
        order: parseInt(row.get('sequence')?.value),
        listSubject: row.get('listSubject').value,
        canHavePlaceholder: false,
        canHaveChoiceBinding: true,
      };
    });

    // Sort fields by order
    fields.sort((a, b) => a.order - b.order);

    // Add options to Choice fields
    for (const field of fields) {
      if (field.type === 'http://www.w3.org/ns/ui#Choice') {
        field.options = [];
        field.isSelect = true;
        const query = `
          PREFIX ui: <http://www.w3.org/ns/ui#>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          SELECT ?value ?label WHERE {
            ?value a <${field.choice}> .
            OPTIONAL { ?value skos:prefLabel ?label . }
          }
          `;

        const bindings = await (
          await this.engine.queryBindings(query, { sources: [uri], fetch })
        ).toArray();

        field.options = bindings.map((row) => {
          return {
            uuid: uuid(),
            property: row.get('value').value,
            label: row.get('label')?.value,
          };
        });
      }
    }

    this.formTargetClass = formTargetClass;
    this.fields = fields;

    return true;
  }

  async loadShaclForm(uri) {
    const query = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>

    SELECT ?targetClass ?type ?field ?nodeKind ?property ?label ?order ?minCount ?maxCount ?in
    WHERE {
      <${uri}> a sh:NodeShape;
               sh:targetClass ?targetClass ;
               sh:property ?field .
      ?field a sh:PropertyShape .
      OPTIONAL { ?field sh:datatype ?type . }
      OPTIONAL { ?field sh:nodeKind ?nodeKind . }
      OPTIONAL { ?field sh:path ?property . }
      OPTIONAL { ?field sh:name ?label . }
      OPTIONAL { ?field sh:order ?order . }
      OPTIONAL { ?field sh:minCount ?minCount . }
      OPTIONAL { ?field sh:maxCount ?maxCount . }
      OPTIONAL { ?field sh:in ?in . }
    }`;

    const bindings = await (
      await this.engine.queryBindings(query, { sources: [uri], fetch })
    ).toArray();

    console.log('bindings', bindings);

    if (!bindings.length) {
      return false;
    }

    let formTargetClass;
    const fields = bindings.map((row) => {
      formTargetClass = row.get('targetClass').value;
      return {
        uuid: uuid(),
        uri: row.get('field').value,
        type: row.get('type')?.value,
        widget: this.shaclTypeToWidget(
          row.get('type')?.value || row.get('nodeKind')?.value,
        ),
        nodeKind: row.get('nodeKind')?.value,
        property: row.get('property')?.value,
        label: row.get('label')?.value,
        order: parseInt(row.get('order')?.value),
        minCount: parseInt(row.get('minCount')?.value),
        maxCount: parseInt(row.get('maxCount')?.value),
        in: row.get('in')?.value,
        canHavePlaceholder: false,
        canHaveChoiceBinding: false,
      };
    });

    // Sort fields by order
    fields.sort((a, b) => a.order - b.order);

    // Add options to Choice fields (in case of sh:in)
    for (const field of fields) {
      if (field.in) {
        field.options = [];
        field.isSelect = true;
        const query = `
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          PREFIX owl: <http://www.w3.org/2002/07/owl#>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

          SELECT ?option ?label ?listSubject
          WHERE {
            <${field.in}> rdf:rest*/rdf:first ?option .
            ?listSubject rdf:first ?option .
            ?option a owl:Class .
            OPTIONAL { ?option rdfs:label ?label . }
          }`;

        const bindings = await (
          await this.engine.queryBindings(query, { sources: [uri], fetch })
        ).toArray();

        field.options = bindings.map((row) => {
          return {
            uuid: uuid(),
            property: row.get('option').value,
            label: row.get('label')?.value,
            listSubject: row.get('listSubject').value,
          };
        });
      }
    }

    this.formTargetClass = formTargetClass;
    this.fields = fields;

    return true;
  }

  async loadRdfFormForm(uri) {
    const query = `
    PREFIX form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?targetClass ?field ?type ?property ?label ?order ?required ?multiple ?placeholder
    WHERE {
      <${uri}> a form:Form;
               form:binding ?targetClass .
      ?field a form:Field;
             form:widget ?type .
      OPTIONAL { ?field form:binding ?property. }
      OPTIONAL { ?field form:label ?label. }
      OPTIONAL { ?field form:order ?order. }
      OPTIONAL { ?field form:required ?required. }
      OPTIONAL { ?field form:multiple ?multiple. }
      OPTIONAL { ?field form:placeholder ?placeholder. }
    }`;

    const bindings = await (
      await this.engine.queryBindings(query, { sources: [uri], fetch })
    ).toArray();

    if (!bindings.length) {
      return false;
    }

    let formTargetClass;
    const fields = bindings.map((row) => {
      formTargetClass = row.get('targetClass').value;
      return {
        uuid: uuid(),
        uri: row.get('field').value,
        type: row.get('type').value,
        widget: row.get('type').value,
        property: row.get('property')?.value,
        label: row.get('label')?.value,
        order: parseInt(row.get('order')?.value),
        required: row.get('required')?.value === 'true',
        multiple: row.get('multiple')?.value === 'true',
        placeholder: row.get('placeholder')?.value,
        canHavePlaceholder:
          row.get('type').value === 'string' ||
          row.get('type').value === 'textarea',
        canHaveChoiceBinding: false,
      };
    });

    // Sort fields by order
    fields.sort((a, b) => a.order - b.order);

    // Add options to Choice fields (in case of type = "dropdown")
    for (const field of fields) {
      if (field.type === 'dropdown') {
        field.options = [];
        field.isSelect = true;
        const query = `
          PREFIX form: <http://rdf.danielbeeke.nl/form/form-dev.ttl#>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

          SELECT ?value ?label ?option ?options ?listSubject
          WHERE {
            <${field.uri}> form:option ?options .
            ?options rdf:rest*/rdf:first ?option .
            ?listSubject rdf:first ?option .
            OPTIONAL { ?option form:value ?value . }
            OPTIONAL { ?option form:label ?label . }
          }
          `;

        const bindings = await (
          await this.engine.queryBindings(query, { sources: [uri], fetch })
        ).toArray();

        field.options = bindings.map((row) => {
          return {
            uuid: uuid(),
            property: row.get('value')?.value,
            label: row.get('label')?.value,
            uri: row.get('option').value,
            listSubject: row.get('listSubject').value,
          };
        });
      }
    }

    this.formTargetClass = formTargetClass;
    this.fields = fields;

    return true;
  }

  solidUiTypeToWidget(type) {
    switch (type) {
      case 'http://www.w3.org/ns/ui#SingleLineTextField':
        return 'string';
      case 'http://www.w3.org/ns/ui#MultiLineTextField':
        return 'textarea';
      case 'http://www.w3.org/ns/ui#Choice':
        return 'dropdown';
      case 'http://www.w3.org/ns/ui#BooleanField':
        return 'checkbox';
      case 'http://www.w3.org/ns/ui#DateField':
        return 'date';
    }
  }

  shaclTypeToWidget(type) {
    switch (type) {
      case 'http://www.w3.org/2001/XMLSchema#string':
        return 'string';
      case 'http://www.w3.org/ns/shacl#IRI':
        return 'dropdown';
      case 'http://www.w3.org/2001/XMLSchema#boolean':
        return 'checkbox';
      case 'http://www.w3.org/2001/XMLSchema#date':
        return 'date';
    }
  }

  async updateFields() {
    const fields = this.fields;
    this.fields = [];
    return new Promise((resolve) =>
      setTimeout(() => {
        this.fields = fields;
        resolve();
      }, 0),
    );
  }

  async updatePolicies() {
    const policies = this.policies;
    this.policies = [];
    return new Promise((resolve) =>
      setTimeout(() => {
        this.policies = policies;
        resolve();
      }, 0),
    );
  }

  addIfNotIncluded(prefixes, prefix, url) {
    let alreadyIncluded = false;
    prefixes.forEach((p) => {
      if (p.includes(prefix) && p.includes(url)) {
        alreadyIncluded = true;
      }
    });
    if (!alreadyIncluded) {
      prefixes.push(`@prefix ${prefix}: <${url}>.`);
    }
    return prefixes;
  }
}
