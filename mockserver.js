var fs = require('fs');
var join = require('path').join;
var Combinatorics = require('js-combinatorics');
var normalizeHeader = require('header-case-normalizer');
var moment = require('moment');

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

    return {key: normalizeHeader(header[0]), value: header[1]};
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
var parse = function (content) {
    var headers         = {};
    var body;
    var bodyContent     = [];
    content             = content.split('\n');
    var status          = parseStatus(content[0]);
    var headerEnd       = false;
    delete content[0];

    content.forEach(function(line) {
        if (headerEnd) {
            bodyContent.push(line);
        } else if (line === '' || line === '\r') {
            headerEnd = true;
        } else {
            var header = parseHeader(line);
            headers[header.key] = header.value;
        }
    });

    body = applyHooks(bodyContent).join('\n');

    return {status: status, headers: headers, body: body};
};
/**
 * A collection of dynamic hooks that can be called from the mock
 * 
 * eg. {"timestamp": {% time('-10d') %} }
 * 
 * will be served as {"timestamp": 1460555016071 }
 * 
 */
var dynamicHooks = {
    /**
     *
     * @param diff - Time difference to apply to current timestamp.
     * May start with `-`, followed by amount you want to add/subtract,
     * ended with unit name. Eg. `'-10 days'.
     * See [momentjs documentation](http://momentjs.com/docs/#/manipulating/add/) for supported units.
     * 
     * @returns Modified timestamp
     */
    time: function(diff){
        var now     = moment();
        var matches = diff.match(/-|[a-zA-Z]+|[-0-9]+/g);
        var method  = 'add';

        if(matches[0] === '-') {
            matches.shift();
            method = 'subtract';
        }

        return now[method].apply(now, matches).valueOf();
    }
};

/**
 * Look for hooks in the body
 */
function applyHooks(bodyContentArray) {
    return bodyContentArray.map(function(line) {
        if(line.indexOf('{%') >= 0) {
            return applyHook(line);

        } else {
            return line;
        }
    });
}
/**
 * Parse hook's name and arguments
 */
function applyHook(line) {
    try {
        var hookCall = line.match(/{%(.*)%}/)[1].trim();
        var hookName = hookCall.match(/\w+/)[0];
        var hookArgs = hookCall.match(/\((.*)\)/).splice(1);
        var replacement = dynamicHooks[hookName].apply(null, hookArgs);

        return line.replace(/{%(.*)%}/, replacement);

    } catch(e) {
        console.log('*** applyHooks err', e)
        return line;
    }

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
        var content,
            permutations = [[]];

        if(headers.length) {
            permutations = Combinatorics.permutationCombination(headers).toArray().sort(function(a, b) { return b.length - a.length; });
            permutations.push([]);
        }

        while(permutations.length) {
            var prefix = method + permutations.pop().join('');
            content = getMockedContent(path, prefix, body, query) || content;
        }

        if(content) {
            var mock = parse(content);
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
