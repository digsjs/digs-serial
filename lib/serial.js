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
      from: 'started',
      to: 'stopped'
    },
    {
      name: 'restart',
      from: 'started'
    }
  ])
  .refs({
    config: [],
    autoStart: true,
    failOnError: false
  })
  .methods({
    normalizeConfig(config) {
      if (_.isNotArray(config)) {
        return _.map(config, (device, id) => _.extend({
          id: id
        }, config));
      }
      return config;
    },
    onstart(opts) {
      const devices = _.first(opts.args) || this.devices;
      opts.startedDevices = [];
      opts.failedDevices = [];
      return Promise.settle(_.map(devices, serialDevice => serialDevice.start()
        .then(() => {
          opts.startedDevices.push(serialDevice);
          this.info('digs-serial',
            `Successfully started serial device "${serialDevice.id}"`);
        }, err => {
          opts.failedDevices.push(serialDevice);
          this.error('digs-serial',
            `Failed to start device "${serialDevice.id}": ${err}`);
          return Promise.reject(err);
        })))
        .filter(result => result.isRejected())
        .then(failedDevices => {
          if (_.isNotEmpty(failedDevices) && this.failOnError) {
            return Promise.reject(new Error(`Failed to start ` +
              `${failedDevices.length} ` +
              `${plural('device', failedDevices.length)}`));
          }
          return opts;
        });
    },
    onentered(opts) {
      this.emit(opts.to, opts);
      return opts;
    }
  })
  .init(function init() {
    const config = this.normalizeConfig(this.config);

    return Promise.map(config, _(DigsSerialDevice)
      .partialRight(this.digs)
      .ary(1)
      .value())
      .then(devices => {
        this.devices = _.indexBy(devices, 'id');
        const count = devices.length;
        this.debug('digs-serial', `Instantiated ${count}` +
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
