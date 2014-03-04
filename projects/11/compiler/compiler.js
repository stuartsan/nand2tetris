var utils = require('./utils'),
  SymTable = require('./symboltable'),
  VmWriter = require('./vmwriter');

module.exports = Compiler;

function Compiler(stream) {
  this.currentTokenIdx = 0;
  this.currentSubroutineVoid = false;
  this.className = null;
  this.tokens = stream;
  this.symTable = new SymTable();
  this.vmWriter = new VmWriter();
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
    this.vmWriter.writeFunction(this.className + '.' + subroutineName + ' ' + localVars);

    fields = this.symTable.varCount('field');
    if (subroutineType === 'method') {
      this.vmWriter.writePush('argument', 0);
      this.vmWriter.writePop('pointer', 0);
    } 
    else if (subroutineType === 'constructor') {
      this.vmWriter.writePush('constant', fields) ;
      this.vmWriter.writeCall('Memory.alloc', 1);
      this.vmWriter.writePop('pointer', 0);
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
    var dest,
      isArray = false;

    dest = this.symTable.getIdentifier(this.getRelativeToken(1).val);

    this.advanceToken(2);

    if (this.getRelativeToken(0).val === '['){
      isArray = true;
      this.advanceToken(1);
      this.compileExpression();
      this.vmWriter.writePush(dest.kind, dest.idx);
      this.vmWriter.writeArithmetic('+');
      this.advanceToken(1);
    }

    this.advanceToken(1);
    this.compileExpression();

    //Store result accordingly
    if (isArray) {
      this.vmWriter.writePop('temp', 0);
      this.vmWriter.writePop('pointer', 1);
      this.vmWriter.writePush('temp', 0);
      this.vmWriter.writePop('that', 0);
    } 
    else {
      this.vmWriter.writePop(dest.kind, dest.idx);
    }

    this.advanceToken(1);
  },

  compileIf: function() {
    var ifThis = this.vmWriter.getUniqueLabel('if'),
      elseThat = this.vmWriter.getUniqueLabel('else');

    this.advanceToken(2);
    this.compileExpression();

    this.vmWriter.writeLogic('~');
    this.vmWriter.writeIf(elseThat);

    this.advanceToken(2);
    this.compileStatements();
    this.advanceToken(1);

    this.vmWriter.writeGoto(ifThis);
    this.vmWriter.writeLabel(elseThat);
    if (this.getRelativeToken(0).val === 'else') {
      this.advanceToken(2);
      this.compileStatements();      
      this.advanceToken(1);
    }
    this.vmWriter.writeLabel(ifThis);

  },

  compileWhile: function() {
    var loopStart = this.vmWriter.getUniqueLabel('whilestart'),
      loopEnd = this.vmWriter.getUniqueLabel('whileend');

    this.vmWriter.writeLabel(loopStart);

    this.advanceToken(2);
    this.compileExpression();
    this.advanceToken(1);

    this.vmWriter.writeLogic('~');
    this.vmWriter.writeIf(loopEnd);

    this.advanceToken(1);
    this.compileStatements();
    this.advanceToken(1);

    this.vmWriter.writeGoto(loopStart);
    this.vmWriter.writeLabel(loopEnd);
  },
  
  compileDo: function() {
    this.advanceToken(1);
    this.compileSubroutineCall();
    this.vmWriter.writePop('temp', 0);
    this.advanceToken(1);
  },
  
  compileReturn: function() {

    this.advanceToken(1);

    if (this.getRelativeToken(0).val !== ';') {
      this.compileExpression();
    }

    this.advanceToken(1);

    if (this.currentSubroutineVoid) {
      this.vmWriter.writePush('constant', 0);
    }
    this.vmWriter.writeReturn();
  },

  compileExpression: function() {
    var operator;
    
    this.compileTerm();

    while (utils.anyEqual(this.getRelativeToken(0).val, '+', '-', '*', '/', '&', '|', '<', '>', '=')) {
      operator = this.getRelativeToken(0).val;
      this.advanceToken(1);
      this.compileTerm();
      this.vmWriter.writeArithmetic(operator);
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
      var argsCount = 0,
        name;


    //Function/method call with class, e.g. classOrVar.doIt()
    if (this.getRelativeToken(1).val === '.') {
      var nameData = this.symTable.getIdentifier(this.getRelativeToken().val);

      //Static method, e.g. constructor
      if (!nameData) {
        name = this.getRelativeToken().val + '.' + this.getRelativeToken(2).val;
      }

      //Class method called on object instance
      else {
        argsCount++;
        name = nameData.type + '.' + this.getRelativeToken(2).val;
        // this.vmWriter.writePush('pointer', 0);
        this.vmWriter.writePush(nameData.kind, nameData.idx);
      }

      this.advanceToken(4);
    }

    //Class method call without class name, e.g. doit()
    else if (this.getRelativeToken(1).val === '(') {
      argsCount++;
      this.vmWriter.writePush('pointer', 0);
      name = this.className + '.' + this.getRelativeToken(0).val;
      this.advanceToken(2);
    }     

    argsCount += this.compileExpressionList();
    this.advanceToken(1);

    this.vmWriter.writeCall(name, argsCount);
  },

  compileTerm: function() {
    var unaryOp,
      identifier,
      segment,
      keywordMapped;

    //Accessing array item: add item's base address (ct) and val of expression
    if (this.getRelativeToken(1).val === '[') {
      var baseAddress = this.symTable.getIdentifier(this.getRelativeToken().val);
      this.advanceToken(2);
      this.compileExpression();
      this.vmWriter.writePush( baseAddress.kind, baseAddress.idx );
      this.vmWriter.writeArithmetic('+');
      this.vmWriter.writePop('pointer', 1);
      this.vmWriter.writePush('that', 0);
      this.advanceToken(1);
    }

    //Unary op + term. In this case, output the term then the unary operator.
    else if (utils.anyEqual(this.getRelativeToken(0).val, '-', '~')) {
      unaryOp = this.getRelativeToken(0).val;
      this.advanceToken(1);
      this.compileTerm();
      this.vmWriter.writeLogic(unaryOp);
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
        this.vmWriter.writePush('constant', this.getRelativeToken().val);
      } 
      else if (this.getRelativeToken().type === 'keyword') {
        switch (this.getRelativeToken().val) {
          case 'null':
          case 'false': 
            this.vmWriter.writePush('constant', '0');
            break;
          case 'true':
            this.vmWriter.writePush('constant', '1');
            this.vmWriter.writeLogic('-');
            break;
          case 'this':
            this.vmWriter.writePush('pointer', '0');
            break;
        }
        
      }
      else if (this.getRelativeToken().type === 'stringConstant') {
        var str = this.getRelativeToken().val;
        this.vmWriter.writePush('constant', str.length);
        this.vmWriter.writeCall('String.new', 1);
        for (var i = 0; i < str.length; i++) {
          this.vmWriter.writePush('constant', str.charCodeAt(i));
          this.vmWriter.writeCall('String.appendChar', 2);
        }
      }
      else {
        identifier = this.symTable.getIdentifier( this.getRelativeToken(0).val );
        this.vmWriter.writePush(identifier.kind, identifier.idx);        
      }

      this.advanceToken(1);
    }
  },

  execute: function() {
    if (this.getRelativeToken(0).val === 'class') {
      this.compileClass();
      console.log(this.vmWriter.output) //REMOVEREMOVEREMOVE
      return this.vmWriter.output;
    } else {
      throw 'Uhhh programs have to start with classes SRY';
    }
  }
}