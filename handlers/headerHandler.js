module.exports = function headerHandler(value, request) {
  if (!/^#header/m.test(value)) return value;
  return value
    .replace(/^#header (.*);/m, function (statement, val) {
    const expression = val.replace(/[${}]/g, '');
    return eval(expression);
  })
    .replace(/\r\n?/g, '\n');
}
