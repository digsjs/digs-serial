'use strict';

let SerialDevice = require('./serialdevice');
let DigsEmitter = require('digs-common/digs-emitter');
let domain = require('domain');
let Promise = require('bluebird');
let ascoltatori = Promise.promisifyAll(require('ascoltatori'));
let qlobberFsq = require('qlobber-fsq');
let path = require('path');
let _ = require('lodash');
let Boom = require('boom');

class Serial extends DigsEmitter {
  constructor(server, opts) {
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
    this._server = server;
  }

  get devices() {
    return this._devices;
  }

  createDevices() {
    return _(this._opts.devices)
      .map(function(config) {
        return this.createDevice(config);
      }, this)
      .indexBy('id')
      .value();
  }

  createDevice(config) {
    let d = domain.create();
    _.extend(config, {
      ascoltatoriOpts: this._ascoltatoriOpts
    });
    let device = new SerialDevice(this._server, this._ascoltatore, config);
    d.add(device);
    d.on('error', function(err) {
      this.log(`${device}: Failed: ${err}`);
    }.bind(this));
    this.log(`${this}: Created local device ${device}`);
    return device;
  }

  log(data) {
    this._server.log(['digs-serial', 'serial'], data);
  }

  start() {
    return ascoltatori.buildAsync(this._ascoltatoriOpts)
      .bind(this)
      .then(function(ascoltatore) {
        this.log(`${this}: FSQ running; creating devices`);
        this._ascoltatore = ascoltatore;
        let devices = this._devices = this.createDevices();
        return Promise.settle(_.map(devices, function(device) {
          return device.start()
            .bind(this)
            .catch(function(err) {
              this.log(`Could not start LocalDevice "${device.name}": ${err}`);
              throw err;
            });
        }, this));
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
      })
      .then(function() {
        this._server.route({
          method: 'GET',
          path: `/{deviceId}`,
          handler: function(req, reply) {
            console.log(this.devices);
            reply(this._devices[req.params.deviceId]);
          }.bind(this)
        });

        this._server.route({
          method: 'GET',
          path: `/{deviceId}/{componentId}`,
          handler: function(req, reply) {
            reply(this._devices[req.params.deviceId].components[req.params.componentId]);
          }.bind(this)
        });

        this._server.route({
          method: 'PUT',
          path: `/{deviceId}/{componentId}/{method}`,
          handler: function(req, reply) {
            let params = req.params;
            let method = params.method;
            let component = this._devices[params.deviceId].components[params.componentId];
            component[method]()
              .catch(function(err) {
                reply(Boom.wrap(new Error(err)));
              })
              .then(function(result) {
                reply(result);
              });
          }.bind(this)
        });
      });
  }
}

module.exports = Serial;
