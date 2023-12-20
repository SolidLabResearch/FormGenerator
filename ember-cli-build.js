'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    'ember-bootstrap': {
      bootstrapVersion: 5,
      importBootstrapCSS: true,
    },
    autoImport: {
      webpack: {
        node: {
          global: true,
        },
        resolve: {
          fallback: {
            fs: false,
            crypto: false,
            path: false,
            buffer: require.resolve('buffer/'),
          },
        },
      },
    },
  });

  return app.toTree();
};
