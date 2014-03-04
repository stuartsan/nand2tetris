module.exports = VmWriter;

function VmWriter() {
  this.output = [];
}

 VmWriter.prototype = {

  appendOutput: function(item) {
    this.output = this.output.concat(item);
  },
  
  writePush: function(segment, index) {
    this.appendOutput('push ' + this.translateSegment(segment) + ' ' + index);
  },

  //see above
  writePop: function(segment, index) {
    this.appendOutput('pop ' + this.translateSegment(segment) + ' ' + index);
  },

  //segments == const,arg,local,static,this,that,pointer,temp
  translateSegment: function(segment) {
    switch (segment) {
      case 'var': return 'local';
      case 'arg': return 'argument';
      case 'static': return 'static';
      case 'field': return 'this';
      default: return segment;
    }
  },

  //command==add,sub,neg,eq,gt,lt,and,or,not
  writeArithmetic: function(command) {
    var lookup = {
      '+': 'add', 
      '-': 'sub',
      '*': 'call Math.multiply 2',
      '/': 'call Math.divide 2',  
      '&': 'and', 
      '|': 'or',
      '<': 'lt',
      '>': 'gt', 
      '=': 'eq'
    };
    this.appendOutput(lookup[command]);
  },

  writeLogic: function(command) {
    var lookup = {
      '-': 'neg',
      '~': 'not'
    };
    this.appendOutput(lookup[command]);
  },

  writeLabel: function(label) {
    this.appendOutput('label ' + label); 
  },

  //Caches its own results to guarantee a unique label is created on each call.
  //Pass it a word, e.g. 'tacos', and first receive 'tacos0', then 'tacos1', etc. on subsequent calls
  getUniqueLabel: function(word) {
    var fn = this.getUniqueLabel;
    fn.cache = fn.cache || {};
    if (word in fn.cache) {
      return word + (fn.cache[word] = fn.cache[word] + 1); 
    }
    return word + (fn.cache[word] = 0);
  },

  writeGoto: function(label) {
    this.appendOutput('goto ' + label);
  },

  writeIf: function(label) {
    this.appendOutput('if-goto ' + label);
  },

  writeCall: function(name, nargs) {
    this.appendOutput('call ' + name + ' ' + nargs);
  },

  writeFunction: function(name, nlocals) {
    this.appendOutput('function ' + name + ' ' + ( nlocals || '' ));
  },

  writeReturn: function() {
    this.appendOutput('return');
  }

 };