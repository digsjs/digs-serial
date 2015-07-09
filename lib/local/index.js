'use strict';

let LocalDevice = require('./localdevice');
let DigsEmitter = require('digs-common/digs-emitter');

let debug = require('digs:digs-local:local');

const NAME = '<digs-local.Local>';

class Local extends DigsEmitter {
  constructor(digs, opts) {
    super();
    this._digs = digs;
    this._opts = opts;
    this._devices = {};
    this.createDevices();
  }

  get devices() {
    return this._devices;
  }

  createDevices() {
    return _.map(this._opts.devices, function (config) {
      return this.createDevice(config);
    }, this);
  }

  createDevice(config) {
    let device = new LocalDevice(this._digs, config);
    debug(`${NAME}: Created local device ${device}`);
    this._devices[device.id] = device;
    return device;
  }

  start(localdevice) {
    let device;
    if (_.isString(localdevice) && (device = this._devices[localdevice])) {
      return device.start();
    }
    else if (localdevice instanceof LocalDevice) {
      return localdevice.start();
    }
    else if (localdevice) {
      throw new Error('Invalid parameters');
    }
    return Promise.settle(_.map(this._devices, function (device) {
      return device.start();
    }));
  }
}

module.exports = Local;
