import SemanticModel, {
  solid,
  string,
  integer,
  boolean,
  uri,
  hasMany,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true, // is this private info for the user?
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Field',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class RdfFormField extends SemanticModel {
  @uri()
  binding = namedNode('');

  @string()
  widget;

  @string()
  label;

  @integer()
  order;

  @boolean()
  required;

  @hasMany({
    model: 'rdf-form-option',
    predicate: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#option',
    rdfList: true,
  })
  options;

  @string()
  placeholder;

  @boolean()
  multiple;

  // Extra helper properties used in template.
  isSelect = false;
  canHavePlaceholder = false;
}
