'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const _ = common.utils;
const serialport = require('serialport');
const list = Promise.promisify(serialport.list);
const readFile = Promise.promisify(require('graceful-fs').readFile);

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
      .catch((err) => {
        digs.log([
          'digs-serial',
          'serial-ports',
          'debug'
        ], err.message);
        return Promise.reject();
      })
      .then((file) => JSON.parse(file))
      .error(() => {
        digs.log(['digs-serial', 'serial-ports', 'warn'],
          'No USB ID vendor database found');
        return {};
      })
      .then((usbDb) => {
        return list()
          .each((port) => {
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
      .tap((ports) => {
        digs.log(['digs-serial', 'serial-ports'],
          `Found ${ports.length} ports`);
      })
      .nodeify(done);
  }

  return serialPorts;
};
