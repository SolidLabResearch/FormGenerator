import SemanticModel, {
  solid,
  hasMany,
  uri,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';
import { tracked } from '@glimmer/tracking';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/ns/ui#Form',
  ns: 'http://www.w3.org/ns/ui#', // define a namespace for properties.
})
export default class UiForm extends SemanticModel {
  @hasMany({
    model: 'ui-form-field',
    predicate: 'http://www.w3.org/ns/ui#parts',
    rdfList: true,
    noBlankNodes: true,
  })
  fields;

  @uri({ predicate: 'http://www.w3.org/ns/ui#property' })
  binding = namedNode('');

  // Extra helper properties used in template.
  @tracked error = '';
}
