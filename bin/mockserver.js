#!/usr/bin/env node

var mockserver  = require('./../mockserver');
var argv        = require('yargs').argv;
var colors      = require('colors');
var info        = require('./../package.json');
var mocks       = argv.m || argv.mocks;
var port        = argv.p || argv.port;
var key         = argv.k || argv.key;
var cert        = argv.c || argv.cert;
var verbose     = !(argv.q || argv.quiet);

if (!mocks || !port) {
  console.log([
    "Mockserver v" + info.version,
    "",
    "Usage:",
    "  mockserver [-q] -p PORT -m PATH",
    "",
    "Options:",
    "  -k, --key=./ssl.key      - Path to SSL key",
    "  -c, --cert=./ssl.cert    - Path to SSL cert",
    "  -p, --port=PORT          - Port to listen on",
    "  -m, --mocks=PATH         - Path to mock files",
    "  -q, --quiet              - Do not output anything",
    "",
    "Example:",
    "  mockserver -p 8080 -m './mocks'"
  ].join("\n"));
} else {
  var isSSL = key && cert;
  if (isSSL) {
    var https = require('https');
    var fs = require('fs');
    var options = {
      key: fs.readFileSync(key),
      cert: fs.readFileSync(cert)
    };
    https.createServer(options, mockserver(mocks, verbose)).listen(port);
  } else {
    var http = require('http');
    http.createServer(mockserver(mocks, verbose)).listen(port);
  }

  if (verbose) {
    console.log('Mockserver serving mocks {'
      + 'verbose'.yellow + ':' + (verbose && 'true'.green || 'false')
      + '} under "' + mocks.green  + '" at '
      + (isSSL ? 'https' : 'http').green + '://localhost:'.green + port.toString().green);
  }
}
