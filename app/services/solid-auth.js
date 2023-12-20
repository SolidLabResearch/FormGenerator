import Service from '@ember/service';
import { handleIncomingRedirect } from '@smessie/solid-client-authn-browser';
import { tracked } from '@glimmer/tracking';

export default class SolidAuthService extends Service {
  @tracked loggedIn;

  async restoreSession() {
    // Restore solid session
    const info = await handleIncomingRedirect({
      url: window.location.href,
      restorePreviousSession: true,
    });
    this.loggedIn = info.webId;
    console.log('Logged in as ', info.webId, info);
  }
}
