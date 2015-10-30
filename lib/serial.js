'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const definitions = common.definitions;
const DigsObject = definitions.DigsObject;
const DigsEmitter = definitions.DigsEmitter;
const DigsSerialDevice = require('./serial-device');
const DigsFSM = definitions.DigsFSM;
const _ = common.utils;
const plural = require('plural');

const DigsSerial = DigsObject
  .compose(DigsFSM)
  .initial('stopped')
  .events([
    {
      name: 'start',
      from: 'stopped',
      to: 'started'
    },
    {
      name: 'stop',
      from: ['started', 'stopped'],
      to: 'stopped'
    },
    {
      name: 'restart',
      from: ['started', 'stopped'],
      to: 'started'
    }
  ])
  .refs({
    config: [],
    autoStart: true,
    failOnError: false,
    preStart: _.noop
  })
  .methods({
    normalizeConfig(config) {
      if (_.isNotArray(config)) {
        config = _.map(config, (device, id) => _.extend({
          id: id
        }, device));
      }
      _.each(config, device => {
        device.id = device.id || device.config.id;
      });
      return config;
    },
    onstart(opts) {
      return Promise.method(this.preStart)()
        .then(() => {
          opts.startedDevices = [];
          opts.failedDevices = [];
          return Promise.all(_.map(this.devices, device =>
              device.start()
                .then(() => {
                  opts.startedDevices.push(device);
                  this.info(['digs-serial'],
                    `Started serial device "${device.id}"`);
                }, err => {
                  opts.failedDevices.push(device);
                  this.error(['digs-serial'],
                    `Failed to start device "${device.id}"`);
                  return Promise.reject(err);
                })
                .reflect()))
            .filter(result => result.isRejected())
            .then(failedDevices => {
              if (_.isNotEmpty(failedDevices) && this.failOnError) {
                return Promise.reject(new Error(`Failed to start ` +
                  `${failedDevices.length} ` +
                  `${plural('device', failedDevices.length)}`));
              }
              return opts;
            });
        });
    },
    onentered(opts) {
      this.emit(opts.to, opts);
      return opts;
    }
  })
  .init(function init() {
    const config = this.normalizeConfig(this.config);

    return Promise.map(config,
      deviceCfg => DigsSerialDevice(deviceCfg, this.digs))
      .then(devices => {
        this.devices = _.indexBy(devices, 'id');
        const count = devices.length;
        this.debug(['digs-serial'], `Instantiated ${count} ` +
          `${plural('device', count)}`);
        if (this.autoStart) {
          return this.start()
            .return(this);
        }
        return this;
      });
  })
  .compose(DigsEmitter);

module.exports = DigsSerial;
