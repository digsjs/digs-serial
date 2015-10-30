'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const definitions = common.definitions;
const DigsObject = definitions.DigsObject;
const DigsFSM = definitions.DigsFSM;
const DigsIdentifier = definitions.DigsIdentifier;
const DigsEmitter = definitions.DigsEmitter;
const mspawn = Promise.promisify(require('spawn-module'));
const _ = common.utils;

const DigsSerialDevice = DigsObject
  .compose(DigsIdentifier)
  .static({
    defName: 'DigsSerialDevice'
  })
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
      to: 'stopped'
    }
  ])
  .refs({
    config: {}
  })
  .methods({
    kill() {
      if (this.client) {
        mspawn.kill(this.client);
        delete this.client;
      }
    },
    onstart(opts) {
      return mspawn(require, './client.js')
        .then(client => {
          this.client = client;
          this.digs.on('stop', this.kill.bind(this));
          process.on('exit', this.kill.bind(this));
          return Promise.promisify(client.init)(this.config, {
            timeout: this.timeout
          });
        })
        .catch(err => {
          this.log(_.dump(err));
        })
        .return(opts);
    },
    onstop(opts) {
      this.kill();
      return opts;
    }
  })
  .compose(DigsEmitter);

module.exports = DigsSerialDevice;
