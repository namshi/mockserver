var fs = require('fs');
var join = require('path').join;
var Combinatorics = require('js-combinatorics').Combinatorics;

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

    return {key: header[0], value: header[1]};
};

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

    body = bodyContent.join('\n');

    return {status: status, headers: headers, body: body};
};

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
    
    try {
        return fs.readFileSync(mockFile, {encoding: 'utf8'});
    } catch(err) {
        return (body || query) && getMockedContent(path, prefix);
    }
}

var mockserver = {
    directory:       '.',
    use:             function(directory) {
        this.directory = directory;
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

        var watchedHeaders = module.exports.headers;
        if(watchedHeaders && !Array.isArray(watchedHeaders)) {
            watchedHeaders = [watchedHeaders];
        }
        if(req.headers && watchedHeaders && watchedHeaders.length) {
            watchedHeaders.forEach(function(header) {
                if(req.headers[header]) {
                    headers.push('_' + header + '=' + req.headers[header]);
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

module.exports = function(directory){
    mockserver.use(directory);

    return mockserver.handle;
};

module.exports.headers = [];
