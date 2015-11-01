'use strict';

/**
 * Expects a stream from package `split` and creates a JSON representation of
 * the USB ID database.  Its output is a key/value tuple to be consumed by
 * package `JSONStream`.
 *
 * We use this information to cross-reference the data provided by
 * `serialPort.list()`.
 */

const through2 = require('through2');

const VENDOR_REGEX = /^([a-f0-9]{4})\s+(.+)$/;
const PRODUCT_REGEX = /^\t([a-f0-9]{4})\s+(.+)$/;

const opts = {
  objectMode: true
};

module.exports =
  through2(opts, function transform(chunk, encoding, next) {
    const vendorMatch = String(chunk).match(VENDOR_REGEX);
    if (vendorMatch) {
      if (this.lastId) {
        this.push([this.lastId, this.lastVendor]);
      }
      this.lastVendor = {
        name: vendorMatch[2],
        products: {}
      };
      this.lastId = `0x${vendorMatch[1]}`;
    } else {
      const productMatch = String(chunk).match(PRODUCT_REGEX);
      if (productMatch) {
        this.lastVendor.products[`0x${productMatch[1]}`] = productMatch[2];
      }
    }
    next();
  }, function flush(next) {
    this.push([this.lastId, this.lastVendor]);
    next();
  });
