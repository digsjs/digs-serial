'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const definitions = common.definitions;
const DigsObject = definitions.DigsObject;
const DigsEmitter = definitions.DigsEmitter;
const DigsSerialDevice = require('./serial-device');
const DigsFSM = definitions.DigsFSM;
const _ = common.utils;

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
    config: {},
    autoStart: true,
    failOnError: false
  })
  .methods({
    onstart(opts) {
      const devices = _.first(opts.args) || this.devices;
      return Promise.settle(_.map(devices,
        (serialDevice) => {
          return serialDevice.start()
            .then(() => {
              this.info('digs-serial',
                `Successfully started serial device "${serialDevice.id}"`);
            }, (err) => {
              this.error('digs-serial',
                `Failed to start device "${serialDevice.id}": ${err}`);
              return Promise.reject(err);
            });
        }))
        .filter((result) => result.isRejected())
        .then((failedDevices) => {
          if (failedDevices.length && this.failOnError) {
            return Promise.reject(new Error('Failed to start all devices'));
          }
        });
    }
  })
  .init(function init() {
    this.broker = this.digs.broker;
    this.devices = _.mapValues(this.config, (cfg) =>
      DigsSerialDevice(cfg, this.digs));
    if (this.autoStart) {
      return this.start()
        .return(this);
    }
    return Promise.resolve(this);
  })
  .compose(DigsEmitter);

module.exports = DigsSerial;
