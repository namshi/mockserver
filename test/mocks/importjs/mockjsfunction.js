module.exports = function (request) {
    var body = JSON.parse(request.body)
    return {
        val: body.val
    }
}