'use strict';

const DigsSerialDevice = require('../../lib/serial-device');
const DigsSerial = require('../../lib/serial');
const digsMock = require('digs-common/test/mocks/digs');
const common = require('digs-common');
const Promise = common.Promise;
const _ = common.utils;

describe(`DigsSerial`, () => {
  let sandbox;
  let digs;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('DigsSerial');
    digs = digsMock(sandbox);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it(`should be a function`, () => {
    expect(DigsSerial).to.be.a('function');
  });

  describe(`init()`, () => {
    beforeEach(() => {
      sandbox.stub(DigsSerial.fixed.methods, 'onstart')
        .returns(Promise.resolve());
      _.set(digs, "plugins['digs-mqtt-broker'].broker", 'foo');
    });

    it(`should throw if not passed a Digs instance`, () => {
      expect(DigsSerial).to.throw(Error);
    });

    it(`should fulfill if passed a Digs instance`, () => {
      return expect(DigsSerial({}, digs)).to.eventually.be.fulfilled;
    });

    it(`should save a reference to Digs' broker`, () => {
      return expect(DigsSerial({}, digs).get('broker'))
        .to.eventually.equal(digs.plugins['digs-mqtt-broker'].broker);
    });

    it(`should initialize a hash of devices`, () => {
      const devices = {
        derp: {
          foo: 'bar'
        },
        herp: {
          baz: 'quux'
        }
      };
      return DigsSerial({
        config: devices
      }, digs)
        .then((ds) => {
          expect(ds.devices).to.be.an('object');
          expect(ds.devices.derp).to.be.an('object');
          expect(ds.devices.herp).to.be.an('object');
          expect(ds.devices.derp.foo).to.equal(devices.derp.foo);
          expect(ds.devices.herp.baz).to.equal(devices.herp.baz);
        });
    });

    describe(`if autoStart is true`, () => {
      it(`should start`, () => {
        return DigsSerial({}, digs)
          .then((ds) => {
            expect(ds.state).to.equal('started');
          });
      });
    });

    describe(`if autoStart is false`, () => {
      it(`should not start`, () => {
        return DigsSerial({
          autoStart: false
        }, digs)
          .then((ds) => {
            expect(ds.state).to.equal('stopped');
          });
      });
    });
  });

  describe(`event callback`, () => {
    describe(`onstart()`, () => {
      let ds;

      beforeEach(() => {
        _.set(digs, "plugins['digs-mqtt-broker'].broker", 'foo');
        return DigsSerial({
          autoStart: false,
          config: {
            derp: {
              foo: 'bar'
            },
            herp: {
              baz: 'quux'
            }
          }
        }, digs)
          .then((_ds) => {
            ds = _ds
            _.each(ds.devices, (device) => sandbox.spy(device, 'start'));
          });
      });

      it(`should call the start() method of each DigsSerialDevice`, () => {
        return expect(ds.start()).to.eventually.be.fulfilled
          .then(() => {
            _.each(ds.devices, (device) => {
              expect(device.start).to.have.been.calledOnce;
            });
          });
      });

      describe(`if failOnError is false`, () => {
        beforeEach(() => {
          ds.failOnError = false;
        });

        it(`should fulfill even if error`, () => {
          return expect(ds.start()).to.eventually.be.fulfilled;
        });
      });

      describe(`if failOnError is true`, () => {
        beforeEach(() => {
          ds.failOnError = true;
        });

        it(`should reject if error`, () => {
          sandbox.restore(ds.devices.derp, 'start');
          sandbox.stub(ds.devices.derp, 'start').returns(Promise.reject());
          return expect(ds.start()).to.eventually.be.rejectedWith(Error);
        });
      });
    });
  });
});
