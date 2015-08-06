'use strict';

let rewire = require('rewire');
let Serial = rewire('../../../../lib/local');
let DigsEmitter = require('digs-common/digs-emitter');
let qlobberFsq = require('qlobber-fsq');
let path = require('path');
let Promise = require('bluebird');
let ascoltatori = require('ascoltatori');

describe('Serial', function() {

  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create('Serial');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('constructor', function() {
    it('should be a function', function() {
      expect(Serial).to.be.a('function');
    });

    it('should instantiate a DigsEmitter', function() {
      expect(new Serial()).to.be.instanceof(DigsEmitter);
    });

    it('should set _ascoltatoriOpts', function() {
      expect(new Serial()._ascoltatoriOpts).to.eql({
        type: 'filesystem',
        json: false,
        qlobber_fsq: qlobberFsq,
        fsq_dir: path.join(__dirname, '..', '..', '..', '..', '.fsq')
      });
    });

    it('should set empty "devices" property', function() {
      expect(new Serial()._devices).to.eql({});
    });

    it('should set null "_ascoltatore" property', function() {
      expect(new Serial()._ascoltatore).to.be.null;
    });

    it('should set "_digs" property from parameters', function() {
      expect(new Serial('foo')._server).to.equal('foo');
    });

    it('should set "_opts" property from parameters with defaults', function() {
      expect(new Serial('foo', {
        bar: 'baz'
      })._opts).to.eql({
          devices: {},
          bar: 'baz'
        });
    });
  });

  describe('start()', function() {
    let local;
    let buildAsync;
    let device;

    beforeEach(function() {
      device = {
        start: sandbox.stub().returns(Promise.resolve({}))
      };
      buildAsync = sandbox.stub(ascoltatori, 'buildAsync').
        returns(Promise.resolve({}));
      local = new Serial();
      sandbox.stub(local, 'createDevices').returns([device]);
    });

    it('should call ascoltatori.buildAsync()', function() {
      return local.start()
        .then(function() {
          expect(buildAsync).to.have.been.calledOnce;
        });
    });

    it('should call createDevices()', function() {
      return local.start()
        .then(function() {
          expect(local.createDevices).to.have.been.calledOnce;
        });
    });

    it('should call the start() method of each device', function() {
      return local.start()
        .then(function() {
          expect(device.start).to.have.been.calledOnce;
        });
    });
  });
});
