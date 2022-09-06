import SemanticModel, {
  solid,
  string,
} from 'ember-solid/models/semantic-model';
import { tracked } from '@glimmer/tracking';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/2002/07/owl#Class',
  ns: 'http://www.w3.org/ns/shacl#', // define a namespace for properties.
})
export default class ShaclFormOption extends SemanticModel {
  @string({ predicate: 'http://www.w3.org/2000/01/rdf-schema#label' })
  label;

  // Extra helper properties used in template and/or for compatibility with other vocabularies.
  @tracked binding; // Empty NamedNode.
  isShaclFormOption = true;
}
