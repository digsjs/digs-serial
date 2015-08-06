'use strict';

let DigsEmitter = require('digs-common/digs-emitter');
let j5 = require('johnny-five');
let _ = require('lodash');
let Promise = require('bluebird');
let ascoltatori = Promise.promisifyAll(require('ascoltatori'));
let qlobberFsq = require('qlobber-fsq');

const TIMEOUT = 1e4;
const EXPECTED_ENVIRONMENT_KEYS = [
  'DIGS_ID',
  'DIGS_PROJECT',
  'DIGS_NAMESPACE',
  'DIGS_FSQ_DIR',
  'DIGS_BOARD_CONFIG'
];

function log(level) {
  let msg = _.toArray(arguments).slice(1);
  process.send({
    type: 'log',
    level: level,
    msg: msg
  });
}

function debug() {
  log.apply(null, ['debug'].concat(_.toArray(arguments)));
}

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

    /**
     * Lookup of J5 Component IDs to the corresponding J5 Component object.
     * @type {Object.<string,Object>}
     */
    this.components = {};
    this.id = clientId;
    this._clientId = `${clientId}-local`;
    this._env = env;
    this._ascoltatoriOpts = {
      type: 'filesystem',
      json: false,
      qlobber_fsq: qlobberFsq,
      fsq_dir: env.DIGS_FSQ_DIR
    };
    this._ascoltatore = null;
    this._boardOpts = JSON.parse(env.DIGS_BOARD_CONFIG);

    debug(`${this}: Instantiated J5Client w/ PID ${process.pid} and id ` +
      `"${this.id}"`);
  }

  start() {
    return ascoltatori.buildAsync(this._ascoltatoriOpts)
      .bind(this)
      .then(function(ascoltatore) {
        this._ascoltatore = ascoltatore;
        return this._startBoard();
      })
      .then(function(board) {
        this._board = board;
        debug(`${this}: Successfully started board "${board.id}"`);
        this.subscribe(`${this._clientId}/+`, function(topic, message) {
          debug(`${this} (FSQ): Received topic "${topic}" with message:`,
            message);
          let method = topic.split('/')[1];
          if (method && this[method]) {
            this[method](message);
          } else {
            this.publish('error', 'Unknown method');
          }
        });
        debug(`${this}: Subscribed to FSQ @ ${this._ascoltatoriOpts.fsq_dir}`);
        return this.publish('ready', {
          id: board.id,
          port: board.port
        });
      })
      .error(function(err) {
        this.publish('error', err.message);
      });
  }

  publish(topic, data) {
    topic = `${this.id}/${topic}`;
    debug(`${this} (FSQ): Publishing topic "${topic}" with data`, data);
    return this._ascoltatore.publishAsync(topic, data);
  }

  subscribe(topic, callback) {
    debug(`${this} (FSQ): Subscribing to topic "${topic}"`);
    return this._ascoltatore.subscribe(topic, callback.bind(this));
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

    return id ? dirInstance(id) : dirClass(componentClass);
  }

  /**
   * Initialize the Johnny-Five Board.  {@link BOARD_DEFAULTS} are
   * applied, and a unique ID with prefix `j5-local-` is generated if none
   * present.
   */
  _startBoard() {
    // TODO joi assert

    let opts = _.defaults(_.omit(this._boardOpts || {}, 'name'), {
      id: _.uniqueId('digs-serial-board-')
    });

    debug(`${this} Initializing j5 Board with opts:`, opts);

    return new Promise(function(resolve, reject) {
      let board = new j5.Board(opts);
      let t;
      board.once('ready', function() {
        clearTimeout(t);
        resolve(board);
      })
        .on('message', function(event) {
          debug(`${this} (J5): ${event.message}`);
        }.bind(this))
        .once('error', reject);

      t = setTimeout(function() {
        reject(new Error('J5 Board timed out'));
      }, TIMEOUT);
    }.bind(this));
  }

  instantiate(message) {
    let componentClass = message.componentClass;
    let Constructor = j5[componentClass];
    let opts;
    if (!Constructor) {
      let msg = `${this}: Unknown component.`;
      debug(msg, message);
      return this.publish('error', {
        message: msg
      });
    }

    opts = _.defaults(message.opts || {}, {
      id: _.uniqueId(`${this.componentClass}-`),
      board: this._board
    });

    debug(`${this}: Attempting to instantiate a "${componentClass}" component`);

    try {
      this.components[opts.id] = new Constructor(opts);
    }
    catch (err) {
      let msg = `${this}: Failed to instantiate component class ` +
        `"${componentClass}"`;
      debug(msg, err);
      return this.publish('error', {
        message: msg,
        err: err
      });
    }

    return this.publish('instantiated', {
      id: opts.id,
      componentClass: componentClass,
      methods: this.dir({ id: opts.id })
    });
  }

  execute(message) {
    let component = this.components[message.id];
    let retval;
    try {
      retval = component[message.method].apply(component, message.args);
      try {
        JSON.stringify(retval);
      } catch (ignored) {
        retval = true;
      }
      this.publish('executed', { retval: retval });
    } catch (e) {
      this.publish('error', e.message);
    }
  }
}

module.exports = J5Client;

if (require.main === module) {
  new J5Client().start();
}
