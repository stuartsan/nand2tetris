#!/usr/local/bin/node

'use strict';

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
  path = require('path');

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
    switch(item.cmdType) {
      case 'C_ARITHMETIC': return writeArithmeticCmd(item).join('\n');
      case 'C_POP':       //Falling through on purpose, relax!
      case 'C_PUSH':  return writePushPopCmd(item).join('\n');
      case 'C_LABEL': return writeLabelCmd(item).join('\n');
      case 'C_GOTO': return writeGotoCmd(item).join('\n');
      case 'C_IF': return writeIfCmd(item).join('\n');
      case 'C_FUNCTION': return writeFunction(item).join('\n');
      case 'C_CALL': return writeCall(item).join('\n');
      case 'C_RETURN': return writeReturn(item).join('\n');
      default: throw 'Stop using nonsense VM commands!!1'
    }
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
      return ['@' + currentFileName + '.' + index, 'D=A', '@R13', 'M=D'];
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

//*****these 3 prob need mods to handle same label name from two fns
function writeLabelCmd(command) {  
  var labelName = command.arg1;
  return [ '(' + labelName + ')' ];
}

function writeGotoCmd(command) {
  var dest = command.arg1;
  return ['@' + dest, '0;JMP'];
}

function writeIfCmd(command) {
  var dest = command.arg1;
  //Pops top value, stores in D, jumps to dest if d != 0
  return ['@SP', 'M=M-1', 'A=M', 'D=M', '@' + dest, 'D;JNE']
}

function writeFunction(command) {
  var fnName = command.arg1,
    numVars = command.arg2,     //# of local variables fn uses
    declareLabel = ['(' + fnName + ')'],
    result = [declareLabel],
    initVar = writePushPopCmd({cmdType: 'C_PUSH', arg1: 'constant', arg2: 0});
    
    while (numVars > 0) {
      result = result.concat(initVar);
      numVars--;
    }

    return result;
}

function writeCall(command) {
  var fnName = command.arg1,
    args = command.arg2,    //# of args pushed onto stack
    returnSymbol = makeUniqueLabel(fnName + 'Return'),
    result = [],
    storeMemSP = ['@SP', 'A=M', 'M=D'], // Stores D into val pointed at by SP
    incrementSP = ['@SP', 'M=M+1'];

    //Push return address onto stack
    result = result.concat('@' +  returnSymbol, 'D=A', storeMemSP, incrementSP);

    //Push pointers onto stack
    result = result.concat(
      pushPointer('LCL'),
      pushPointer('ARG'),
      pushPointer('THIS'),
      pushPointer('THAT')
    );

    //Set ARG to SP - args - 5
    result = result.concat(
      '@' + args, 'D=A', '@SP', 'D=M-D', '@ARG', 'M=D', '@5', 'D=A', '@ARG', 'M=M-D'
    );

    //Set LCL to SP
    result = result.concat(
      '@SP', 'D=M', '@LCL', 'M=D'
    );

    //Jump to function
    result = result.concat(
      '@' + fnName, '0;JMP'
    );

    //Write return address label
    result = result.concat(
      '(' + returnSymbol + ')'
    );

    return result;

    function pushPointer(name) {
      return ['@' + name, 'D=M' ].concat(storeMemSP, incrementSP);
    }

}

function writeReturn(command) {
  var result = [];

  //Store FRAME in R14, temp var referencing LCL's value
  result = result.concat(
    ['@LCL', 'D=M', '@R14', 'M=D']
  );

  //Store return address in temp var R15
  result = result.concat(
    setBasePointer(5, 'R15')
  );

  //Pop top stack val into location pointed at by ARG
  result = result.concat(
    ['@SP', 'M=M-1', 'A=M', 'D=M', '@ARG', 'A=M', 'M=D']  
  );

  //Reposition SP to ARG+1
  result = result.concat(
    ['@1', 'D=A', '@ARG', 'D=M+D', '@SP', 'M=D']
  );

  //Set all the other virtual segment base pointers
  result = result.concat(
    setBasePointer(1, 'THAT'),
    setBasePointer(2, 'THIS'),
    setBasePointer(3, 'ARG'),
    setBasePointer(4, 'LCL')
  );

  //Goto return address
  result = result.concat(
    ['@R15', 'A=M', '0;JMP']
  );

  return result;

  function setBasePointer(count, storeWhere) {
    return ['@' + count, 'D=A', '@R14', 'D=M-D', 'A=D', 'D=M', '@' + storeWhere, 'M=D'];
  }

}

//Outputs bootstrap code
function writeInit() {
  return ['@256', 'D=A', '@SP', 'M=D'].concat(writeCall({arg1: 'Sys.init', arg2: 0}));
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
  else if (firstWord === 'if-goto') {
    return 'C_IF'
  }
  else if (anyEqual(firstWord, 'push', 'pop', 'label', 'goto', 'function', 'return', 'call')){
    return 'C_' + firstWord.toUpperCase();
  }
}

/*
 * Execution: open file(s), process, then write output.
 */

var inputPath = path.normalize(path.join(process.cwd(), process.argv[2])),
  inputExt = path.extname(inputPath),
  inputName = path.basename(inputPath).replace(inputExt, ''),
  VM_EXT = '.vm',
  INIT_FILE = 'Sys.vm',
  currentFileName = '',
  isDir = (inputExt === ''),
  psQueueue = [],
  output = [],
  outputPath = '';

//Add initialization code to beginning
output = output.concat( writeInit() );

//Put either the individual file, or all the .vm files in the directory, into a queue
//for processing
if (isDir) {
  fs.readdirSync(inputPath).forEach(function(file) {
    if (path.extname(file) === VM_EXT) {
      psQueueue.push(path.normalize(path.join(inputPath, file)));
    }
  });
} 
else {
  if (inputExt !== VM_EXT) {
    throw "Hay this translator is only for VM files!"
  }
  psQueueue.push(inputPath);  
}

//Sort so sys init file always at the top of the file for human convenience
psQueueue.sort(function(a, b){
  return path.basename(a) === INIT_FILE ? -1 : 1;
});

psQueueue.forEach(function(filePath) {
  //While processing each, currentFileName is set accordingly
  currentFileName = path.basename(filePath).replace(VM_EXT, '');
  output = output.concat(writeCode(parse(cleanUp(fs.readFileSync(filePath, 'utf8')))));
});

//Set up output path
outputPath = isDir ? path.join(inputPath, inputName + '.asm') : inputPath.replace('vm', 'asm');

//Write translated Hack assembly to file
fs.writeFileSync(outputPath, output.join('\n'), 'utf8');