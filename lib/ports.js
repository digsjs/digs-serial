'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const _ = common.utils;
const serialport = require('serialport');
const list = Promise.promisify(serialport.list);
const fs = common.fs;

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

    return fs.readFileAsync(opts.dbPath, 'utf-8')
      .catch(err => {
        digs.log([
          'digs-serial',
          'serial-ports',
          'debug'
        ], err.message);
        return Promise.reject();
      })
      .then(JSON.parse)
      .error(() => {
        digs.log(['digs-serial', 'serial-ports', 'warn'],
          'No USB ID vendor database found');
        return {};
      })
      .then(usbDb => {
        return list()
          .each(port => {
            const vendor = _.get(usbDb, port.vendorId);
            if (vendor) {
              port.vendor = vendor.name;
              const product = _.get(vendor.products, port.productId);
              if (product) {
                port.product = product;
              }
            }
          });
      })
      .tap(ports => {
        digs.log(['digs-serial', 'serial-ports'],
          `Found ${ports.length} ports`);
      })
      .nodeify(done);
  }

  return serialPorts;
};
