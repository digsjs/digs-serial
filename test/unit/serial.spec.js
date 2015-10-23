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
    });

    it(`should throw if not passed a Digs instance`, () => {
      expect(DigsSerial).to.throw(Error);
    });

    it(`should fulfill if passed a Digs instance`, () => {
      return expect(DigsSerial({}, digs)).to.eventually.be.fulfilled;
    });

    it(`should initialize an array of devices`, () => {
      const devices = [
        {
          id: 'derp',
          foo: 'bar'
        },
        {
          id: 'herp',
          baz: 'quux'
        }
      ];
      return DigsSerial({
        config: devices
      }, digs)
        .then((ds) => {
          expect(ds.devices).to.be.an('object');
          expect(ds.devices.derp).to.be.an('object');
          expect(ds.devices.herp).to.be.an('object');
          expect(ds.devices.derp.foo).to.equal(devices[0].foo);
          expect(ds.devices.herp.baz).to.equal(devices[1].baz);
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
            ds = _ds;
            _.each(ds.devices,
              (device) => sandbox.stub(device, 'start')
                .returns(Promise.resolve(device)));
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

      it(`should resolve with an object containing a list of succesfully ` +
        `started devices`, () => {
        return expect(ds.start()).to.eventually.be.an('object')
          .then((opts) => {
            expect(opts.startedDevices).to.be.an('array');
            expect(opts.startedDevices.length).to.equal(2);
          });
      });

      it(`should resolve with an object containing a list of failed ` +
        `devices`, () => {
        return expect(ds.start()).to.eventually.be.an('object')
          .then((opts) => {
            expect(opts.failedDevices).to.be.an('array');
            expect(opts.failedDevices.length).to.equal(0);
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
