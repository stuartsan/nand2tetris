var utils = require('./utils'),
  VmWriter = require('./vmwriter');

module.exports = Compiler;

function Compiler(stream, symTable) {
  this.tokens = stream;
  this.currentTokenIdx = 0;
  this.currentSubroutineVoid = false;
  this.symTable = symTable;
  this.className = null;
  this.output = [];
}

Compiler.prototype = {
  constructor: Compiler,

  //Gets token at + or - count from current. By default returns current token.
  getRelativeToken: function(count) {
    return this.tokens[this.currentTokenIdx + (count || 0)];
  },  

  //Advances token by one, by default. But also accepts a number of tokens to advance by.
  advanceToken: function(num) {
    this.currentTokenIdx = this.currentTokenIdx + (num || 1);
  },

  appendOutput: function(item) {
    this.output = this.output.concat(item);
  },

  /* 
   * Each of the following compilation methods, beginning with compileClass, checks where 
   * we're at in the token stream, generates any necessary code output, and recursively calls
   * other compilation methods for syntax elements inside of itself, advancing the current
   * token stream position accordingly and incrementally adding to this.output.
   */

  compileClass: function() {
    this.className = this.getRelativeToken(1).val;
    this.advanceToken(3);

    while (utils.anyEqual(this.getRelativeToken(0).val, 'static', 'field')) {
      this.compileClassVarDec();
    } 

    while (utils.anyEqual(this.getRelativeToken(0).val, 'constructor', 'function', 'method')) {
      this.currentSubroutineVoid = this.getRelativeToken(1).val === 'void';
      this.compileSubroutine();
    }
  },

  compileClassVarDec: function() {
    var idKind = this.getRelativeToken(0).val,
      idType = this.getRelativeToken(1).val;

    this.symTable.addIdentifier(this.getRelativeToken(2).val, idType, idKind);

    this.advanceToken(3);

    while (this.getRelativeToken(0).val === ',') {
      this.symTable.addIdentifier(this.getRelativeToken(1).val, idType, idKind);      
      this.advanceToken(2);
    }

    this.advanceToken(1);
  },

  compileSubroutine: function() {
    var fnCall,
      localVars,
      fields,
      subroutineName = this.getRelativeToken(2).val,
      subroutineType = this.getRelativeToken(0).val;
    
    //Wipe out existing subroutine table
    this.symTable.startSubroutine();

    this.advanceToken(4);
    this.compileParameterList();

    this.advanceToken(2);

    while (this.getRelativeToken(0).val === 'var' && this.getRelativeToken(0).type === 'keyword') {
      this.compileVarDec();
    }
    
    localVars = this.symTable.varCount('var');
    this.appendOutput( VmWriter.writeFunction(this.className + '.' + subroutineName + ' ' + localVars) );

    fields = this.symTable.varCount('field');
    if (subroutineType === 'method') {
      this.appendOutput( VmWriter.writePush('argument', 0) );
      this.appendOutput( VmWriter.writePop('pointer', 0) );
    } 
    else if (subroutineType === 'constructor') {
      this.appendOutput( VmWriter.writePush('constant', fields) );
      this.appendOutput( VmWriter.writeCall('Memory.alloc', 1) );
      this.appendOutput( VmWriter.writePop('pointer', 0) );
    }

    this.compileStatements();
    this.advanceToken(1);
  },

  compileParameterList: function() {
    var paramCount = 0,
    idKind = 'arg';

    if (this.getRelativeToken(0).val !== ')') {
      this.symTable.addIdentifier(this.getRelativeToken(1).val, this.getRelativeToken(0).val, idKind);
      this.advanceToken(2);
      paramCount++;
    }

    while (this.getRelativeToken(0).val === ',') {
      this.symTable.addIdentifier(this.getRelativeToken(2).val, this.getRelativeToken(1).val, idKind);
      this.advanceToken(3);
      paramCount++;
    }

    //Returns paramCount so the caller can compile subroutine with correct # of args
    return paramCount;
  },

  compileVarDec: function() {
    var idKind = 'var',
      idType = this.getRelativeToken(1).val;

    this.symTable.addIdentifier(this.getRelativeToken(2).val, idType, idKind);
    this.advanceToken(3);

    while (this.getRelativeToken(0).val === ',') {
      this.symTable.addIdentifier(this.getRelativeToken(1).val, idType, idKind);
      this.advanceToken(2);
    }
    this.advanceToken(1);
  },

  compileStatements: function() {
    while (utils.anyEqual(this.getRelativeToken(0).val, 'let', 'if', 'while', 'do', 'return')) {
      switch (this.getRelativeToken(0).val) {
        case 'let': this.compileLet(); break;
        case 'if': this.compileIf(); break;
        case 'while': this.compileWhile(); break;
        case 'do': this.compileDo(); break;
        case 'return': this.compileReturn(); break;
      }
    }    
  },
  
  compileLet: function() {
    var dest;

    //Here we get identifier, it's already been defined
    dest = this.symTable.getIdentifier(this.getRelativeToken(1).val);

    this.advanceToken(2);

    if (this.getRelativeToken(0).val === '['){
      this.advanceToken(1);
      this.compileExpression();
      this.advanceToken(1);
    }

    this.advanceToken(1);
    this.compileExpression();

    //Store result accordingly
    this.appendOutput( VmWriter.writePop(dest.kind, dest.idx) );
    this.advanceToken(1);
  },

  compileIf: function() {
    var ifThis = VmWriter.getUniqueLabel('if'),
      elseThat = VmWriter.getUniqueLabel('else');

    this.advanceToken(2);
    this.compileExpression();

    this.appendOutput( VmWriter.writeLogic('~') );
    this.appendOutput( VmWriter.writeIf(elseThat) );

    this.advanceToken(2);
    this.compileStatements();
    this.advanceToken(1);

    this.appendOutput( VmWriter.writeGoto(ifThis) );
    this.appendOutput( VmWriter.writeLabel(elseThat));
    if (this.getRelativeToken(0).val === 'else') {
      this.advanceToken(2);
      this.compileStatements();      
      this.advanceToken(1);
    }
    this.appendOutput( VmWriter.writeLabel(ifThis));

  },

  compileWhile: function() {
    var loopStart = VmWriter.getUniqueLabel('whilestart'),
      loopEnd = VmWriter.getUniqueLabel('whileend');

    this.appendOutput( VmWriter.writeLabel(loopStart) );

    this.advanceToken(2);
    this.compileExpression();
    this.advanceToken(1);

    this.appendOutput( VmWriter.writeLogic('~') );
    this.appendOutput( VmWriter.writeIf(loopEnd) );

    this.advanceToken(1);
    this.compileStatements();
    this.advanceToken(1);

    this.appendOutput( VmWriter.writeGoto(loopStart) );
    this.appendOutput( VmWriter.writeLabel(loopEnd) );
  },
  
  compileDo: function() {
    this.advanceToken(1);
    this.compileSubroutineCall();
    this.appendOutput( VmWriter.writePop('temp', 0) );
    this.advanceToken(1);
  },
  
  compileReturn: function() {

    this.advanceToken(1);

    if (this.getRelativeToken(0).val !== ';') {
      this.compileExpression();
    }

    this.advanceToken(1);

    if (this.currentSubroutineVoid) {
      this.appendOutput( VmWriter.writePush('constant', 0) );
    }
    this.appendOutput( VmWriter.writeReturn() );
  },

  compileExpression: function() {
    var operator;
    
    this.compileTerm();

    while (utils.anyEqual(this.getRelativeToken(0).val, '+', '-', '*', '/', '&', '|', '<', '>', '=')) {
      operator = this.getRelativeToken(0).val;
      this.advanceToken(1);
      this.compileTerm();
      this.appendOutput(VmWriter.writeArithmetic(operator));
    }
  },

  compileExpressionList: function() {
    var expressionCount = 0;

    if (this.getRelativeToken(0).val !== ')') {
      expressionCount++
      this.compileExpression();

      while (this.getRelativeToken(0).val === ',') {
        expressionCount++
        this.advanceToken(1);
        this.compileExpression();
      }
    }
    
    return expressionCount;
  },

  compileSubroutineCall: function() {
      var expressionCount = 0,
        name;


    //Call like this: something.doIt()
    if (this.getRelativeToken(1).val === '.') {
      var nameData = this.symTable.getIdentifier(this.getRelativeToken().val);

      //Static method, e.g. constructor
      if (!nameData) {
        name = this.getRelativeToken().val + '.' + this.getRelativeToken(2).val;
      }
      //Class method called on object instance
      else {
        expressionCount++;
        name = nameData.type + '.' + this.getRelativeToken(2).val;
        // this.appendOutput( VmWriter.writePush('pointer', 0) );
        this.appendOutput( VmWriter.writePush(nameData.kind, nameData.idx) );
      }

      this.advanceToken(4);
    }

    //Call like this: doit()
    //Must be a method of the class we're in
    else if (this.getRelativeToken(1).val === '(') {
      expressionCount++;
      this.appendOutput( VmWriter.writePush('pointer', 0) );
      name = this.className + '.' + this.getRelativeToken(0).val;
      this.advanceToken(2);
    }     

    expressionCount += this.compileExpressionList();
    this.advanceToken(1);

    this.appendOutput( VmWriter.writeCall(name, expressionCount) );
  },

  compileTerm: function() {
    var unaryOp,
      identifier,
      segment,
      keywordMapped;

    //Accessing array item
    if (this.getRelativeToken(1).val === '[') {
      this.advanceToken(2);
      this.compileExpression();
      this.advanceToken(1);
    }

    //Unary op + term. In this case, output the term then the unary operator.
    else if (utils.anyEqual(this.getRelativeToken(0).val, '-', '~')) {
      unaryOp = this.getRelativeToken(0).val;
      this.advanceToken(1);
      this.compileTerm();
      this.appendOutput( VmWriter.writeLogic(unaryOp) );
    }

    //Nested expression -- just keep recursing!
    else if (this.getRelativeToken(0).val === '(') {
      this.advanceToken(1);
      this.compileExpression();
      this.advanceToken(1); 
    }

    //Subroutine call -- self explanatory
    else if (utils.anyEqual(this.getRelativeToken(1).val, '(', '.')) {
      this.compileSubroutineCall();
    }

    //We've recursed all the way to constant or identifier
    else {
      if (this.getRelativeToken().type === 'integerConstant') {
        this.appendOutput( VmWriter.writePush('constant', this.getRelativeToken().val) );
      } 
      else if (this.getRelativeToken().type === 'keyword') {
        switch (this.getRelativeToken().val) {
          case 'null':
          case 'false': 
            keywordMapped = [ VmWriter.writePush('constant', '0') ];
            break;
          case 'true':
            keywordMapped = [ VmWriter.writePush('constant', '1'), 'neg'];
            break;
          case 'this':
            keywordMapped = [ VmWriter.writePush('pointer', '0') ];
            break;
          default: console.log('======default situation============')
        }
        this.appendOutput(keywordMapped);
      }
      else {
        identifier = this.symTable.getIdentifier( this.getRelativeToken(0).val );
        this.appendOutput( VmWriter.writePush(identifier.kind, identifier.idx) );        
      }

      this.advanceToken(1);
    }
  },

  execute: function() {
    if (this.getRelativeToken(0).val === 'class') {
      this.compileClass();
      console.log(this.output) //REMOVEREMOVEREMOVE
      return this.output;
    } else {
      throw 'Uhhh programs have to start with classes SRY';
    }
  }
}