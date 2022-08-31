import SemanticModel, {
  solid,
  string,
  uri,
  integer,
  belongsTo,
  boolean,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';
import { tracked } from '@glimmer/tracking';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://www.w3.org/ns/ui#SingleLineTextField',
  ns: 'http://www.w3.org/ns/ui#', // define a namespace for properties.
})
export default class UiFormField extends SemanticModel {
  @uri({ predicate: 'http://www.w3.org/ns/ui#property' })
  binding = namedNode('');

  @string()
  label;

  @integer({ predicate: 'http://www.w3.org/ns/ui#sequence' })
  order;

  @belongsTo({
    model: 'ui-form-choice',
    predicate: 'http://www.w3.org/ns/ui#from',
    inverse: false,
  })
  choice;

  @boolean()
  required;

  @boolean()
  multiple;

  // Extra helper properties used in template and/or for compatibility with other vocabularies.
  isSelect = false;
  canHavePlaceholder = false;
  widget = 'string';
  @tracked options = [];
  canHaveChoiceBinding = true;
}
