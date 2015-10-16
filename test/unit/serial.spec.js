'use strict';

const DigsSerialDevice = require('../../lib/serial-device');
const DigsSerial = require('../../lib/serial');
const digsMock = require('digs-common/test/mocks/digs');
const Promise = require('digs-common').Promise;

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

    it(`should save a reference to Digs' broker`, () => {
      digs.broker = {};
      return expect(DigsSerial({}, digs).get('broker'))
        .to.eventually.equal(digs.broker);
    });

    it(`should call DigsSerialDevice() for each device`, () => {
      const init = sandbox.stub();
      const inits = DigsSerialDevice.fixed.init;
      DigsSerialDevice.fixed.init = [init];
      return DigsSerial({
        config: {
          derp: {
            foo: 'bar'
          },
          herp: {
            baz: 'quux'
          }
        }
      }, digs)
        .then(() => {
          expect(init).to.have.been.calledTwice;
        })
        .finally(() => DigsSerialDevice.init = inits);
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
      let inits;
      let init;

      beforeEach(() => {
        init = sandbox.stub();
        inits = DigsSerialDevice.fixed.init;
        DigsSerialDevice.fixed.init = [init];
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
          .then((_ds) => ds = _ds);
      });

      afterEach(() => {
        DigsSerialDevice.fixed.init = inits;
      });

      it(`should call the start() method of each DigsSerialDevice`, () => {
        return expect(ds.start()).to.eventually.be.fulfilled
          .then(() => {
            expect(init).to.have.been.calledTwice;
          });
      });
    });
  });
});
