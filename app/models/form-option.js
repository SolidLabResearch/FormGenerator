import SemanticModel, {
  solid,
  string,
  uri,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true, // is this private info for the user?
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Option',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class FormOption extends SemanticModel {
  @uri({ predicate: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#value' })
  binding = namedNode('');

  @string()
  label;
}
