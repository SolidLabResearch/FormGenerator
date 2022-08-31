import SemanticModel, {
  integer,
  solid,
  string,
  uri,
  hasMany,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/ns/shacl#PropertyShape',
  ns: 'http://www.w3.org/ns/shacl#', // define a namespace for properties.
})
export default class ShaclFormField extends SemanticModel {
  @uri({ predicate: 'http://www.w3.org/ns/shacl#path' })
  binding = namedNode('');

  @string({ predicate: 'http://www.w3.org/ns/shacl#name' })
  label;

  @integer()
  order;

  @integer()
  minCount;

  @integer()
  maxCount;

  @uri()
  datatype;
  @uri()
  nodeKind;

  @hasMany({
    model: 'shacl-form-option',
    predicate: 'http://www.w3.org/ns/shacl#in',
    rdfList: true,
    noBlankNodes: true,
  })
  options;

  // Extra helper properties used in template and/or for compatibility with other vocabularies.
  isSelect = false;
  canHavePlaceholder = false;
  widget = 'string';
}
