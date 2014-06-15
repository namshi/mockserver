var assert = require("assert");
var mockserver = require("./../mockserver");

var res;
var req;
var mocksDirectory = './test/mocks';

describe('mockserver', function(){
    beforeEach(function() {
        res = {
            headers: null,
            status:  null,
            body:    null,
            writeHead: function(status, headers) {
                this.status  = status;
                this.headers = headers;
            },
            end: function(body) {
                this.body = body;
            }
        };

        req = {
            url:    null,
            method: null,
            headers: []
        }
    });
    describe('mockserver()', function(){
        it('should return a valid response', function(){
            req.url    = '/test';
            req.method = 'GET';
            mockserver(mocksDirectory)(req, res);

            assert.equal(res.body, 'Welcome!');
            assert.equal(res.status, 200);
            assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        }),
       it('should return 404 if the mock does not exist', function () {
           req.url    = '/not-there';
           req.method = 'GET';
           mockserver(mocksDirectory)({url: '/not-there', method: 'GET'}, res);

           assert.equal(res.body, 'Not Mocked');
           assert.equal(res.status, 404);
       }),
       it('should be able to handle trailing slashes without changing the name of the mockfile', function () {
           req.url    = '/test/';
           req.method = 'GET';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.body, 'Welcome!');
           assert.equal(res.status, 200);
           assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
       }),
       it('should be able to handle multiple headers', function () {
           req.url    = '/multiple-headers/';
           req.method = 'GET';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.status, 200);
           assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text/xml; charset=utf-8","Cache-Control":"public, max-age=300"}');
       }),
       it('should be able to handle status codes different than 200', function () {
           req.url    = '/return-204';
           req.method = 'GET';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.status, 204);
       }),
       it('should be able to handle HTTP methods other than GET', function () {
           req.url    = '/return-200';
           req.method = 'POST';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.status, 200);
       }),
       it('should be able to handle empty bodies', function () {
           req.url    = '/return-empty-body';
           req.method = 'GET';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.status, 204);
           assert.equal(res.body, '');
       }),
       it('should be able to support variations for a specific resource', function () {
           req.url    = '/test';
           req.method = 'GET';
           req.headers['mockserver-variation'] = 'failure';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.status, 500);
           assert.equal(res.body, 'Ouch!');
       }),
       it('should be able to correctly map /', function () {
           req.url    = '/';
           req.method = 'GET';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.body, 'homepage');
       }),
       it('should be able to map multi-level urls', function () {
           req.url    = '/test1/test2';
           req.method = 'GET';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.body, 'multi-level url');
       }),
       it('should be able to map multi-level urls with variation header', function () {
           req.url    = 'test1/test2';
           req.method = 'GET';
           req.headers['mockserver-variation'] = '400';
           mockserver(mocksDirectory)(req, res);

           assert.equal(res.status, 400);
           assert.equal(res.body, 'bad request');
       });
    })
});

