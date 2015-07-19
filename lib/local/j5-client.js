'use strict';

let DigsEmitter = require('digs-common/digs-emitter');
let j5 = require('johnny-five');
let Joi = require('joi');
let _ = require('lodash');
let Promise = require('bluebird');
let ascoltatori = Promise.promisifyAll(require('ascoltatori'));
let debug = require('debug')('digs:digs-local:j5-client');
let qlobberFsq = require('qlobber-fsq');

const TIMEOUT = 5000;
const EXPECTED_ENVIRONMENT_KEYS = [
  'DIGS_ID',
  'DIGS_PROJECT',
  'DIGS_NAMESPACE',
  'DIGS_FSQ_DIR',
  'DIGS_BOARD_CONFIG'
];

process.on('unhandledRejection', function(err) {
  if (_.isFunction(process.send)) {
    process.send(err);
    /* eslint no-process-exit:0 */
    process.exit(1);
  } else {
    throw new Error(err);
  }
});


/**
 *
 */
class J5Client extends DigsEmitter {
  constructor() {
    super();

    if (!_.all(EXPECTED_ENVIRONMENT_KEYS, function(key) {
        return process.env[key];
      })) {
      throw new Error(`Invalid environment: ${JSON.stringify(process.env)}`);
    }

    let env = _.pick(process.env, function(value, key) {
      return /^DIGS_/.test(key);
    });
    let clientId = env.DIGS_ID;
    let baseTopic = [env.DIGS_NAMESPACE, env.DIGS_PROJECT, clientId].join('/');

    /**
     * Lookup of J5 Component IDs to the corresponding J5 Component object.
     * @type {Object.<string,Object>}
     */
    this.components = {};
    this.id = `${clientId}-local`;
    this._env = env;
    this._ascoltatoriOpts = {
      type: 'filesystem',
      json: false,
      qlobber_fsq: qlobberFsq,
      fsq_dir: env.DIGS_FSQ_DIR
    };
    this._ascoltatore = null;
    this._baseTopic = baseTopic;
    this._subTopic = `${baseTopic}/+`;
    this._logTopic = `${baseTopic}/j5`;
    this._boardOpts = JSON.parse(env.DIGS_BOARD_CONFIG);

    debug(`${this}: Instantiated J5Client w/ PID ${process.pid} and id ` +
      `"${this.id}"`);
    debug('Relevant environment:', env);
  }

  start() {
    return ascoltatori.buildAsync(this._ascoltatoriOpts)
      .bind(this)
      .then(function(ascoltatore) {
        this._ascoltatore = ascoltatore;
        ascoltatore.subscribe(this._topic, function(message, topic) {
          debug(`${this}: Received topic "${topic}" with message:`, message);
        });
        debug(`${this}: Subscribed to fsq @ ${this._ascoltatoriOpts.fsq_dir}`);
        return this._startBoard();
      })
      .then(function(board) {
        this._board = board;
        debug(`${this}: Successfully started board "${board.id}"`);
        process.send('ok');
      });
  }

  /**
   * Get a list of all methods by either component class or component id.
   * @param {Request} message Message from parent
   * @param {string} [message.id] ID of component
   * @param {string} [message.componentClass] J5 class name
   * @type {Command}
   * @returns {{methods: Array.<string>}} List of methods
   */
  dir(message) {
    let id = message.id;
    let componentClass = message.componentClass;
    let components = this.components;

    function privateFilter(methodName) {
      return methodName.charAt(0) !== '_';
    }

    let dirClass = _.memoize(function dirClass(componentClass) {
      return _(j5[componentClass].prototype)
        .functions()
        .filter(privateFilter)
        .value();
    });

    let dirInstance = _.memoize(function dirInstance(id) {
      return _(components[id])
        .functions()
        .filter(privateFilter)
        .value();
    });

    if (id) {
      debug(`${this}: Gathering methods for component "${id}"`);
    } else {
      debug(`${this}: Gathering methods for component class ` +
        `"${componentClass}"`);
    }

    return {
      methods: id ? dirInstance(id) : dirClass(componentClass)
    };
  }

  /**
   * Initialize the Johnny-Five LocalDevice.  {@link BOARD_DEFAULTS} are
   * applied, and a unique ID with prefix `j5-local-` is generated if none
   * present.
   */
  _startBoard() {
    // TODO joi assert

    let opts = _.defaults(_.omit(this._boardOpts || {}, 'name'), {
      id: _.uniqueId('digs-local-')
    });
    let ascoltatore = this._ascoltatore;
    let logTopic = this._logTopic;

    debug(`${this} Initializing j5 Board with opts:`, opts);

    return new Promise(function(resolve, reject) {
      let board = new j5.Board(opts);
      let t;
      board.on('ready', function() {
        clearTimeout(t);
        resolve(board);
      })
        .on('message', function(event) {
          ascoltatore.publish(logTopic, event);
        })
        .on('error', reject);

      t = setTimeout(function() {
        reject(new Error('LocalDevice timed out'));
      }, TIMEOUT);
    });
  }

  instantiate(message) {
    let componentClass = message.componentClass;
    let Constructor = j5[componentClass];
    let opts;
    if (!Constructor) {
      debug('unknown component');
      return;
    }

    opts = _.defaults(message.opts || {}, {
      id: _.uniqueId(_.format('%s-', this.componentClass)),
      board: this._board
    });

    debug('Attempting to instantiate a "%s" component', componentClass);

    try {
      this.components[opts.id] = new Constructor(opts);
    }
    catch (e) {
      debug('Failed to instantiate component class "%s": %s',
        componentClass, e.toString());
      debug(e);
      return;
    }

    return {
      id: opts.id,
      componentClass: componentClass
    };
  }

  execute(message) {
    let component = this.components[message.id];
    return component[message.method].apply(component, message.args);
  }
}

J5Client.schemas = {
  commands: {
    dir: Joi.object().keys({
      id: Joi.string(),
      componentClass: Joi.string()
    }).xor('id', 'componentClass'),
    components: Joi.any(),
    instantiate: Joi.object().keys({
      componentClass: Joi.string().required(),
      opts: Joi.object()
    })
  }
};

module.exports = J5Client;

if (require.main === module) {
  new J5Client().start();
}
