'use strict';

module.exports = require('./localdevice');

    /**
     * Mapping of {@link Board} {@link Board#id Board ID's} to Boards.
     * @type {Object.<string,Board>}
     */
      //this.boards = _(opts.boards)
      //  .pick(function (value) {
      //    return _.isObject(value) && value !== '_' && !_.isArray(value) &&
      //      !_.isFunction(value);
      //  })
      //  .map(this.createBoard, this)
      //  .indexBy('id')
      //  .value();
      //
      //if (opts.mqtt.broker.type === 'internal') {
      //  debug('%s: using internal MQTT broker', this);
      //  this._brokerReady = new Promise(function (resolve, reject) {
      //    this.broker = digsBroker(opts.mqtt.broker.port,
      // opts.mqtt.broker.host) .on('listening', resolve) .on('error', reject);
      // }.bind(this)); } else { this._brokerReady = Promise.resolve(); }
      // this.opts = opts;


  //
  ///**
  // * Bootstraps a {@link Board} from a {@link BoardDef Board Definition}
  // * @param {BoardDef} opts Board Definition
  // * @param {?string} [id] Unique ID of board, if string
  // * @returns {Board} New Board instance
  // */
  //createBoard(opts, id) {
  //  id = opts.id = (_.isString(id) && id) || opts.id || null;
  //
  //  debug('%s: creating <%s#%s> w/ options:', this, Board.name, id, opts);
  //
  //  let board = new Board(this, opts);
  //  pipeEvent('error', board, this);
  //  return board;
  //}
  //
  ///**
  // * Starts a Board.
  // * @param {(Board|BoardDef|string)} [board] Board object, Board
  // *     Definition, or Board ID.  If omitted, starts all Boards.
  // * @param {string} [id] ID of Board, if `board` is a Board Definition.
  // * @return {(Promise.<Board>|Promise.<Array.<Board>>)} Ready Board(s)
  // */
  //start(board, id) {
  //  return this._brokerReady
  //    .bind(this)
  //    .then(function () {
  //      if (_.isUndefined(board)) {
  //        debug('%s: starting all (%d) Boards', this, _.size(this.boards));
  //        return Promise.settle(_.map(this.boards, function (boardObj) {
  //          return boardObj.start()
  //            .bind(this)
  //            .catch(function (err) {
  //              this.warn(err);
  //            });
  //        }, this));
  //      }
  //      else if (_.isString(board)) {
  //        debug('%s: found Board with ID "%s"', this, board);
  //        board = this.boards[board];
  //      }
  //      else if (!(board instanceof Board)) {
  //        debug('%s: creating <%s#%s> from object:', this, Board.name, id,
  //          board);
  //        this.boards[board.id] = board = this.createBoard(board, id);
  //      }
  //      debug('%s: starting <%s#%s>', this, Board.name, board.id);
  //      return board.start();
  //    });
  //}
