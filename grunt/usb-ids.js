'use strict';

const http = require('http');
const JSONStream = require('JSONStream');
const split = require('split');
const usbIdsTransformStream = require('../lib/usb-ids-transform-stream');
const common = require('digs-common');
const fs = common.fs;
const request = require('request');
const mkdirp = fs.mkdirp;
const ProgressBar = require('progress');
const path = require('path');
const zlib = require('zlib');
const _ = common.utils;

const url = 'http://www.linux-usb.org/usb.ids.gz';
const outputFilename = 'usb-ids.json';
const outputDirpath = path.join(__dirname, '..', 'data');
const outputFilepath = path.join(outputDirpath, outputFilename);

module.exports = function usbIds(grunt) {
  function fetch() {
    grunt.log.ok('Fetching USB ID database...');

    return mkdirp(outputDirpath)
      .then(() => {
        return new Promise((resolve, reject) => {
          let bar;

          request.get(url)
            .on('response', response => {
              bar = new ProgressBar('  downloading [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: _.parseInt(response.headers['content-length'])
              });
            })
            .on('data', chunk => {
              bar.tick(chunk.length);
            })
            .on('end', () => {
              grunt.log.ok('Done');
              resolve();
            })
            .on('error', reject)
            .pipe(zlib.createGunzip())
            .pipe(split(/\n/))
            .pipe(usbIdsTransformStream)
            .pipe(JSONStream.stringifyObject('{\n', ',\n', '\n}\n', 2))
            .pipe(fs.createWriteStream(outputFilepath), {
              encoding: 'utf-8'
            });
        });
      });
  }

  grunt.registerTask('usbIds',
    'Download, parse and format the USB vendor/product ID database',
    function usbIdsTask() {
      const done = this.async();

      fs.statAsync(outputFilepath)
        .then(() => {
          if (grunt.option('force')) {
            grunt.log.ok('"force" enabled; downloading anyway');
            return fetch();
          }
          grunt.log.ok('USB vendor ID database already present; skipping');
        }, fetch)
        .then(done, done);
    });
};
