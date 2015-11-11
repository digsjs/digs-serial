'use strict';

const rewire = require('rewire');
const DigsSerialDevice = rewire('../../lib/serial-device');
const digsMock = require('digs-common/test/mocks/digs');

describe(`DigsSerialDevice`, () => {
  let sandbox;
  let digs;
  let spawnm;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('DigsSerialDevice');
    spawnm = sandbox.stub();
    spawnm.kill = sandbox.stub();
    digs = digsMock(sandbox);
    DigsSerialDevice.__set__('spawnm', spawnm);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it(`should be a function`, () => {
    expect(DigsSerialDevice).to.be.a('function');
  });

  describe(`method`, () => {
    describe(`kill()`, () => {
      let dsd;

      beforeEach(() => {
        dsd = DigsSerialDevice({}, digs);
      });

      describe(`if a client has been created`, () => {
        beforeEach(() => {
          dsd.client = {};
        });

        it(`should kill the client and remove it`, () => {
          dsd.kill();
          expect(dsd.client).to.be.undefined;
          expect(spawnm.kill).to.have.been.calledOnce;
        });
      });

      describe(`if a client has not been created`, () => {
        it(`should not attempt to kill it`, () => {
          dsd.kill();
          expect(spawnm.kill).not.to.have.been.called;
        });
      });
    });
  });

  describe(`event callback`, () => {
    describe(`onstart()`, () => {

    });

    describe(`onstop()`, () => {

    });
  });
});
