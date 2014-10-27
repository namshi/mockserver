var fs = require('fs');
var join = require('path').join;

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
    variationHeader: "mockserver-variation",
    directory:       ".",
    use:             function(directory) {
        this.directory = directory;
    },
    handle:          function(req, res) {
        var url = req.url;
        var path = url;

        var queryIndex = url.indexOf('?'),
            query = queryIndex >= 0 ? url.substring(queryIndex).replace(/\?/g, '--') : '',
            method = req.method.toUpperCase();

        if (queryIndex > 0) {
            path = url.substring(0, queryIndex);
        }

        if (req.headers && req.headers[mockserver.variationHeader]) {
            method += '_' + req.headers[mockserver.variationHeader];
        }

        var mockName =  method + query + '.mock';
        var mockFile = join(mockserver.directory, path, mockName);

        try {
            var content = fs.readFileSync(mockFile, {encoding: 'utf8'});
            var mock = parse(content);
            res.writeHead(mock.status, mock.headers);

            return res.end(mock.body);
        } catch (err) {
            res.writeHead(404);
            res.end('Not Mocked');
        }
    }
};

module.exports = function(directory){
    mockserver.use(directory);

    return mockserver.handle;
};