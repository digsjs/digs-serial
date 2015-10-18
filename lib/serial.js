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
            return Promise.reject(new Error(`Failed to start ` +
              `${failedDevices.length} ` +
              `${plural('device', failedDevices.length)}`));
          }
        });
    }
  })
  .init(function init() {
    this.broker = this.digs.plugins['digs-mqtt-broker'].broker;
    return Promise.all(_.map(this.config, (device, deviceId) => {
      return DigsSerialDevice(_.extend(device, {
        id: deviceId
      }), this.digs);
    }))
      .then((devices) => {
        this.devices = _.indexBy(devices, 'id');
        this.debug('digs-serial', `Instantiated ${devices.length}` +
          `${plural('device', devices.length)}`);
        if (this.autoStart) {
          return this.start()
            .return(this);
        }
        return this;
      });
  })
  .compose(DigsEmitter);

module.exports = DigsSerial;
