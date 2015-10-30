'use strict';

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
          config: {
            id: 'derp',
            foo: 'bar'
          }
        },
        {
          config: {
            id: 'herp',
            baz: 'quux'
          }
        }
      ];
      return DigsSerial({
        config: devices,
        autoStart: false
      }, digs)
        .then(ds => {
          expect(ds.devices).to.be.an('object');
          expect(ds.devices.derp).to.be.an('object');
          expect(ds.devices.herp).to.be.an('object');
          expect(ds.devices.derp.id)
            .to
            .equal(ds.devices.derp.config.id)
            .to
            .equal('derp');
          expect(ds.devices.herp.id)
            .to
            .equal(ds.devices.herp.config.id)
            .to
            .equal('herp');
          expect(ds.devices.derp.config.foo).to.equal(devices[0].config.foo);
          expect(ds.devices.herp.config.baz).to.equal(devices[1].config.baz);
          return Promise.map(_.toArray(ds.devices), device => device.stop());
        });
    });

    describe(`if autoStart is true`, () => {
      it(`should start`, () => {
        return DigsSerial({}, digs)
          .then(ds => {
            expect(ds.state).to.equal('started');
          });
      });
    });

    describe(`if autoStart is false`, () => {
      it(`should not start`, () => {
        return DigsSerial({
          autoStart: false
        }, digs)
          .then(ds => {
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
              config: {
                foo: 'bar'
              }
            },
            herp: {
              config: {
                baz: 'quux'
              }
            }
          }
        }, digs)
          .then(_ds => {
            ds = _ds;
            _.each(ds.devices,
              device => sandbox.stub(device, 'start')
                .returns(Promise.resolve(device)));
          });
      });

      afterEach(() => {
        return Promise.map(_.toArray(ds.devices), device => device.stop());
      });

      it(`should call the start() method of each DigsSerialDevice`, () => {
        return expect(ds.start()).to.eventually.be.fulfilled
          .then(() => {
            _.each(ds.devices, device => {
              expect(device.start).to.have.been.calledOnce;
            });
          });
      });

      it(`should resolve with an object containing a list of succesfully ` +
        `started devices`, () => {
        return expect(ds.start()).to.eventually.be.an('object')
          .then(opts => {
            expect(opts.startedDevices).to.be.an('array');
            expect(opts.startedDevices.length).to.equal(2);
          });
      });

      it(`should resolve with an object containing a list of failed ` +
        `devices`, () => {
        return expect(ds.start()).to.eventually.be.an('object')
          .then(opts => {
            expect(opts.failedDevices).to.be.an('array');
            expect(opts.failedDevices.length).to.equal(0);
          });
      });

      it(`should emit the new state`, () => {
        const stub = sandbox.stub();
        ds.once('started', stub);
        expect(ds.start()).to.eventually.be.fulfilled
          .then(opts => {
            expect(stub).to.have.been.calledWithExactly(opts);
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
          return expect(ds.start()).to.eventually.be.rejectedWith(Error)
            .then(() => {
              expect(ds.state).to.equal('stopped');
            });
        });
      });
    });
  });
});
