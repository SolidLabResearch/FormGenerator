import { module, test } from 'qunit';
import { setupTest } from 'form-generator/tests/helpers';

module('Unit | Controller | index', function (hooks) {
  setupTest(hooks);

  // TODO: Replace this with your real tests.
  test('it exists', function (assert) {
    let controller = this.owner.lookup('controller:index');
    assert.ok(controller);
  });
});
