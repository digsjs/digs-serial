'use strict';

let Promise = require('bluebird');
let serialport = require('serialport');
let list = Promise.promisify(serialport.list);
let _ = require('lodash');
let readFile = Promise.promisify(require('graceful-fs').readFile);

module.exports = function serialPortsFactory(digs) {

  function serialPorts(opts, done) {
    opts = _.defaults(opts || {}, {
      force: false,
      dbPath: '../data/usb-ids.json'
    });

    if (this.ports && !opts.force) {
      return Promise.resolve(this.ports)
        .nodeify(done);
    }

    return readFile(opts.dbPath, 'utf-8')
      .catch(function(err) {
        digs.log([
          'digs-serial',
          'serial-ports',
          'debug'
        ], err.message);
        return Promise.reject();
      })
      .then(function(file) {
        return JSON.parse(file);
      })
      .error(function() {
        digs.log([
            'digs-serial',
            'serial-ports',
            'warn'
          ],
          'No USB ID vendor database found');
        return {};
      })
      .then(function(usbDb) {
        return list()
          .each(function(port) {
            let vendor;
            let product;
            if (port.vendorId && (vendor = usbDb[port.vendorId])) {
              port.vendor = vendor.name;
              if (port.productId &&
                (product = usbDb[port.vendorId].products[port.productId])) {
                port.product = product;
              }
            }
          });
      })
      .tap(function(ports) {
        digs.log([
            'digs-serial',
            'serial-ports'
          ],
          `Found ${ports.length} ports`);
      })
      .nodeify(done);
  }

  return serialPorts;
};
