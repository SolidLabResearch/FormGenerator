import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { v4 as uuid } from 'uuid';
import { namedNode } from 'rdflib';
import { tracked } from '@glimmer/tracking';
import { n3reasoner } from 'eyereasoner';
import { QueryEngine } from '@comunica/query-sparql';

export default class IndexRoute extends Route {
  queryParams = {
    form: {
      refreshModel: true,
    },
  };

  @service solidAuth;
  @service store;

  supportedClass;
  @tracked form;

  @tracked loadedFormUri;

  @tracked vocabulary = 'http://www.w3.org/ns/shacl#';

  engine = new QueryEngine();

  @tracked policyType = 'HTTP';
  @tracked policyURL = '';
  @tracked policyMethod = 'POST';
  @tracked policyContentType = '';
  @tracked policyRedirectUrl = '';

  async model({ form }) {
    await this.solidAuth.ensureLogin();

    console.log('editing form', form);
    this.configureStorageLocations(form);

    await this.fetchGraphs(form !== null);

    if (form) {
      const loadedForm = this.loadForm();
      if (!loadedForm) {
        this.initiateNewShaclForm();
      }
    } else {
      this.initiateNewShaclForm();
    }
    return this;
  }

  configureStorageLocations(form) {
    const storageLocation = form ? form : `private/tests/forms/${uuid()}.ttl`;
    this.loadedFormUri = storageLocation;
    this.store.classForModel('hydra-class').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('rdf-form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('rdf-form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('rdf-form-option').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form-option').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('ui-form-choice').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('shacl-form').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('shacl-form-field').solid.defaultStorageLocation =
      storageLocation;
    this.store.classForModel('shacl-form-option').solid.defaultStorageLocation =
      storageLocation;
  }

  async fetchGraphs(removeN3Rules = false) {
    // Remove all N3 rules from the resource.
    let matches;
    if (removeN3Rules) {
      matches = await this.removeN3RulesFromResource();
    }

    await this.store.fetchGraphForType('hydra-class', true);
    await this.store.fetchGraphForType('rdf-form', true);
    await this.store.fetchGraphForType('rdf-form-field', true);
    await this.store.fetchGraphForType('rdf-form-option', true);
    await this.store.fetchGraphForType('ui-form', true);
    await this.store.fetchGraphForType('ui-form-field', true);
    await this.store.fetchGraphForType('ui-form-option', true);
    await this.store.fetchGraphForType('ui-form-choice', true);
    await this.store.fetchGraphForType('shacl-form', true);
    await this.store.fetchGraphForType('shacl-form-field', true);
    await this.store.fetchGraphForType('shacl-form-option', true);

    // Add N3 rules back to the resource.
    if (removeN3Rules) {
      await this.addN3RulesToResource(matches);
    }

    // Fill in the form with submit event policy values.
    await this.fillInFormWithSubmitEventPolicy(matches);
  }

  initiateNewRdfForm() {
    this.supportedClass = this.store.create('hydra-class', {
      method: 'POST',
    });
    this.form = this.store.create('rdf-form', {
      endpoint: namedNode('https://httpbin.org/post'),
      supportedClass: this.supportedClass,
    });
  }

  initiateNewSolidUiForm(fields) {
    this.form = this.store.create('ui-form', {
      fields: fields,
    });
  }

  initiateNewShaclForm() {
    this.form = this.store.create('shacl-form', {});
  }

  loadForm() {
    // Try rdf-form vocabulary first.
    this.supportedClass = this.store.all('hydra-class')[0];
    this.form = this.store.all('rdf-form')[0];
    this.vocabulary = 'http://rdf.danielbeeke.nl/form/form-dev.ttl#';
    if (this.form === undefined) {
      // Try solid-ui vocabulary.
      this.form = this.store.all('ui-form')[0];
      this.vocabulary = 'http://www.w3.org/ns/ui#';
    }
    if (this.form === undefined) {
      // Try shacl vocabulary.
      this.form = this.store.all('shacl-form')[0];
      this.vocabulary = 'http://www.w3.org/ns/shacl#';
    }
    console.log('loaded form', this.form);
    console.log('loaded supportedClass', this.supportedClass);
    return this.form !== undefined;
  }

  async removeN3RulesFromResource() {
    const fetch = this.solidAuth.session.fetch;

    const response = await fetch(
      new URL(this.loadedFormUri, await this.solidAuth.podBase).href,
      {
        method: 'GET',
      }
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
    await fetch(
      new URL(this.loadedFormUri, await this.solidAuth.podBase).href,
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: text,
      }
    );

    return { rules: rules || [], prefixes: prefixes || [] };
  }

  async addN3RulesToResource(matches) {
    const { rules, prefixes } = matches;
    const fetch = this.solidAuth.session.fetch;

    if (!rules) {
      // No rules to add.
      return;
    }

    const response = await fetch(
      new URL(this.loadedFormUri, await this.solidAuth.podBase).href,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      return;
    }

    // Get content-type.
    const contentType = response.headers.get('content-type');

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
    await fetch(
      new URL(this.loadedFormUri, await this.solidAuth.podBase).href,
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: text,
      }
    );
  }

  async fillInFormWithSubmitEventPolicy(matches) {
    for (const rule of matches?.rules || []) {
      const options = { blogic: false, outputType: 'string' };
      const query = `${
        matches.prefixes ? matches.prefixes.join('\n') : ''
      }\n${rule}`;
      const reasonerResult = await n3reasoner(
        '_:id <http://example.org/event> <http://example.org/Submit> .',
        query,
        options
      );

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
              baseIRI: new URL(this.loadedFormUri, await this.solidAuth.podBase)
                .href,
            },
          ],
        })
      ).toArray();

      const policies = bindings.map((row) => {
        return {
          executionTarget: row.get('executionTarget').value,
          url: row.get('url').value,
          method: row.get('method')?.value,
          contentType: row.get('contentType')?.value,
        };
      });

      for (const policy of policies) {
        if (policy.executionTarget === 'http://example.org/httpRequest') {
          this.policyType = 'HTTP';
          this.policyURL = policy.url;
          this.policyMethod = policy.method;
          this.policyContentType = policy.contentType;
        } else if (policy.executionTarget === 'http://example.org/redirect') {
          this.policyRedirectUrl = policy.url;
        }
      }
    }
  }
}
