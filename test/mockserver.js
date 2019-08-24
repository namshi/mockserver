const MockReq = require('mock-req');
const assert = require('assert');
const mockserver = require('./../mockserver');
const path = require('path');
const Monad = require('../monad');

let res;
let req;
const mocksDirectory = path.join('.', 'test', 'mocks');

const verbose = process.env.DEBUG === 'true' || false;

/**
 * Processes request
 */
function processRequest(url, method) {
  req.url = url;
  req.method = method;
  mockserver(mocksDirectory, verbose)(req, res);
}

/**
 * Processes request within custom ENV
 */
function processRequestEnv(url, method, envs) {
  let cleanupEnv = function() {};

  for (let name in envs) {
    if (envs.hasOwnProperty(name)) {
      process.env[name] = envs[name];

      cleanupEnv = (function(name, next) {
        return function() {
          delete process.env[name];
          next();
        };
      })(name, cleanupEnv);
    }
  }

  processRequest(url, method);

  cleanupEnv();
}

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
      },
    };

    req = {
      url: null,
      method: null,
      headers: [],
      on: function(event, cb) {
        if (event === 'end') {
          cb();
        }
      },
    };
  });

  describe('mockserver()', function() {
    it('should return a valid response', function() {
      processRequest('/test', 'GET');

      assert.equal(res.body, 'Welcome!');
      assert.equal(res.status, 200);
      assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
    });

    it('should return 404 if the mock does not exist', function() {
      processRequest('/not-there', 'GET');

      assert.equal(res.status, 404);
      assert.equal(res.body, 'Not Mocked');
    });

    it('should be able to handle trailing slashes without changing the name of the mockfile', function() {
      processRequest('/test/', 'GET');

      assert.equal(res.status, 200);
      assert.equal(res.body, 'Welcome!');
      assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
    });

    it('should be able to handle multiple headers', function() {
      processRequest('/multiple-headers/', 'GET');

      assert.equal(res.status, 200);
      assert.equal(
        JSON.stringify(res.headers),
        '{"Content-Type":"text/xml; charset=utf-8","Cache-Control":"public, max-age=300"}'
      );
    });

    it('should combine the identical headers names', function() {
      processRequest('/multiple-headers-same-name/', 'GET');
      
      assert.equal(res.headers['Set-Cookie'].length, 3);
    })

    it('should be able to handle status codes different than 200', function() {
      processRequest('/return-204', 'GET');

      assert.equal(res.status, 204);
    });

    it('should be able to handle HTTP methods other than GET', function() {
      processRequest('/return-200', 'POST');

      assert.equal(res.status, 200);
    });

    it('should be able to handle empty bodies', function() {
      processRequest('/return-empty-body', 'GET');

      assert.equal(res.status, 204);
      assert.equal(res.body, '');
    });

    it('should be able to correctly map /', function() {
      processRequest('/', 'GET');

      assert.equal(res.body, 'homepage');
    });

    it('should be able to map multi-level urls', function() {
      processRequest('/test1/test2', 'GET');

      assert.equal(res.body, 'multi-level url');
    });

    it('should be able to handle GET parameters', function() {
      processRequest('/test?a=b', 'GET');

      assert.equal(res.status, 200);
    });

    it('should default to GET.mock if no matching parameter file is found', function() {
      processRequest('/test?a=c', 'GET');

      assert.equal(res.status, 200);
    });

    it('should be able track custom headers', function() {
      mockserver.headers = ['authorization'];

      processRequest('/request-headers', 'GET');
      assert.equal(res.status, 401);
      assert.equal(res.body, 'not authorized');

      req.headers['authorization'] = '1234';
      processRequest('/request-headers', 'GET');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'authorized');

      req.headers['authorization'] = '5678';
      processRequest('/request-headers', 'GET');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'admin authorized');
    });

    it('should attempt to fall back to a base method if a custom header is not found in a file', function() {
      mockserver.headers = ['authorization'];

      req.headers['authorization'] = 'invalid';
      processRequest('/request-headers', 'GET');
      assert.equal(res.status, 401);
      assert.equal(res.body, 'not authorized');

      req.headers['authorization'] = 'invalid';
      processRequest('/request-headers', 'POST');
      assert.equal(res.status, 404);
      assert.equal(res.body, 'Not Mocked');
    });

    it('should look for alternate combinations of headers if a custom header is not found', function() {
      mockserver.headers = ['authorization', 'x-foo'];

      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header both');

      req.headers['x-foo'] = 'Baz';
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header auth only');

      req.headers['authorization'] = 78;
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header both out-of-order');

      req.headers['authorization'] = 45;
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header x-foo only');

      delete req.headers['authorization'];
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header x-foo only');
    });

    it('should be able track custom headers with variation and query params', function() {
      mockserver.headers = ['authorization', 'x-foo'];
      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';
      processRequest('/request-headers?a=b', 'POST');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'that is a long filename');
    });

    it('should be able track custom string headers with variation and query params', function() {
      mockserver.headers = 'authorization,x-foo';

      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';

      processRequest('/request-headers?a=b', 'POST');

      assert.equal(res.status, 200);
      assert.equal(res.body, 'that is a long filename');
    });

    it('should be able track custom ENV headers with variation and query params', function() {
      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';

      processRequestEnv('/request-headers?a=b', 'POST', {
        MOCK_HEADERS: 'authorization,x-foo',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body, 'that is a long filename');
    });

    it('should keep line feeds (U+000A)', function() {
      processRequest('/keep-line-feeds', 'GET');

      assert.equal(
        res.body,
        'ColumnA	ColumnB	ColumnC\n' + 'A1	B1	C1\n' + 'A2	B2	C2\n' + 'A3	B3	C3\n'
      );
      assert.equal(res.status, 200);
      assert.equal(
        JSON.stringify(res.headers),
        '{"Content-Type":"text/plain; charset=utf-8"}'
      );
    });

    it('should be able to include POST bodies in the mock location', function(done) {
      const req = new MockReq({
        method: 'POST',
        url: '/return-200',
        headers: {
          Accept: 'text/plain',
        },
      });
      req.write('Hello=123');
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.body, 'Hella');
        assert.equal(res.status, 200);
        done();
      });
    });

    it('Should default to POST.mock if no match for body is found', function(done) {
      const req = new MockReq({
        method: 'POST',
        url: '/return-200',
        headers: {
          Accept: 'text/plain',
        },
      });
      req.write('Hello=456');
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.status, 200);
        done();
      });
    });

    it('Should return 404 when no default .mock files are found', function() {
      mockserver.headers = ['authorization'];
      req.headers['authorization'] = 12;
      processRequest('/return-200?a=c', 'GET');

      assert.equal(res.status, 404);
    });

    it('should be able to handle imports', function() {
      processRequest('/import', 'GET');

      assert.equal(res.status, 200);
      assert.equal(res.body, JSON.stringify({ foo: 'bar' }, null, 4));
    });

    it('should be able to handle eval', function() {
      processRequest('/eval', 'GET');

      assert.equal(res.status, 200);
      assert.deepEqual(JSON.parse(res.body), { foo: 'bar' });
    });

    it('should be able to handle imports with content around import', function() {
      processRequest('/import?around=true', 'GET');

      assert.equal(res.status, 200);
      assert.equal(
        res.body,
        'stuff\n' + JSON.stringify({ foo: 'bar' }, null, 4) + '\naround me'
      );
    });

    it('should be able to handle imports with js scripts', function() {
      processRequest('/importjs', 'GET');
      assert.equal(res.status, 200);
      assert.ok(Date.parse(JSON.parse(res.body).date));
    });

    it('should be able to handle imports with js scripts varying responses according to the the request - 1', function(done) {
      var req = new MockReq({
        method: 'POST',
        url: '/importjs',
        headers: {},
      });
      req.write(JSON.stringify({ foo: '123' }));
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(JSON.parse(res.body).prop, 'bar');
        done();
      });
    });

    it('should be able to handle imports with js scripts varying responses according to the the request - 2', function(done) {
      var req = new MockReq({
        method: 'POST',
        url: '/importjs',
        headers: {},
      });
      req.write(JSON.stringify({ boo: '123' }));
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(JSON.parse(res.body).prop, 'baz');
        done();
      });
    });

    it('should be able to handle dynamic header values', function() {
      processRequest('/dynamic-headers', 'GET');
      assert.equal(res.status, 200);
      assert.ok(Date.parse(res.headers['X-Subject-Token']));
      assert.equal(res.body, 'dynamic headers\n');
    });

    describe('wildcard directories', function() {
      it('wildcard matches directories named __ with numeric slug', function() {
        processRequest('/wildcard/123', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'this always comes up\n');
      });

      it('wildcard matches directories named __ with string slug', function() {
        processRequest('/wildcard/abc', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'this always comes up\n');
      });

      it('wildcard matches directories named foo/__/bar with numeric slug', function() {
        processRequest('/wildcard-extended/123/foobar', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'wildcards-extended');
      });

      it('wildcard matches directories named foo/__/bar with string slug', function() {
        processRequest('/wildcard-extended/abc/foobar', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'wildcards-extended');
      });

      it('wildcard matches directories named foo/__/bar/__/fizz', function() {
        processRequest('/wildcard-extended/abc/foobar/def/fizzbuzz', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'wildcards-extended-multiple');
      });

      it('__ not used if more specific match exist', function() {
        processRequest('/wildcard/exact', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'more specific\n');
      });

      it('should not resolve with missing slug', function() {
        processRequest('/wildcard/', 'GET');

        assert.equal(res.status, 404);
      });
    });
    describe('.getResponseDelay', function() {
      it('should return a value greater than zero when valid', function() {
        const ownValueHeaders = [
          { 'Response-Delay': 1 },
          { 'Response-Delay': 99 },
          { 'Response-Delay': '9999' },
        ];
        ownValueHeaders.forEach(function(header) {
          const val = mockserver.getResponseDelay(header);
          assert(val > 0, `Value found was ${val}`);
        });
      });
      it('should return zero for invalid values', function() {
        const zeroValueHeaders = [
          { 'Response-Delay': 'a' },
          { 'Response-Delay': '' },
          { 'Response-Delay': '-1' },
          { 'Response-Delay': -1 },
          { 'Response-Delay': 0 },
          {},
          null,
          undefined,
        ];
        zeroValueHeaders.forEach(function(header) {
          const val = mockserver.getResponseDelay(header);
          assert.equal(val, 0, `Value found was ${val}`);
        });
      });
    });
    describe('Custom response codes', function() {
        it('response status codes depends on request case 400 Bad request', function (done) {
          var req = new MockReq({
              method: 'POST',
              url: '/headerimportjs',
              headers: {},
          });
          req.write(JSON.stringify({ baz: '123' }));
          req.end();

          mockserver(mocksDirectory, verbose)(req, res);

          req.on('end', function () {
              assert.equal(res.status, '400');
              done();
          });
      });
      it('response status codes depends on request case 200 OK', function (done) {
          var req = new MockReq({
              method: 'POST',
              url: '/headerimportjs',
              headers: {},
          });
          req.write(JSON.stringify({ foo: '123' }));
          req.end();

          mockserver(mocksDirectory, verbose)(req, res);

          req.on('end', function () {
              assert.equal(res.status, '200');
              done();
          });
      });
    })
  });
});

describe('Monad methods', function() {
    let m;
    function fn(val) {
        return {
            ...val,
            b: 2
        };
    }
    const testData = { a: 1 };
    const expectData = { a: 1, b: 2 };
    beforeEach(function() {
        m = Monad.of(testData);
    });

    it('Monad have static method `of`', function() {
        assert.equal(typeof Monad.of, 'function');
    });
    it('Monad method `of` should return Object type Monad', function() {
        assert.equal(m instanceof Monad, true);
    });
    it('Monad method `map` should recive value and return Object type Monad', function() {
        assert.equal(m.map(fn) instanceof Monad, true);
    });
    it('Monad method `join` should return value', function () {
        assert.strictEqual(m.join(), testData);
    });
    it('Monad method `chain` should return value', function () {
        assert.deepEqual(m.chain(fn), expectData);
    });
});
