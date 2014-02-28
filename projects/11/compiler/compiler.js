var utils = require('./utils'),
  VmWriter = require('./vmwriter');


module.exports = Compiler;

function Compiler(stream, symTable) {
  this.tokens = stream;
  this.currentTokenIdx = 0;
  this.symTable = symTable;
  this.className = null;
}

Compiler.prototype = {
  constructor: Compiler,

  xmlOpenTag: function(elem) {
    return '\n<' + elem + '>';
  },

  getCurrentToken: function() {
    return this.tokens[this.currentTokenIdx];
  },

  //Gets token at + or - count from current
  getRelativeToken: function(count) {
    return this.tokens[this.currentTokenIdx + (count || 0)];
  },  

  //Will advance token by one, by default. But can also 
  advanceToken: function(num) {
    this.currentTokenIdx = this.currentTokenIdx + (num || 1);
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
    var output = [];

    //Class identifier happens here at ct + 1
    //So let's set property to it! Then all recursive calls can access it.
    this.className = this.getRelativeToken(1).val;

    // result += this.wrapAndContinue(3);
    this.advanceToken(3);

    while (utils.anyEqual(this.getCurrentToken().val, 'static', 'field')) {
      // result += this.compileClassVarDec();
      output = output.concat( this.compileClassVarDec() );
    } 

    while (utils.anyEqual(this.getCurrentToken().val, 'constructor', 'function', 'method')) {
      // result += this.compileSubroutine();
      output = output.concat( this.compileSubroutine() );
    }

    //This is the last one so don't continue
    // result += this.wrapInXML(this.getCurrentToken());

    // result += this.xmlCloseTag('class');
    // return result;
    return output;
  },

  compileClassVarDec: function() {
    var result = this.xmlOpenTag('classVarDec');

    var idKind = this.getCurrentToken().val;
    var idType = this.getRelativeToken(1);

    var idx = this.symTable.addIdentifier(this.getRelativeToken(2).val, idType, idKind);

    //FIXME: here static and field vars must be handled. unclear what
    //to do with fields...dont need yet anyway.

    // result += this.wrapAndContinue(3);


    while (this.getCurrentToken().val === ',') {
      this.symTable.addIdentifier(this.getRelativeToken(1).val, idType, idKind);      
      result += this.wrapAndContinue(2);
    }

    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('classVarDec');
    return result;
  },

  compileSubroutine: function() {
    var result = this.xmlOpenTag('subroutineDec');
    var output = [];

    if (utils.anyEqual(this.getCurrentToken().val, 'constructor', 'function')) {
      output = output.concat(VmWriter.writeFunction(this.className + '.' + this.getRelativeToken(1).val, 2));
    }

    console.log(output)
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

    //These must be arguments
    var idKind = 'arg';

    if (this.getCurrentToken().val !== ')') {
      this.symTable.addIdentifier(this.getRelativeToken(1).val, this.getCurrentToken().val, idKind);
      result += this.wrapAndContinue(2);
    }

    while (this.getCurrentToken().val === ',') {
      this.symTable.addIdentifier(this.getRelativeToken(2).val, this.getRelativeToken(1).val, idKind);
      result += this.wrapAndContinue(3);
    }

    result += this.xmlCloseTag('parameterList');
    return result;
  },

  compileVarDec: function() {
    var result = this.xmlOpenTag('varDec');

    var idKind = 'var';
    var idType = this.getRelativeToken(1).val;

    this.symTable.addIdentifier(this.getRelativeToken(2).val, idType, idKind);

    result += this.wrapAndContinue(3);

    while (this.getCurrentToken().val === ',') {
      this.symTable.addIdentifier(this.getRelativeToken(1).val, idType, idKind);
      result += this.wrapAndContinue(2);
    }
    result += this.wrapAndContinue(1);

    result += this.xmlCloseTag('varDec');
    return result;
  },
  compileStatements: function() {
    var result = this.xmlOpenTag('statements');

    while (utils.anyEqual(this.getCurrentToken().val, 'let', 'if', 'while', 'do', 'return')) {
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

    //Here we get identifier, it's already been defined
    this.symTable.getIdentifier(this.getRelativeToken(1).val);

    //do something with it

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

    while (utils.anyEqual(this.getCurrentToken().val, '+', '-', '*', '/', '&amp;', '|', '&lt;', '&gt;', '=')) {
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

    this.symTable.getIdentifier(this.getCurrentToken().val)
    //the identifier will only really be used in the first case below
    //but just do the result of above || token value...or whatever

    if (this.getRelativeToken(1).val === '.') {
      result += this.wrapAndContinue(4);
      result += this.compileExpressionList();
      result += this.wrapAndContinue(1);
    }
    else if (this.getRelativeToken(1).val === '(') {
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

    //if ct type is 'identifier' then do getIdentifier.
    //if it doesn't return an obj, that's bc it's a class/subroutine ident.
    //i think that means, just use the symbol itself (or Class.Subrtn)
    this.symTable.getIdentifier( this.getRelativeToken(0) );
    //then insert this puppy into the code,
    //obviously doing different things with it depending on the sitch


    if (this.getRelativeToken(1).val === '[') {
      result += this.wrapAndContinue(2);
      result += this.compileExpression();
      result += this.wrapAndContinue(1);
    }
    else if (utils.anyEqual(this.getCurrentToken().val, '-', '~')) {
      result += this.wrapAndContinue(1);
      result += this.compileTerm();
    }
    else if (this.getCurrentToken().val === '(') {
      result += this.wrapAndContinue(1);
      result += this.compileExpression();
      result += this.wrapAndContinue(1); 
    }
    else if (utils.anyEqual(this.getRelativeToken(1).val, '(', '.')) {
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