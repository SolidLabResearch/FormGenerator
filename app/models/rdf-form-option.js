import SemanticModel, {
  solid,
  string,
  uri,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';
import { tracked } from '@glimmer/tracking';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true, // is this private info for the user?
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Option',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class RdfFormOption extends SemanticModel {
  @uri({ predicate: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#value' })
  binding = namedNode('');

  @string()
  label;

  // Extra helper properties used in template.
  @tracked error = '';
}
