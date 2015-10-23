'use strict';

const createServer = require('digs');
const digsSerial = require('../../lib/index');
const common = require('digs-common');
const _ = common.utils;
const Promise = common.Promise;
const getPort = Promise.promisify(require('get-port'));
const DigsData = require('digs-data/lib/data');

describe(`digs-serial plugin`, () => {
  let digs;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('digs-serial plugin');
    sandbox.stub(DigsData.fixed.methods, 'connect', function() {
      return Promise.resolve(this);
    });
    console.log('here');

    return Promise.all([getPort(), getPort()])
      .then((coapPort, httpPort) => {
        return createServer({
          server: {
            app: {
              coap: {
                port: coapPort
              },
              http: {
                port: httpPort
              }
            }
          }
        });
      })
      .then((server) => digs = server);
  });

  afterEach((done) => {
    sandbox.restore();
    digs.stop(done);
  });

  it(`should register successfully`, (done) => {
    digs.register(digsSerial, (err) => {
      expect(err).to.be.undefined;
      done();
    });
  });
});
