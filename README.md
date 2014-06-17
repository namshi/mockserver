# mockserver

[![Build Status](https://travis-ci.org/namshi/mockserver.svg?branch=master)](https://travis-ci.org/namshi/mockserver)

**mockserver** is a library that will help you mocking your APIs
in **a matter of seconds**: you simply organize your mocked
HTTP responses in a bunch of mock files and it will serve them
like they were coming from a real API; in this way you can
write your frontends without caring too much whether your
backend is really ready or not.

## Installation

Simply install this library through NPM:

``` bash
npm install mockserver
```

## Usage

First of all, define where your mocked backend is gonna run:

``` javascript
var http    =  require('http');
var mockserver  =  require('mockserver');

http.createServer(mockserver('path/to/your/mocks')).listen(9001);
```

This will run a simple HTTP webserver, handled by mockserver, on port
9001.

At this point you can simply define your first mock: create a file in
`path/to/your/mocks` called `example-response_GET.mock`:

```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
   "Random": "content"
}
```

If you open your browser at `http://localhost:9001/example-response`
you will see something like this:

![example output](https://raw.githubusercontent.com/namshi/mockserver/readme/bin/images/example-response.png)

And it's over: now you can start writing your frontends without
having to wait for your APIs to be ready, or without having to spend
too much time mocking them, as mockserver lets you do it in seconds.

## Mock files

As you probably understood, mock files' naming conventions are based
on the response that they are going to serve:

```
$REQUEST-PATH_$HTTP-METHOD.mock
```

For example, let's say that you wanna mock the response of a POST request
to `/users`, you would simply need to create a file named `users_POST`.

The content of the mock files needs to be a valid HTTP response, for example:

```
HTTP/1.1 200 OK
Content-Type: text/xml; charset=utf-8

{
   "Accept-Language": "en-US,en;q=0.8",
   "Host": "headers.jsontest.com",
   "Accept-Charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
   "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}
```

Check [our own mocks](https://github.com/namshi/mockserver/tree/master/test/mocks) as a reference.

## Variations

Sometimes it's quite handy to be able to support different responses for
the "same" request, for example when you want to test that your frontend
behaves correctly when POSTing at `/users` and in the case that the server
could return either a `200` or a `500` error.

These are called "variations", and you can easily implement them by
sending the `mockserver-Variation` header in your request.

For example, if you issue a POST request to `/users` with `mockserver-Variation: failure`
you can then define a mock called `users_POST_failure.mock` and put the related content
there.

## Query String Parameters

In order to support query string parameters in the mocked files, make sure to replace `?`
with `--` in the mock file name.

```
GET /hello?a=b

hello--a=b_GET.mock
```

(This has been introduced to overcome issues in file naming on windows)

## Tests

Tests run on travis, but if you wanna run them locally you simply
have to run `mocha` or its verbose cousin `./node_modules/mocha/bin/mocha`
(if you don't have mocha installed globally).