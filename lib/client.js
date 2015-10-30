'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const j5 = require('johnny-five');
const _ = common.utils;
const define = common.define;
const debug = common.debug('digs-serial:client');

const J5 = define({
  refs: {
    timeout: 1200
  },
  init(context) {
    return Promise.try(() => {
      const config = this.config = _.first(context.args);

      if (_.isString(config.io)) {
        const IO = require(config.io);
        debug(`Using custom io at path ${config.io}`);
        debug(`Custom opts: ${_.dump(config.ioOpts)}`);
        config.io = new IO(config.ioOpts || {});
      }

      return new Promise((resolve, reject) => {
        const board = this.board = new j5.Board(config);
        board.on('ready', resolve);
        board.on('error', reject);
      })
        .timeout(this.timeout)
        .return({
          success: true
        });
    });
  }
});

function init(config, opts, done) {
  return J5(opts || {}, config)
    .asCallback(done);
}

module.exports = {
  init: init
};
