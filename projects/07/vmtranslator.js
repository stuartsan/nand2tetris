#!/usr/local/bin/node

/*
 * Command line script that accepts one or more .vm files in the Hack fake VM language,
 * passed via command line, and converts to Hack assembly.
 *
 * To pass more than one file, pass the directory containing .vm files.
 * It will concatenate them into one file.
 *
 * Ex: >> vmtranslator.js awesomevmfiles
 * Creates new file translated.asm in same location as directory/file passed in
 */

var fs = require('fs'),
  path = require('path'),
  asmFilePath = path.normalize(path.join(process.cwd(), process.argv[2])),
  asmFileExt = path.extname(asmFilePath),
  asmFileName = path.basename(asmFilePath).replace(asmFileExt, '');

/*
 * Cleaning, parsing, and translation functions
 */

//Split file data into lines, remove carraige returns, comments, and leading/trailing spaces
//Then strip blank lines
function cleanUp(data) {
  var fileData = data.split('\n').map(function(item) {
    var result = item.indexOf('//') === -1 ? item : item.slice(0, item.indexOf('//'));
    return result.trim().replace(/\r/g, '');
  });
  return fileData.filter(function(item) { return item.length; });
}

//Return array of objects with relevant data attributes to hand to the Code Writer(tm)
function parse(data) {
  return data.map(function(item) {
    var pieces = item.split(' ');
    return { cmd: pieces[0], cmdType: getCommandType(pieces[0]),
             arg1: pieces[1], arg2: pieces[2] };
  });  
}

//Return array of translated assembly
function writeCode(data) {
  return data.map(function(item) {
    if (item.cmdType === 'C_ARITHMETIC') {
      return writeArithmeticCmd(item).join('\n');
    } 
    else if (anyEqual(item.cmdType, 'C_POP', 'C_PUSH')) {
      return writePushPopCmd(item).join('\n');
    }
    else { throw "Stop using nonsense VM commands!!1"; }
  });
}

//Handle arithmetic commands
function writeArithmeticCmd(command){
  var incrementSP = ['@SP', 'M=M+1'],   // ++pointer
    decrementSP = ['@SP', 'M=M-1'],     // --pointer
    loadValSP = ['A=M'],                // Loads SP value onto A
    storeValSP = ['A=M', 'D=M'];        // ^ then sets D to value pointed at by A
  
  var ops = {
    add: 'M=M+D', sub: 'M=M-D', neg: 'M=-D', and: 'M=D&M',
    or: 'M=D|M', not: 'M=!D', eq: 'D=M-D', gt: 'D=M-D', lt: 'D=M-D' 
  };

  if (anyEqual(command.cmd, 'eq', 'gt', 'lt')) {
    return [].concat( 
      decrementSP, storeValSP, decrementSP,
      loadValSP, ops[command.cmd], buildConditional());
  }
  else if (anyEqual(command.cmd, 'not', 'neg')) {
    return [].concat(
      decrementSP, storeValSP, ops[command.cmd], incrementSP);
  }
  else {
    return [].concat( 
      decrementSP, storeValSP, decrementSP,
      loadValSP, ops[command.cmd], incrementSP);
  }

  function buildConditional() {
    var trueLabel = makeUniqueLabel('SETTRUE'),
      falseLabel = makeUniqueLabel('SETFALSE'),
      continueLabel = makeUniqueLabel('CONTINUE'), 
      setTrue = ['@SP', 'A=M', 'M=-1', '@SP', 'M=M+1', '@' + continueLabel, '0;JMP'],
      setFalse = ['@SP', 'A=M', 'M=0', '@SP', 'M=M+1', '@' + continueLabel, '0;JMP'];

      var result = ['@' + trueLabel];
      
      //Set the jump condition based on command
      if (command.cmd === 'eq') { result = result.concat('D;JEQ') }
      else if (command.cmd === 'gt') { result = result.concat('D;JGT') }
      else if (command.cmd === 'lt') { result = result.concat('D;JLT') }
         
      return result.concat( '@' + falseLabel, '0;JMP', '(' + trueLabel + ')', 
        setTrue, '(' + falseLabel + ')', setFalse, '(' + continueLabel + ')');
    }
}

//Handle explicit stack manipulation commands
function writePushPopCmd(command) {
  var result = [],
    cmdType = command.cmdType,
    segment = command.arg1,
    index = command.arg2,
    incrementSP = ['@SP', 'M=M+1'],       
    decrementSP = ['@SP', 'M=M-1'],
    loadValSP = ['A=M'],                // Loads SP value onto A
    storeValSP = ['A=M', 'D=M'],        // Stores value pointed at by SP in D
    storeMemSP = ['@SP', 'A=M', 'M=D'], // Stores D into val pointed at by SP
    //Pop value and store it in the mem location pointed to by R13
    popAndStore = ['@SP', 'M=M-1', 'A=M', 'D=M', '@R13', 'A=M', 'M=D'];

  var mapping = {
    local: 'LCL',
    argument: 'ARG',
    this: 'THIS',
    that: 'THAT'
  };

  //Stores the calculated pointer in R13
  function storeSegmentPointer(segment, index) {

    //If it's static, all bets are off
    if (segment === 'static') {
      return ['@' + asmFileName + '.' + index, 'D=A', '@R13', 'M=D'];
    }

    var result = ['@' + index, 'D=A'];

    //Add segment starting points
    if (segment === 'temp') { result = result.concat('@5'); }
    else if (segment === 'pointer') { result = result.concat('@3'); }
    else { result = result.concat('@' + mapping[segment], 'A=M'); }

    //Store pointer in R13
    return result.concat('D=A+D', '@R13', 'M=D');
  }
  
  //PUSH
  if (cmdType === 'C_PUSH') {
    
    //Stores constant value in d register
    if (segment === 'constant') { result = result.concat('@' + index, "D=A" ); }
    
    //Set up the value POINTED at on the stack to be stored
    else { result = result.concat(storeSegmentPointer(segment, index), 'A=M', 'D=M'); }
    
    //Now store what's been put into D
    return result.concat(storeMemSP, incrementSP);
  } 

  //POP
  else if (cmdType === 'C_POP') { result = result.concat(storeSegmentPointer(segment, index), popAndStore); }
  
  return result;
}

/*
 * Helper functions
 */

//Fn that caches its own results to guarantee a unique label is created on each call.
//Pass it a word, e.g. 'tacos', and first receive 'tacos0', then 'tacos1', etc. on subsequent calls
function makeUniqueLabel(word) {
  var fn = makeUniqueLabel;
  fn.cache = fn.cache || {};
  if (word in fn.cache) {
    return word + (fn.cache[word] = fn.cache[word] + 1); 
  }
  return word + (fn.cache[word] = 0);
}

//Checks if the first argument matches any subsequent arguments
function anyEqual(firstArg, anotherArg, etc) {
  var args = [].slice.apply(arguments);
  for (var i = 1; i < args.length; i++) {
    if (args[0] === args[i]) { return true };
  }
  return false;
}

//Return command type based on first word (the command itself)
function getCommandType(firstWord) {
  if (anyEqual(firstWord, 'add', 'sub', 'neg', 'eq', 'gt', 'lt', 'and', 'or', 'not')) {
    return 'C_ARITHMETIC';
  } 
  else if (anyEqual(firstWord, 'push', 'pop', 'label', 'goto', 'if', 'function', 'return', 'call')){
    return 'C_' + firstWord.toUpperCase();
  }
}

/*
 * Execution: open the file, run it through everything, then write it.
 */

//Open original file
var file = fs.readFileSync(asmFilePath, 'utf8');

//Parse/translation party
var translated = writeCode(parse(cleanUp(file)));

//Write translated Hack assembly to file
fs.writeFileSync(asmFilePath.replace('vm', 'asm'), translated.join('\n'), 'utf8');
