import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class IndexRoute extends Route {
  @service solidAuth;

  async model() {
    await this.solidAuth.ensureLogin();
  }
}
