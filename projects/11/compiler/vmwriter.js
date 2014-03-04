 module.exports = {
  
  writePush: function(segment, index) {
    return 'push ' + this.translateSegment(segment) + ' ' + index;
  },

  //see above
  writePop: function(segment, index) {
    return 'pop ' + this.translateSegment(segment) + ' ' + index;
  },

  //segments == const,arg,local,static,this,that,pointer,temp
  translateSegment: function(segment) {
    switch (segment) {
      case 'var': return 'local';
      case 'arg': return 'argument';
      case 'static': return 'tacos';
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
    return lookup[command];
  },

  writeLogic: function(command) {
    var lookup = {
      '-': 'neg',
      '~': 'not'
    };
    return lookup[command];
  },

  writeLabel: function(label) {
    return 'label ' + label; 
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

  //goto some label
  writeGoto: function(label) {
    return 'goto ' + label;
  },

  //goto some label IF stack value != 0
  writeIf: function(label) {
    return 'if-goto ' + label;
  },

  writeCall: function(name, nargs) {
    return 'call ' + name + ' ' + nargs;
  },

  writeFunction: function(name, nlocals) {
    return 'function ' + name + ' ' + ( nlocals || '' );
  },

  writeReturn: function() {
    return 'return';
  }

 };