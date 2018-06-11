var fs = require('fs');
var path = require('path');
var join = path.join;
var Combinatorics = require('js-combinatorics');
var normalizeHeader = require('header-case-normalizer');
var colors = require('colors')

/**
 * Returns the status code out of the
 * first line of an HTTP response
 * (ie. HTTP/1.1 200 Ok)
 */
var parseStatus = function (header) {
    return header.split(' ')[1];
};

/**
 * Parses an HTTP header, splitting
 * by colon.
 */
var parseHeader = function (header) {
    header = header.split(': ');

    return {key: normalizeHeader(header[0]), value: parseValue(header[1])};
};

var parseValue = function(value) {
    if (/^#header/m.test(value)) {
        return value.replace(/^#header (.*);/m, function (statement, val) {
            var expression = val.replace(/[${}]/g, '');
            return eval(expression);
        }).replace(/\r\n?/g, '\n');
    }
    return value;
};

/**
 * Prepares headers to watch, no duplicates, non-blanks.
 * Priority exports over ENV definition.
 */
var prepareWatchedHeaders = function () {
    var exportHeaders = module.exports.headers && module.exports.headers.toString();
    var headers = (exportHeaders || process.env.MOCK_HEADERS || '').split(',');

    return headers.filter(function(item, pos, self) {
        return item && self.indexOf(item) == pos;
    });
}

/**
 * Parser the content of a mockfile
 * returning an HTTP-ish object with
 * status code, headers and body.
 */
var parse = function (content, file) {
    var headers         = {};
    var body;
    var bodyContent     = [];
    content             = content.split(/\r?\n/);
    var status          = parseStatus(content[0]);
    var headerEnd       = false;
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
                var header = parseHeader(line);
                headers[header.key] = header.value;
                break;
        }
    });

    body = bodyContent.join('\n');

    if (/^#import/m.test(body)) {
        var context = path.parse(file).dir + '/';

        body = body.replace(/^#import (.*);/m, function (includeStatement, file) {
            var importThisFile = file.replace(/['"]/g, '');
            var content = fs.readFileSync(path.join(context, importThisFile));
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
  var steps = removeBlanks(dir.split('/')),
      testPath,
      newPath,
      exists = false;

    while(steps.length) {
        steps.pop();
        testPath = join(steps.join('/'), '/__');
        exists = fs.existsSync(join(mockserver.directory, testPath));
        if(exists) { newPath = testPath; }
    }

    var res = getDirectoriesRecursive(mockserver.directory).filter(dir => {
            var directories = dir.split(path.sep)
            return directories.indexOf('__') >= 0
        }).sort((a, b) => {
            var aLength = a.split(path.sep)
            var bLength = b.split(path.sep)

            if (aLength == bLength)
                return 0

            // Order from longest file path to shortest.
            return aLength > bLength ? -1 : 1
        }).map(dir => {
            var steps = dir.split(path.sep)
            var baseDir = mockserver.directory.split(path.sep)
            steps.splice(0, baseDir.length)
            return steps.join(path.sep)
        })
    
    steps = removeBlanks(dir.split('/'))
    var length = steps.length
    for (var index = 0; index < length; index++) {
        var dupeSteps = removeBlanks(dir.split('/'))
        dupeSteps[index] = '__'
        var testPath = dupeSteps.join(path.sep)
        var matchFound =  res.indexOf(testPath) >= 0;
        if (matchFound) {
            newPath = testPath
            break
        }
    }

    return newPath;
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
    var nestedDirectories = getDirectories(srcpath).map(getDirectoriesRecursive);
    var directories = flattenDeep(nestedDirectories);
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
  var body = '';
  
  req.on('data', function(b){
    body = body + b.toString();
  });

  req.on('end', function() {    
    callback(body);
  });
}

function getMockedContent(path, prefix, body, query) {
    var mockName =  prefix + (getBodyOrQueryString(body, query) || '') + '.mock';
    var mockFile = join(mockserver.directory, path, mockName);
    var content;

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
    var content, prefix;

    while(permutations.length) {
        prefix = method + permutations.pop().join('');
        content = getMockedContent(path, prefix, body, query) || content;
    }

    return { content: content, prefix: prefix };
}

var mockserver = {
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
        var url = req.url;
        var path = url;

        var queryIndex = url.indexOf('?'),
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
        var matched,
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
            var mock = parse(matched.content, join(mockserver.directory, path, matched.prefix));
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
