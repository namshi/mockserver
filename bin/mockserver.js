#!/usr/bin/env node

const http = require('http');
const mockserver = require('./../mockserver');
const argv = require('yargs').argv;
const colors = require('colors');
const info = require('./../package.json');
const mocks = argv.m || argv.mocks;
const port = argv.p || argv.port;
const verbose = !(argv.q || argv.quiet);

if (!mocks || !port) {
	console.log(
		[
			'Mockserver v' + info.version,
			'',
			'Usage:',
			'  mockserver [-q] -p PORT -m PATH',
			'',
			'Options:',
			'  -p, --port=PORT    - Port to listen on',
			'  -m, --mocks=PATH   - Path to mock files',
			'  -q, --quiet        - Do not output anything',
			'',
			'Example:',
			"  mockserver -p 8080 -m './mocks'"
		].join('\n')
	);
} else {
	http.createServer(mockserver(mocks, verbose)).listen(port);

	if (verbose) {
		console.log(
			'Mockserver serving mocks {' +
				'verbose'.yellow +
				':' +
				((verbose && 'true'.green) || 'false') +
				'} under "' +
				mocks.green +
				'" at ' +
				'http://localhost:'.green +
				port.toString().green
		);
	}
}
