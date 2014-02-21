#!/usr/local/bin/node

/*
 * Command line script that accepts an .asm file in the Hack machine language
 * symbolic format, passed via command line, and converts it to binary machine code.
 *
 * Ex: >> assembler.js MyGreatProgram.asm
 * Creates new file MyGreatProgram.hack in same directory as MyGreatProgram.asm
 */

var fs = require('fs'),
  path = require('path'),
  asmFilePath = path.normalize(path.join(process.cwd(), process.argv[2]));

function cleanUp(data) {
  //Split file data into lines, remove carraige returns and comments
  var fileData = data.split('\n').map(function(item) {
    var result = item.indexOf('//') === -1 ? item : item.slice(0, item.indexOf('//'));
    return result.replace(/\r|\s/g, '');
  });
  //Strip out blank lines and return
  return fileData.filter(function(item) { return item.length; });
}

function parse(data) {
  return data.map(function(item) {
    //At this point we've stripped out L instructions so it's either A or C
    return item.indexOf('@') === 0 ? mapInstructionA(item) : mapInstructionC(item);
  });
}

function mapInstructionA(item) {
  //Strip @ symbol
  item = item.slice(item.indexOf('@') + 1);
  //Lookup if it's a symbol
  if (isNaN(parseInt(item))) { item = symtable.get(item); }
  //Convert number to binary and pad with zeros until it's 16 chars
  var result = parseInt(item, 10).toString(2);
  while (result.length < 16) result = '0' + result;
  return result;
}

function mapInstructionC(item) {
  var result = '111',
    pieces = { dest: '000', jump: '000', opcode: null },  //Defaults
    opcode = item;
   
  if (item.indexOf('=') !== -1) {
    pieces.dest = lookup.dest[item.slice(0, item.indexOf('='))];
    opcode = item.slice(item.indexOf('=') + 1);
  }
  if (item.indexOf(';') !== -1) {
    pieces.jump = lookup.jump[item.slice(item.indexOf(';') + 1)];
    opcode = opcode.slice(0, opcode.indexOf(';'));
  }
  pieces.opcode = lookup.opcode[opcode];  
  return result += pieces.opcode + pieces.dest + pieces.jump;
}

function processLabels(data) {
  var count = 0,
    result = [];
  data.forEach(function(item) {
    if (item.indexOf('(') === 0) {
      symtable.add(item.slice(1, -1), count);
    } else {
      result.push(item);
      count++;
    }
  });
  return result;
}

var lookup = {
  opcode: {
    '0': '0101010', '1': '0111111', '-1': '0111010', 'D': '0001100', 'A': '0110000',
    '!D': '0001101', '!A': '0110001', '-D': '0001111', '-A': '0110011', 'D+1': '0011111',
    'A+1': '0110111', 'D-1': '0001110', 'A-1': '0110010', 'D+A': '0000010', 'D-A': '0010011', 
    'A-D': '0000111', 'D&A': '0000000', 'D|A': '0010101', 'M': '1110000', '!M': '1110001',
    '-M': '1110011', 'M+1': '1110111', 'M-1': '1110010', 'D+M': '1000010', 'D-M': '1010011',
    'M-D': '1000111', 'D&M': '1000000', 'D|M': '1010101'
  },
  dest: { 
    '': '000', M: '001', D: '010', MD: '011', 
    A: '100', AM: '101', AD: '110', AMD: '111'
  },
  jump: {
    '' : '000', JGT: '001', JEQ: '010', JGE: '011', 
    JLT: '100', JNE: '101', JLE: '110', JMP: '111' 
  }
};

var symtable = {
  //When getting a symbol, if it doesn't yet exist add it then return its address
  get: function(symbol) {
    if (symbol in this.data) {
      return this.data[symbol];  
    } 
    this.add(symbol, this.availRAM);
    return this.availRAM++;
  },
  add: function(symbol, address) {
    this.data[symbol] = address;
  },
  availRAM: 16,
  data: {
    SP: 0, LCL: 1, ARG: 2, THIS: 3, THAT: 4, R0: 0, R1: 1, R2: 2, R3: 3,
    R4: 4, R5: 5, R6: 6, R7: 7, R8: 8, R9: 9, R10: 10, R11: 11, R12: 12,
    R13: 13, R14: 14, R15: 15, SCREEN: 0x4000, KBD: 0x6000
  }
};

//Open file, clean up
var cleaned = cleanUp(fs.readFileSync(asmFilePath, 'utf8'));

//Pass through twice: first process the labels by adding them to the symbol 
//table and then removing them from the result, then parse commands.
var parsed = parse(processLabels(cleaned));

//Write translated binary machine code to file
fs.writeFileSync(asmFilePath.replace('asm', 'hack'), parsed.join('\n'), 'utf8');
