import SemanticModel, {
  solid,
  string,
  integer,
  hasMany,
  belongsTo,
} from 'ember-solid/models/semantic-model';

@solid({
  defaultStorageLocation: '/private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Form',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class Form extends SemanticModel {
  @string({ predicate: 'http://www.w3.org/ns/hydra/core#endpoint' })
  endpoint;
}
