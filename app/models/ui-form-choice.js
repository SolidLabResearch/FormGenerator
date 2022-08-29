import SemanticModel, {
  solid,
  string,
} from 'ember-solid/models/semantic-model';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/2002/07/owl#Class',
  ns: 'http://www.w3.org/2002/07/owl#', // define a namespace for properties.
})
export default class UiFormChoice extends SemanticModel {
  @string({ predicate: 'http://www.w3.org/2000/01/rdf-schema#comment' })
  comment;
}
