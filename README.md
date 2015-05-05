# mockserver

[![Build Status](https://travis-ci.org/namshi/mockserver.svg?branch=master)](https://travis-ci.org/namshi/mockserver)

**mockserver** is a library that will help you mocking your APIs
in **a matter of seconds**: you simply organize your mocked
HTTP responses in a bunch of mock files and it will serve them
like they were coming from a real API; in this way you can
write your frontends without caring too much whether your
backend is really ready or not.

## Installation

Mockserver can be installed globally if you need
to run it as a command:

```
$ npm install -g mockserver

$ mockserver -p 8080 -m test/mocks
Mockserver serving mocks under "test/mocks" at http://localhost:8080
```

or as a regular NPM module if you need to use it as
a library within your code:

``` bash
npm install mockserver
```

then in your test file:

``` javascript
var http    =  require('http');
var mockserver  =  require('mockserver');

http.createServer(mockserver('path/to/your/mocks')).listen(9001);
```

This will run a simple HTTP webserver, handled by mockserver, on port
9001.

At this point you can simply define your first mock: create a file in
`path/to/your/mocks/example-response` called `GET.mock`:

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
$REQUEST-PATH/$HTTP-METHOD.mock
```

For example, let's say that you wanna mock the response of a POST request
to `/users`, you would simply need to create a file named `POST.mock` under `users/`.

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

## Custom Headers

You can specify request headers to include, which allows you to change the response based on what headers are
provided.  To do this, you need to let mockserver know which headers matter, by setting the
`headers` array on the mockserver object, like so:

```js
var mockserver = require('mockserver');
mockserver.headers = ['Authorization', 'X-My-Header'];
```

Any headers that are set and occur within the array will now be appended to the filename, immediately after the
HTTP method, like so:

```
GET /hello
Authorization: 12345

hello/GET_Authorization=12345.mock
```

```
GET /hello
X-My-Header: cow
Authorization: 12345

hello/GET_Authorization=12345_X-My-Header=cow.mock
```

**Note:** The order of the headers within the `headers` array determines the order of the values within the filename.

The server will always attempt to match the file with the most tracked headers, then it will try permutations of
headers until it finds one that matches.  This means that, in the previous example, the server will look for files
in this order:

```
hello/GET_Authorization=12345_X-My-Header=cow.mock
hello/GET_X-My-Header_Authorization=12345=cow.mock
hello/GET_Authorization=12345.mock
hello/GET_X-My-Header=cow.mock
hello/GET.mock
```

The first one matched is the one returned, favoring more matches and headers earlier in the array.

The `headers` array can be set or modified at any time.

## Query string parameters and POST body

In order to support query string parameters in the mocked files, replace all occurrences of `?` with `--`, then
append the entire string to the end of the file.

```
GET /hello?a=b

hello/GET--a=b.mock
```

```
GET /test?a=b&c=d?

test/GET--a=b&c=d--.mock
```

(This has been introduced to overcome issues in file naming on windows)

To combine custom headers and query parameters, simply add the headers *then* add the parameters:

```
GET /hello?a=b
Authorization: 12345

hello/GET_Authorization=12345--a=b.mock
```

Similarly, you can do the same thing with the body of a POST request:
if you send `Hello=World` as body of the request, mockserver will
look for a file called `POST--Hello=World.mock`

In the same way, if your POST body is a json like `{"json": "yesPlease"}`,
mockserver will look for a file called `POST--{"json": "yesPlease"}.mock`

If no parametrized mock file is found, mockserver will default to the
nearest headers based .mock file

ex:
```
GET /hello?a=b
Authorization: 12345
```
if there's no `hello/GET_Authorization=12345--a=b.mock`, we'll default to `hello/GET_Authorization=12345.mock` or to `hello/GET.mock`


## Tests

Tests run on travis, but if you wanna run them locally you simply
have to run `mocha` or its verbose cousin `./node_modules/mocha/bin/mocha`
(if you don't have mocha installed globally).
