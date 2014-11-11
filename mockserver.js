var fs = require('fs');
var join = require('path').join;
var Combinatorics = require('js-combinatorics').Combinatorics;

var parseStatus = function (header) {
    return header.split(' ')[1];
};

var parseHeader = function (header) {
    header = header.split(': ');

    return {key: header[0], value: header[1]};
};

var parse = function (content) {
    var headers   = {};
    var body      = '';
    content       = content.split('\n');
    var status    = parseStatus(content[0]);
    var headerEnd = false;
    delete content[0];

    content.forEach(function(line) {
        if (headerEnd) {
            body = body + line;
        } else if (line === '' || line === '\r') {
            headerEnd = true;
        } else {
            var header = parseHeader(line);
            headers[header.key] = header.value;
        }
    });

    return {status: status, headers: headers, body: body};
};

var mockserver = {
    directory:       ".",
    use:             function(directory) {
        this.directory = directory;
    },
    handle:          function(req, res) {
        var url = req.url;
        var path = url;

        var queryIndex = url.indexOf('?'),
            query = queryIndex >= 0 ? url.substring(queryIndex).replace(/\?/g, '--') : '',
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
            permutations = Combinatorics.permutationCombination(headers).toArray().sort(function(a, b) {return b.length - a.length});
            permutations.push([]);
        }
        while(permutations.length) {
            var mockName =  method + permutations.pop().join('') + query + '.mock';
            var mockFile = join(mockserver.directory, path, mockName);
            if(fs.existsSync(mockFile)) {
                try {
                    content = fs.readFileSync(mockFile, {encoding: 'utf8'});
                } catch(err) {
                    // ignore file read errors, maybe we matched something by accident
                }
            }
        }


        if(content) {
            var mock = parse(content);
            res.writeHead(mock.status, mock.headers);

            return res.end(mock.body);
        } else {
            res.writeHead(404);
            res.end('Not Mocked');
        }
    }
};

module.exports = function(directory){
    mockserver.use(directory);

    return mockserver.handle;
};

module.exports.headers = [];