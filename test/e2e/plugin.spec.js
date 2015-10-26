'use strict';

const common = require('digs-common');
common.debug.enable('digs*');
const createServer = require('digs');
const digsSerial = require('../../lib/index');
const Promise = common.Promise;
const getPort = Promise.promisify(require('get-port'));

describe(`digs-serial plugin`, () => {
  let digs;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('digs-serial plugin');

    return Promise.all([getPort(), getPort()])
      .spread((coapPort, httpPort) => {
        return createServer({
          server: {
            app: {
              coap: {
                port: coapPort
              }
            }
          },
          connections: {
            port: httpPort
          }
        });
      })
      .then(server => digs = server);
  });

  afterEach(done => {
    sandbox.restore();
    digs.stop(done);
  });

  it(`should register successfully`, done => {
    digs.register(digsSerial, err => {
      expect(err).to.be.undefined;
      done();
    });
  });
});
