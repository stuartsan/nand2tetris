#!/usr/local/bin/node

/*
 * Command line script that accepts one or more .jack files in the Jack language,
 * passed via command line, and performs syntax analysis on them.
 *
 * First it tokenizes the input then creates a parse tree in XML (yikes).
 *
 * To pass more than one file, pass the directory containing .jack files.
 * It will operate on and output a corresponding XML file for each.
 *
 * Ex: >> analyzer.js awesomejackfiles
 * Creates XML file for each file in directory
 */

'use strict';

var fs = require('fs'),
  path = require('path');

/*
 * Cleaning, tokenizing, and parsing (Tokenizer)
 */

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
    if (anyEqual(token, 'class', 'constructor', 'function', 'method', 'field', 'static', 'var',
                  'int', 'char', 'boolean', 'void', 'true', 'false', 'null', 'this', 'let', 'do',
                  'if', 'else', 'while', 'return')) {
      return 'keyword';
    }
    else if (anyEqual(token, '{', '}', '(', ')', '[', ']', '.', ',', ';', '+', '-', '*', '/', '&', '|', '<', '>', '=', '~')) {
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

/*
 * Compilation engine -- writes stuff
 */

function Compiler(stream) {
  this.tokens = stream;
  this.currentTokenIdx = 0;
}

Compiler.prototype = {
  constructor: Compiler,

  xmlOpenTag: function(elem) {
    return '\n<' + elem + '>';
  },

  getCurrentToken: function() {
    return this.tokens[this.currentTokenIdx];
  },

  getFutureToken: function(count) {
    return this.tokens[this.currentTokenIdx + count];
  },

  advanceToken: function() {
    this.currentTokenIdx++;
  },

  xmlCloseTag: function(elem) {
    return '\n</' + elem + '>';
  },

  wrapInXML: function(token) {
    return '\n<' + token.type + '> ' + token.val + ' </' + token.type + '>';
  },

  wrapAndContinue: function(num) {
    var result = '';
    while (num--) {
      result += this.wrapInXML(this.getCurrentToken());
      this.advanceToken();
    } 
    return result;
  },

  compileClass: function() {
    var result = this.xmlOpenTag('class');

    result += this.wrapAndContinue(3);

    while (anyEqual(this.getCurrentToken().val, 'static', 'field')) {
      result += this.compileClassVarDec();
    } 

    while (anyEqual(this.getCurrentToken().val, 'constructor', 'function', 'method')) {
      result += this.compileSubroutine();
    }

    //This is the last one so don't continue
    result += this.wrapInXML(this.getCurrentToken());

    result += this.xmlCloseTag('class');
    return result;
  },

  compileClassVarDec: function() {
    var result = this.xmlOpenTag('classVarDec');

    result += this.wrapAndContinue(3);

    while (this.getCurrentToken().val === ',') {
      result += this.wrapAndContinue(2);
    }

    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('classVarDec');
    return result;
  },

  compileSubroutine: function() {
    var result = this.xmlOpenTag('subroutineDec');

    result += this.wrapAndContinue(4);
    result += this.compileParameterList();
    result += this.wrapAndContinue(1);
    result += this.xmlOpenTag('subroutineBody');
    result += this.wrapAndContinue(1);

    while (this.getCurrentToken().val === 'var' && this.getCurrentToken().type === 'keyword') {
      result += this.compileVarDec();
    }

    result += this.compileStatements();
    result += this.wrapAndContinue(1);
    result += this.xmlCloseTag('subroutineBody');

    result += this.xmlCloseTag('subroutineDec');
    return result;
  
  },

  compileParameterList: function() {
    var result = this.xmlOpenTag('parameterList');

    if (this.getCurrentToken().val !== ')') {
      result += this.wrapAndContinue(2);
    }

    while (this.getCurrentToken().val === ',') {
      result += this.wrapAndContinue(3);
    }

    result += this.xmlCloseTag('parameterList');
    return result;
  },

  compileVarDec: function() {
    var result = this.xmlOpenTag('varDec');

    result += this.wrapAndContinue(3);

    while (this.getCurrentToken().val === ',') {
      result += this.wrapAndContinue(2);
    }
    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('varDec');
    return result;
  },
  compileStatements: function() {
    var result = this.xmlOpenTag('statements');

    while (anyEqual(this.getCurrentToken().val, 'let', 'if', 'while', 'do', 'return')) {
      switch (this.getCurrentToken().val) {
        case 'let':
          result += this.compileLet();
          break;
        case 'if':
          result += this.compileIf();
          break;
        case 'while':
          result += this.compileWhile();
          break;
        case 'do':
          result += this.compileDo();
          break;
        case 'return':
          result += this.compileReturn();
          break;
      }
    }    

    result += this.xmlCloseTag('statements');
    return result;
  },
  
  compileLet: function() {
    var result = this.xmlOpenTag('letStatement');

    result += this.wrapAndContinue(2);

    if (this.getCurrentToken().val === '['){
      result += this.wrapAndContinue(1);
      result += this.compileExpression();
      result += this.wrapAndContinue(1);
    }

    result += this.wrapAndContinue(1);
    result += this.compileExpression();
    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('letStatement');
    return result;
  },

  compileIf: function() {
    var result = this.xmlOpenTag('ifStatement');    

    result += this.wrapAndContinue(2);
    result += this.compileExpression();
    result += this.wrapAndContinue(2);
    result += this.compileStatements();
    result += this.wrapAndContinue(1);

    if (this.getCurrentToken().val === 'else') {
      result += this.wrapAndContinue(2);
      result += this.compileStatements();      
      result += this.wrapAndContinue(1);
    }

    result += this.xmlCloseTag('ifStatement');
    return result;
  },

  compileWhile: function() {
    var result = this.xmlOpenTag('whileStatement');

    result += this.wrapAndContinue(2);
    result += this.compileExpression();
    result += this.wrapAndContinue(2);
    result += this.compileStatements();
    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('whileStatement');
    return result;
  },
  
  compileDo: function() {
    var result = this.xmlOpenTag('doStatement');

    result += this.wrapAndContinue(1);
    result += this.compileSubroutineCall();
    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('doStatement');
    return result;
  },
  
  compileReturn: function() {
    var result = this.xmlOpenTag('returnStatement');

    result += this.wrapAndContinue(1);

    if (this.getCurrentToken().val !== ';') {
      result += this.compileExpression();
    }
    
    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('returnStatement');
    return result; 
  },

  compileExpression: function() {
    var result = this.xmlOpenTag('expression');
    
    result += this.compileTerm();

    while (anyEqual(this.getCurrentToken().val, '+', '-', '*', '/', '&amp;', '|', '&lt;', '&gt;', '=')) {
      result += this.wrapAndContinue(1);
      result += this.compileTerm();
    }

    result += this.xmlCloseTag('expression');
    return result; 
  },

  compileExpressionList: function() {
    var result = this.xmlOpenTag('expressionList');

    if (this.getCurrentToken().val !== ')') {
      result += this.compileExpression();
      while (this.getCurrentToken().val === ',') {
        result += this.wrapAndContinue(1);
        result += this.compileExpression();
      }
    }

    result += this.xmlCloseTag('expressionList');
    return result;
  },

  compileSubroutineCall: function() {
    var result = '';

    if (this.getFutureToken(1).val === '.') {
      result += this.wrapAndContinue(4);
      result += this.compileExpressionList();
      result += this.wrapAndContinue(1);
    }
    else if (this.getFutureToken(1).val === '(') {
      result += this.wrapAndContinue(2);
      result += this.compileExpressionList();
      result += this.wrapAndContinue(1);
    } 
    else {
      throw "explosion!!!1";
    }

    return result;
  },

  compileTerm: function() {
    var result = this.xmlOpenTag('term');

    if (this.getFutureToken(1).val === '[') {
      result += this.wrapAndContinue(2);
      result += this.compileExpression();
      result += this.wrapAndContinue(1);
    }
    else if (anyEqual(this.getCurrentToken().val, '-', '~')) {
      result += this.wrapAndContinue(1);
      result += this.compileTerm();
    }
    else if (this.getCurrentToken().val === '(') {
      result += this.wrapAndContinue(1);
      result += this.compileExpression();
      result += this.wrapAndContinue(1); 
    }
    else if (anyEqual(this.getFutureToken(1).val, '(', '.')) {
      result += this.compileSubroutineCall();
    }
    else {
      result += this.wrapAndContinue(1);
    }
    result += this.xmlCloseTag('term');
    return result;
  },

  execute: function() {
    if (this.getCurrentToken().val === 'class') {
      return this.compileClass();
    } else {
      throw 'Uhhh programs have to start with classes SRY';
    }
  }
}

/*
 * Helper functions
 */

//Checks if the first argument matches any subsequent arguments
function anyEqual(firstArg, anotherArg, etc) {
  var args = [].slice.apply(arguments);
  for (var i = 1; i < args.length; i++) {
    if (args[0] === args[i]) { return true };
  }
  return false;
}

/*
 * Execution: open file(s), process, then write output.
 */

function init() {

  var inputPath = path.normalize(path.join(process.cwd(), process.argv[2])),
  inputExt = path.extname(inputPath),
  inputName = path.basename(inputPath).replace(inputExt, ''),
  JACK_EXT = '.jack',
  isDir = (inputExt === ''),
  psQueueue = [];

  //Put either the individual file, or all the .jack files in the directory, into a queue
  //for processing
  if (isDir) {
    fs.readdirSync(inputPath).forEach(function(file) {
      if (path.extname(file) === JACK_EXT) {
        psQueueue.push(path.normalize(path.join(inputPath, file)));
      }
    });
  } 
  else {
    if (inputExt !== JACK_EXT) {
      throw "Hay this compiler is only for Jack files!"
    }
    psQueueue.push(inputPath);  
  }

  psQueueue.forEach(function(filePath) {
    //Create new tokenizer for each file in the queue and generate output
    var tokenizer = new Tokenizer(fs.readFileSync(filePath, 'utf8'));
    var tokenized = tokenizer.execute();

    //Compile tokenized stream
    var compiler = new Compiler(tokenized);
    var output = compiler.execute();

    //Write file
    fs.writeFileSync(filePath.replace(JACK_EXT, '.mine.xml'), output, 'utf8');
  });
}

init();


