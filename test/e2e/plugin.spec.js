'use strict';

const common = require('digs-common');
common.debug.enable('digs*');
const createServer = require('digs');
const Promise = common.Promise;
const getPort = require('get-port');
Promise.longStackTraces();

describe(`digs-serial plugin`, () => {
  let digs;
  let sandbox;
  let serverOpts;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('digs-serial plugin');
    serverOpts = {
      server: {
        app: {
          coap: {},
          debug: true
        }
      },
      connections: [],
      plugins: []

    };
  });

  afterEach(done => {
    sandbox.restore();
    if (digs) {
      digs.stop(done);
    } else {
      done();
    }
  });

  /* eslint prefer-arrow-callback:0 */
  it(`should register successfully`, function() {
    this.timeout(4000);
    return expect(Promise.all([getPort(), getPort()])
      .spread((coapPort, httpPort) => {
        serverOpts.server.app.coap.port = coapPort;
        serverOpts.connections.push({port: httpPort});
        const digsSerialOpts = {};
        digsSerialOpts[require.resolve('../../lib')] = {
          config: {
            dink: {
              config: {
                io: 'johnny-five/test/util/mock-firmata'
              }
            }
          }
        };
        serverOpts.plugins.push(digsSerialOpts);
        return createServer(serverOpts);
      })).to.eventually.be.fulfilled
      .then(server => {
        return server.stopAsync();
      });
  });
});
