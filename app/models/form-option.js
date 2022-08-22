import SemanticModel, {
  solid,
  string,
  belongsTo,
  uri,
} from 'ember-solid/models/semantic-model';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true, // is this private info for the user?
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Option',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class FormOption extends SemanticModel {
  @uri()
  value;

  @string()
  label;

  @belongsTo({
    model: 'form-field',
    predicate: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#option',
    inverse: true,
    inverseProperty: 'option',
  })
  field;
}
