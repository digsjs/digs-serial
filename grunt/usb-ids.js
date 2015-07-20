'use strict';

module.exports = function(grunt) {

  grunt.registerTask('usbIds',
    'Download, parse and reformat the USB vendor/product ID database',
    function() {

      let http = require('http');
      let JSONStream = require('JSONStream');
      let split = require('split');
      let usbIdsTransformStream = require('./lib/usb-ids-transform-stream');
      let mkdirp = require('mkdirp');
      let ProgressBar = require('progress');
      let fs = require('fs');
      let path = require('path');
      let zlib = require('zlib');

      const URL = 'http://www.linux-usb.org/usb.ids.gz';
      const FILENAME = 'usb-ids.json';
      const DIR = path.join(__dirname, '..', 'data');

      let done = this.async();

      try {
        fs.statSync(path.join(DIR, FILENAME));
        grunt.log.ok('USB vendor ID database already present; skipping');
        if (this.flags.force) {
          grunt.log.ok('"force" enabled; downloading anyway');
        } else {
          return done();
        }
      } catch (ignored) {
        // ignored
      }

      grunt.log.ok('Fetching USB ID database...');

      mkdirp.sync(DIR);

      http.get(URL, function(res) {
        if (res.statusCode !== '200') {
          let len = parseInt(res.headers['content-length'], 10);
          let bar = new ProgressBar('  downloading [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: len
          });

          res.on('data', function(chunk) {
            bar.tick(chunk.length);
          })
            .on('error', function(err) {
              grunt.log.error('WARNING: ' + err.message);
            })
            .pipe(zlib.createGunzip())
            .pipe(split(/\n/))
            .pipe(usbIdsTransformStream)
            .pipe(JSONStream.stringifyObject('{\n', ',\n', '\n}\n', 2))
            .pipe(fs.createWriteStream(path.join(DIR, FILENAME)), {
              encoding: 'utf-8'
            })
            .on('end', function() {
              grunt.log.ok('Done');
              done();
            });
        }
        else {
          grunt.log.error(`WARNING: Could not download USB ID database; ` +
            `received code ${res.statusCode}`);
          if (res.statusMessage) {
            grunt.log.error('Status message: %s', res.statusMessage);
          }
        }
      });

    });

};
