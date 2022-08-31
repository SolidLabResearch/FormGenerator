import SemanticModel, {
  solid,
  uri,
  hasMany,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/ns/shacl#NodeShape',
  ns: 'http://www.w3.org/ns/shacl#', // define a namespace for properties.
})
export default class ShaclForm extends SemanticModel {
  @hasMany({
    model: 'shacl-form-field',
    predicate: 'http://www.w3.org/ns/shacl#property',
    inverse: false,
  })
  fields;

  @uri({ predicate: 'http://www.w3.org/ns/shacl#targetClass' })
  binding = namedNode('');
}
