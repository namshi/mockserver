var fs = require('fs');

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
        } else if (line === '') {
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
        var url = req.url === '/' ? 'homepage' : req.url;

        if (url.charAt(0) === '/') {
            url = req.url.substr(1);
        }

        if (url.charAt(url.length - 1) === '/') {
            url = url.substr(0, url.length - 1);
        }

        var mockName = url + '_' + req.method.toUpperCase();

        if (req.headers && req.headers[mockserver.variationHeader]) {
            mockName += '_' + req.headers[mockserver.variationHeader];
        }

        try {
            var content = fs.readFileSync(mockserver.directory + '/' + mockName + '.mock', {encoding: 'utf8'});
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