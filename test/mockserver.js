var MockReq = require('mock-req');
var assert = require("assert");
var mockserver = require("./../mockserver");

var res;
var req;
var mocksDirectory = './test/mocks';

describe('mockserver', function() {
    beforeEach(function() {
        mockserver.headers = [];

        res = {
            headers: null,
            status: null,
            body: null,
            writeHead: function(status, headers) {
                this.status = status;
                this.headers = headers;
            },
            end: function(body) {
                this.body = body;
            }
        };

        req = {
            url: null,
            method: null,
            headers: [],
            on: function(event, cb) {
              if (event === 'end') {
                cb();
              }
            }
        };
    });

    function process(url, method) {
        req.url = url;
        req.method = method;
        mockserver(mocksDirectory)(req, res);
    }

    describe('mockserver()', function() {

        it('should return a valid response', function() {
            process('/test', 'GET');

            assert.equal(res.body, 'Welcome!');
            assert.equal(res.status, 200);
            assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        });

        it('should return 404 if the mock does not exist', function() {
            process('/not-there', 'GET');

            assert.equal(res.status, 404);
            assert.equal(res.body, 'Not Mocked');
        });

        it('should be able to handle trailing slashes without changing the name of the mockfile', function() {
            process('/test/', 'GET');

            assert.equal(res.status, 200);
            assert.equal(res.body, 'Welcome!');
            assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        });

        it('should be able to handle multiple headers', function() {
            process('/multiple-headers/', 'GET');

            assert.equal(res.status, 200);
            assert.equal(JSON.stringify(res.headers),
                '{"Content-Type":"text/xml; charset=utf-8","Cache-Control":"public, max-age=300"}');
        });

        it('should be able to handle status codes different than 200', function() {
            process('/return-204', 'GET');

            assert.equal(res.status, 204);
        });

        it('should be able to handle HTTP methods other than GET', function() {
            process('/return-200', 'POST');

            assert.equal(res.status, 200);
        });

        it('should be able to handle empty bodies', function() {
            process('/return-empty-body', 'GET');

            assert.equal(res.status, 204);
            assert.equal(res.body, '');
        });

        it('should be able to correctly map /', function() {
            process('/', 'GET');

            assert.equal(res.body, 'homepage');
        });

        it('should be able to map multi-level urls', function() {
            process('/test1/test2', 'GET');

            assert.equal(res.body, 'multi-level url');
        });

        it('should be able to handle GET parameters', function() {
            process('/test?a=b', 'GET');

            assert.equal(res.status, 200);
        });

        it('should default to GET.mock if no matching parameter file is found', function() {
            process('/test?a=c', 'GET');

            assert.equal(res.status, 200);
        });

        it('should be able track custom headers', function() {
            mockserver.headers = ['Authorization'];

            process('/request-headers', 'GET');
            assert.equal(res.status, 401);
            assert.equal(res.body, 'not authorized');

            req.headers['Authorization'] = '1234';
            process('/request-headers', 'GET');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'authorized');

            req.headers['Authorization'] = '5678';
            process('/request-headers', 'GET');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'admin authorized');
        });

        it('should attempt to fall back to a base method if a custom header is not found in a file', function() {
            mockserver.headers = ['Authorization'];

            req.headers['Authorization'] = 'invalid';
            process('/request-headers', 'GET');
            assert.equal(res.status, 401);
            assert.equal(res.body, 'not authorized');

            req.headers['Authorization'] = 'invalid';
            process('/request-headers', 'POST');
            assert.equal(res.status, 404);
            assert.equal(res.body, 'Not Mocked');
        });

        it('should look for alternate combinations of headers if a custom header is not found', function() {
            mockserver.headers = ['Authorization', 'X-Foo'];

            req.headers['Authorization'] = 12;
            req.headers['X-Foo'] = 'Bar';
            process('/request-headers', 'PUT');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'header both');

            req.headers['X-Foo'] = 'Baz';
            process('/request-headers', 'PUT');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'header auth only');

            req.headers['Authorization'] = 78;
            process('/request-headers', 'PUT');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'header both out-of-order');

            req.headers['Authorization'] = 45;
            process('/request-headers', 'PUT');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'header x-foo only');

            delete req.headers['Authorization'];
            process('/request-headers', 'PUT');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'header x-foo only');
        });

        it('should be able track custom headers with variation and query params', function() {
            mockserver.headers = ['Authorization', 'X-Foo'];
            req.headers['Authorization'] = 12;
            req.headers['X-Foo'] = 'Bar';
            process('/request-headers?a=b', 'POST');
            assert.equal(res.status, 200);
            assert.equal(res.body, 'that is a long filename');
        });

        it('should keep line feeds (U+000A)', function() {
            process('/keep-line-feeds', 'GET');

            assert.equal(res.body, 
                'ColumnA	ColumnB	ColumnC\n' +
                'A1	B1	C1\n' +
                'A2	B2	C2\n' +
                'A3	B3	C3\n'
              );
            assert.equal(res.status, 200);
            assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text/plain; charset=utf-8"}');
        });

        it('should be able to include POST bodies in the mock location', function(done) {
            var req = new MockReq({
                method: 'POST',
                url: '/return-200',
                headers: {
                    'Accept': 'text/plain'
                }
            });
            req.write('Hello=123');
            req.end();
            
            mockserver(mocksDirectory)(req, res);
            
            req.on('end', function() {
              assert.equal(res.body, 'Hella');
              assert.equal(res.status, 200);
              done();
            });
        });

        it('should be able to include POST json in the mock location', function(done) {
            var req = new MockReq({
                method: 'POST',
                url: '/return-200',
                headers: {
                    'Accept': 'tapplication/json'
                }
            });
            req.write('{"json": "yesPlease"}');
            req.end();
            
            mockserver(mocksDirectory)(req, res);
            
            req.on('end', function() {
              var jsonBody = JSON.parse(res.body);
              
              assert.equal(jsonBody.json, 'yes, we haZ it');
              assert.equal(res.status, 200);
              done();
            });
        });

        it('Should default to POST.mock if no match for body is found', function(done) {
            var req = new MockReq({
                method: 'POST',
                url: '/return-200',
                headers: {
                    'Accept': 'text/plain'
                }
            });
            req.write('Hello=456');
            req.end();
            
            mockserver(mocksDirectory)(req, res);
            
            req.on('end', function() {
              assert.equal(res.status, 200);
              done();
            });
        });

        it('Should return 404 when no default .mock files are found', function() {
            mockserver.headers = ['Authorization'];
            req.headers['Authorization'] = 12;
            process('/return-200?a=c', 'GET');

            assert.equal(res.status, 404);
        });
    });
});
