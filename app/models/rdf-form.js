import SemanticModel, {
  solid,
  uri,
  belongsTo,
} from 'ember-solid/models/semantic-model';
import { namedNode } from 'rdflib';

@solid({
  defaultStorageLocation: 'private/tests/my-forms.ttl', // default location in solid pod
  private: true,
  type: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#Form',
  ns: 'http://rdf.danielbeeke.nl/form/form-dev.ttl#', // define a namespace for properties.
})
export default class RdfForm extends SemanticModel {
  @uri({ predicate: 'http://www.w3.org/ns/hydra/core#endpoint' })
  endpoint;

  @belongsTo({
    model: 'hydra-class',
    predicate: 'http://www.w3.org/ns/hydra/core#supportedClass',
    inverse: false,
  })
  supportedClass;

  @uri()
  binding = namedNode('');
}
