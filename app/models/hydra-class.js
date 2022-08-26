import SemanticModel, {
  solid,
  string,
} from 'ember-solid/models/semantic-model';

@solid({
  defaultStorageLocation: '/private/tests/my-forms.ttl', // default location in solid pod
  private: true, // is this private info for the user?
  type: 'http://www.w3.org/ns/hydra/core#Class',
  ns: 'http://www.w3.org/ns/hydra/core#', // define a namespace for properties.
})
export default class HydraClass extends SemanticModel {
  @string()
  method;
}
