import SemanticModel, {
  solid,
  string,
} from 'ember-solid/models/semantic-model';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/2004/02/skos/core#Class', // Placeholder. Should be set by the end-user.
  ns: 'http://www.w3.org/2004/02/skos/core#', // define a namespace for properties.
})
export default class UiFormOption extends SemanticModel {
  @string({ predicate: 'http://www.w3.org/2004/02/skos/core#prefLabel' })
  label;

  // Extra helper properties used in template and/or for compatibility with other vocabularies.
  binding; // Empty NamedNode.
  isUiFormOption = true;
}
