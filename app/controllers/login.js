import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import Controller from '@ember/controller';

export default class LoginController extends Controller {
  @service('solid-auth') auth;

  queryParams = ['from'];

  @tracked
  from = null;

  @action
  login(provider) {
    const options = {
      identityProvider: provider,
      clientName: 'Form Generator',
    };
    if (this.from) {
      options.redirectUrl = this.from;
    }
    this.auth.ensureLogin(options);
  }
}
