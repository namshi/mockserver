const fs = require('fs');
const path = require('path');

module.exports = function importHandler(value, context, request) {
    if (!/^#import/m.test(value)) return value;

    return value
      .replace(/^#import (.*);/m, function (includeStatement, file) {
          const importThisFile = file.replace(/['"]/g, '');
          const content = fs.readFileSync(path.join(context, importThisFile));
          if (importThisFile.endsWith('.js')) {
              return JSON.stringify(eval(content.toString()));
          } else {
              return content;
          }
      })
      .replace(/\r\n?/g, '\n');
}
