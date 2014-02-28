var utils = require('./utils');

module.exports = Tokenizer;

function Tokenizer(data) {
  this.data = data;
}

Tokenizer.prototype = {
  constructor: Tokenizer,

  cleanUp: function() {
    //Strip /* */ style comments, including multiline
    return this.data.replace(/\/\*(.|\n|\r)*?\*\//g, '')
    //Strip // from end of lines and end of file
      .replace(/\/\/.*(\r|\n|)/g, '')
    //Strip returns and newlines  
      .replace(/(\r|\n|\t)*/g, '')
    //Replace multiple whitespace with one whitespace
      .replace(/\s{2,}/g, ' ');
  },

  //Do dirty RegEx things to first just split everything up. Then categorize tokens and return them.
  tokenize: function(str) {
    var keywords = 'class|constructor|function|method|field|static|var|int|char|boolean|void|true|false|null|this|let|do|if|else|while|return',
      symbols = '[{}()\\[\\]\\.;,&\\+\\-\\*\\/|<>=~]',
      integers = '\\d+',
      identifiers = '\\w+',
      strings = '".*?"',
      pattern = new RegExp(keywords + '|' + symbols + '|' + integers + '|' + identifiers + '|' + strings, 'g'),
      token,
      tokens = [];

      while ((token = pattern.exec(str)) !== null) {      
        tokens.push({ type: this.getTokenType(token[0]), val: this.getTokenVal(token[0]) });
      }
      
      return tokens;
  },

  getTokenType: function(token) {
    if (utils.anyEqual(token, 'class', 'constructor', 'function', 'method', 'field', 'static', 'var',
                  'int', 'char', 'boolean', 'void', 'true', 'false', 'null', 'this', 'let', 'do',
                  'if', 'else', 'while', 'return')) {
      return 'keyword';
    }
    else if (utils.anyEqual(token, '{', '}', '(', ')', '[', ']', '.', ',', ';', '+', '-', '*', '/', '&', '|', '<', '>', '=', '~')) {
      return 'symbol';
    }
    else if (token.charAt(0) === '"') { return 'stringConstant'; }
    else if (!isNaN(parseInt(token))) { return 'integerConstant'; } 
    else if (/\w/.test(token) === true) { return 'identifier'; }
    else { throw 'Invalid token: ' + token + ' on line 23. J/K IDK which line it\'s from...good luck, sport!'; }
  },

  getTokenVal: function(token) {
    if (token === '<') { return '&lt;'; }
    else if (token === '>') { return '&gt;'; }
    else if (token === '&') { return '&amp;'; }
    else if (token.charAt(0) === '"') { return token.replace(/"/g, ''); }
    else { return token; }
  },

  execute: function() {
    return this.tokenize(this.cleanUp());
  }
}