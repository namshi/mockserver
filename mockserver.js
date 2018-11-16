const fs = require('fs');
const path = require('path');
const colors = require('colors');
const join = path.join;
const Combinatorics = require('js-combinatorics');
const normalizeHeader = require('header-case-normalizer');

/**
 * Returns the status code out of the
 * first line of an HTTP response
 * (ie. HTTP/1.1 200 Ok)
 */
function parseStatus(header) {
    return header.split(' ')[1];
};

/**
 * Parses an HTTP header, splitting
 * by colon.
 */
const parseHeader = function (header) {
    header = header.split(': ');

    return {key: normalizeHeader(header[0]), value: parseValue(header[1])};
};

const parseValue = function(value) {
    if (/^#header/m.test(value)) {
        return value.replace(/^#header (.*);/m, function (statement, val) {
            const expression = val.replace(/[${}]/g, '');
            return eval(expression);
        }).replace(/\r\n?/g, '\n');
    }
    return value;
};

/**
 * Prepares headers to watch, no duplicates, non-blanks.
 * Priority exports over ENV definition.
 */
const prepareWatchedHeaders = function () {
    const exportHeaders = module.exports.headers && module.exports.headers.toString();
    const headers = (exportHeaders || process.env.MOCK_HEADERS || '').split(',');

    return headers.filter(function(item, pos, self) {
        return item && self.indexOf(item) == pos;
    });
}

/**
 * Parser the content of a mockfile
 * returning an HTTP-ish object with
 * status code, headers and body.
 */
const parse = function (content, file, request) {
    const headers         = {};
    let body;
    const bodyContent     = [];
    content             = content.split(/\r?\n/);
    const status          = parseStatus(content[0]);
    let headerEnd       = false;
    delete content[0];

    content.forEach(function (line) {
        switch (true) {
            case headerEnd:
                bodyContent.push(line);
                break;
            case (line === '' || line === '\r'):
                headerEnd = true;
                break;
            default:
                const header = parseHeader(line);
                headers[header.key] = header.value;
                break;
        }
    });

    body = bodyContent.join('\n');

    if (/^#import/m.test(body)) {
        const context = path.parse(file).dir + '/';

        body = body.replace(/^#import (.*);/m, function (includeStatement, file) {
            const importThisFile = file.replace(/['"]/g, '');
            const content = fs.readFileSync(path.join(context, importThisFile));
            if (importThisFile.endsWith(".js")) {
                return JSON.stringify(eval(content.toString()));
            } else {
                return content;
            }
        })
        .replace(/\r\n?/g, '\n');
    }

    return {status: status, headers: headers, body: body};
};

function removeBlanks(array) {
  return array.filter(function (i) { return i; });
}

function getWildcardPath(dir) {
  let steps = removeBlanks(dir.split('/'));
  let testPath;
  let newPath;
  let exists = false;

    while(steps.length) {
        steps.pop();
        testPath = join(steps.join('/'), '/__');
        exists = fs.existsSync(join(mockserver.directory, testPath));
        if(exists) { newPath = testPath; }
    }

    const res = getDirectoriesRecursive(mockserver.directory).filter(dir => {
            const directories = dir.split(path.sep);
            return directories.includes('__');
        }).sort((a, b) => {
            const aLength = a.split(path.sep)
            const bLength = b.split(path.sep)

            if (aLength == bLength)
                return 0

            // Order from longest file path to shortest.
            return aLength > bLength ? -1 : 1
        }).map(dir => {
            const steps = dir.split(path.sep)
            const baseDir = mockserver.directory.split(path.sep)
            steps.splice(0, baseDir.length)
            return steps.join(path.sep)
        })
    
    steps = removeBlanks(dir.split('/'))

    newPath = matchWildcardPaths(res, steps) || newPath;

    return newPath;
}

function matchWildcardPaths(res, steps) {
    for (let resIndex = 0; resIndex < res.length; resIndex++) {
        const dirSteps = res[resIndex].split(/\/|\\/);
        if (dirSteps.length !== steps.length) { continue; }
        const result = matchWildcardPath(steps, dirSteps);
        if (result) { return result; }
    }
    return null;
}

function matchWildcardPath(steps, dirSteps) {
    for (let stepIndex = 1; stepIndex <= steps.length; stepIndex++) {
        const step = steps[steps.length - stepIndex];
        const dirStep = dirSteps[dirSteps.length - stepIndex];
        if (step !== dirStep && dirStep != '__') {
            return null;
        }
    }
    return '/' + dirSteps.join('/');
}

function flattenDeep(directories){
    return directories.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
 }

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath)
        .map(file => path.join(srcpath, file))
        .filter(path => fs.statSync(path).isDirectory());
}

function getDirectoriesRecursive(srcpath) {
    const nestedDirectories = getDirectories(srcpath).map(getDirectoriesRecursive);
    const directories = flattenDeep(nestedDirectories);
    directories.push(srcpath)
    return directories;
}

/**
 * Returns the body or query string to be used in
 * the mock name.
 * 
 * In any case we will prepend the value with a double
 * dash so that the mock files will look like:
 * 
 * POST--My-Body=123.mock
 * 
 * or
 * 
 * GET--query=string&hello=hella.mock
 */
function getBodyOrQueryString(body, query) {
  if (query) {
    return '--' + query;
  }
  
  if (body && body !== '') {
    return '--' + body;
  }
  
  return body;
}

/**
 * Ghetto way to get the body
 * out of the request.
 * 
 * There are definitely better
 * ways to do this (ie. npm/body
 * or npm/body-parser) but for
 * the time being this does it's work
 * (ie. we don't need to support
 * fancy body parsing in mockserver
 * for now).
 */
function getBody(req, callback) {
  let body = '';
  
  req.on('data', function(b){
    body = body + b.toString();
  });

  req.on('end', function() {    
    callback(body);
  });
}

function getMockedContent(path, prefix, body, query) {
    const mockName =  prefix + (getBodyOrQueryString(body, query) || '') + '.mock';
    const mockFile = join(mockserver.directory, path, mockName);
    let content;

    try {
        content = fs.readFileSync(mockFile, {encoding: 'utf8'});
        if (mockserver.verbose) {
            console.log('Reading from '+ mockFile.yellow +' file: ' + 'Matched'.green);
        }
    } catch(err) {
        if (mockserver.verbose) {
            console.log('Reading from '+ mockFile.yellow +' file: ' + 'Not matched'.red);
        }
        content = (body || query) && getMockedContent(path, prefix);
    }

    return content;
}

function getContentFromPermutations(path, method, body, query, permutations) {
    let content, prefix;

    while(permutations.length) {
        prefix = method + permutations.pop().join('');
        content = getMockedContent(path, prefix, body, query) || content;
    }

    return { content: content, prefix: prefix };
}

const mockserver = {
    directory:       '.',
    verbose:         false,
    headers:         [],
    init:            function(directory, verbose) {
        this.directory = directory;
        this.verbose   = !!verbose;
        this.headers   = prepareWatchedHeaders();
    },
    handle:          function(req, res) {
      getBody(req, function(body) {
        req.body = body;
        const url = req.url;
        let path = url;

        const queryIndex = url.indexOf('?'),
            query = queryIndex >= 0 ? url.substring(queryIndex).replace(/\?/g, '') : '',
            method = req.method.toUpperCase(),
            headers = [];

        if (queryIndex > 0) {
            path = url.substring(0, queryIndex);
        }

        if(req.headers && mockserver.headers.length) {
            mockserver.headers.forEach(function(header) {
                header = header.toLowerCase();
                if(req.headers[header]) {
                    headers.push('_' + normalizeHeader(header) + '=' + req.headers[header]);
                }
            });
        }

        // Now, permute the possible headers, and look for any matching files, prioritizing on
        // both # of headers and the original header order
        let matched,
            permutations = [[]];

        if(headers.length) {
            permutations = Combinatorics.permutationCombination(headers).toArray().sort(function(a, b) { return b.length - a.length; });
            permutations.push([]);
        }

        matched = getContentFromPermutations(path, method, body, query, permutations.slice(0));

        if(!matched.content && (path = getWildcardPath(path))) {
            matched = getContentFromPermutations(path, method, body, query, permutations.slice(0));
        }

        if(matched.content) {
            const mock = parse(matched.content, join(mockserver.directory, path, matched.prefix), req);
            res.writeHead(mock.status, mock.headers);

            return res.end(mock.body);
        } else {
            res.writeHead(404);
            res.end('Not Mocked');
        }
      });
    }
};

module.exports = function(directory, silent) {
    mockserver.init(directory, silent);

    return mockserver.handle;
};

module.exports.headers = null;
