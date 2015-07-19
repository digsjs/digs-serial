'use strict';

let rewire = require('rewire');
let Local = rewire('../../../../lib/local');
let DigsEmitter = require('digs-common/digs-emitter');
let qlobberFsq = require('qlobber-fsq');
let path = require('path');
let Promise = require('bluebird');
let _ = require('lodash');
let ascoltatori = require('ascoltatori');

describe('Local', function() {

  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create('Local');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('constructor', function() {
    it('should be a function', function() {
      expect(Local).to.be.a('function');
    });

    it('should instantiate a DigsEmitter', function() {
      expect(new Local()).to.be.instanceof(DigsEmitter);
    });

    it('should set _ascoltatoriOpts', function() {
      expect(new Local()._ascoltatoriOpts).to.eql({
        type: 'filesystem',
        json: false,
        qlobber_fsq: qlobberFsq,
        fsq_dir: path.join(__dirname, '..', '..', '..', '..', '.fsq')
      });
    });

    it('should set empty "devices" property', function() {
      expect(new Local()._devices).to.eql({});
    });

    it('should set null "_ascoltatore" property', function() {
      expect(new Local()._ascoltatore).to.be.null;
    });

    it('should set "_digs" property from parameters', function() {
      expect(new Local('foo')._digs).to.equal('foo');
    });

    it('should set "_opts" property from parameters with defaults', function() {
      expect(new Local('foo', {
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
      local = new Local();
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
