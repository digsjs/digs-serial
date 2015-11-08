'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const getPort = require('get-port');
Promise.longStackTraces();

describe(`digs-serial plugin`, () => {
  let sandbox;
  let serverOpts;
  let createDigsServer;

  before(() => {
    common.debug.enable('digs*');
    createDigsServer = require('digs');
  });

  function createServer() {
    return Promise.all([getPort(), getPort()])
      .spread((coapPort, httpPort) => {
        serverOpts.server.app.coap.port = coapPort;
        serverOpts.connections.push({
          port: httpPort
        });
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
        return createDigsServer(serverOpts);
      });
  }

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

  afterEach(() => {
    sandbox.restore();
  });

  /* eslint prefer-arrow-callback:0 */
  it(`should register successfully`, function() {
    this.timeout(4000);
    return expect(createServer()).to.eventually.be.fulfilled
      .then(server => {
        return server.stopAsync();
      });
  });

  describe(`exposed method`, () => {
    let digs;

    /* eslint prefer-arrow-callback:0 */
    beforeEach(function() {
      this.timeout(4000);
      return createServer()
        .then(_digs => {
          digs = _digs;
        });
    });

    afterEach(() => {
      if (digs) {
        return digs.stopAsync();
      }
    });

    describe(`serialPorts()`, () => {
      it(`should expose plugin method serialPorts()`, () => {

      });
    });
  });
});
