import SemanticModel, {
  solid,
  string,
  integer,
  boolean,
  uri,
  hasMany,
} from 'ember-solid/models/semantic-model';

@solid({
  defaultStorageLocation: '/private/tests/my-forms.ttl', // default location in solid pod
  private: true, // is this private info for the user?
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Field',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class FormField extends SemanticModel {
  @uri()
  binding;

  @string({ predicate: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#widget'})
  widget;

  @string()
  label;

  @integer()
  order;

  @boolean()
  required;

  @hasMany({
    model: 'form-option',
    predicate: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#option',
    inverse: false,
    inverseProperty: 'field',
  })
  options;
}
