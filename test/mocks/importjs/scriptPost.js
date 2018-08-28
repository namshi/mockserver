module.exports = {
    prop: request.body.indexOf('foo') !== -1 ? 'bar' : 'baz'
};