module.exports = request.body.indexOf('foo') !== -1 ? 'HTTP/1.1 200 OK' : 'HTTP/1.1 400 Bad request'
