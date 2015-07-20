'use strict';

let LocalDevice = require('./localdevice');
let DigsEmitter = require('digs-common/digs-emitter');
let domain = require('domain');
let Promise = require('bluebird');
let ascoltatori = Promise.promisifyAll(require('ascoltatori'));
let debug = require('debug')('digs:digs-local:local');
let qlobberFsq = require('qlobber-fsq');
let path = require('path');
let _ = require('lodash');

class Local extends DigsEmitter {
  constructor(digs, opts) {
    super();
    opts = opts || {};
    _.defaults(opts, {
      devices: {}
    });
    this._ascoltatoriOpts = {
      type: 'filesystem',
      json: false,
      qlobber_fsq: qlobberFsq,
      fsq_dir: path.join(__dirname, '..', '..', '.fsq')
    };
    this._opts = opts;
    this._devices = {};
    this._ascoltatore = null;
    this._digs = digs;
  }

  get devices() {
    return this._devices;
  }

  createDevices() {
    return _.map(this._opts.devices, function(config) {
      return this.createDevice(config);
    }, this);
  }

  createDevice(config) {
    let d = domain.create();
    _.extend(config, {
      ascoltatoriOpts: this._ascoltatoriOpts
    });
    let device = new LocalDevice(this._digs, this._ascoltatore, config);
    d.add(device);
    d.on('error', function(err) {
      debug(`${device}: Failed: ${err}`);
    });
    debug(`${this}: Created local device ${device}`);
    return device;
  }

  start() {
    return ascoltatori.buildAsync(this._ascoltatoriOpts)
      .bind(this)
      .then(function(ascoltatore) {
        debug(`${this}: FSQ running; creating devices`);
        this._ascoltatore = ascoltatore;
        let devices = this._devices = this.createDevices();
        return Promise.settle(_.map(devices, function(device) {
          return device.start()
            .catch(function(err) {
              debug(`Could not start LocalDevice "${device.name}":`, err);
              throw err;
            });
        }));
      })
      .then(function(results) {
        return _(results)
          .filter(function(result) {
            return result.isFulfilled();
          })
          .map(function(result) {
            return result.value();
          })
          .value();
      });
  }
}

module.exports = Local;
