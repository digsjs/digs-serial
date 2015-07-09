/**
 * @module models/worker
 */

'use strict';

let DigsEmitter = require('digs-common/digs-emitter'),
  _ = require('lodash'),
  DigsClient = require('digs-client'),
  child_process = require('child_process'),
  errors = require('digs-common/errors'),
  Promise = require('bluebird');

const PEON_PATH = require.resolve('../peon');

let debug = require('debug')('digs:local:worker');

/**
 * Wraps a `ChildProcess` object
 * @alias module:models/worker
 */
class Worker extends DigsEmitter {

  /**
   * Sets some instance props.
   * @param {LocalDevice} board LocalDevice instance
   */
  constructor(board) {
    super();

    this._board = board;
    this._proc = null;

    this.ready = false;
    this.client = null;

    debug('%s: instantiated', this);
  }


}

module.exports = Worker;
