 module.exports = {
  //segment==const,arg,local,static,this,that,pointer,temp
  writePush: function(segment, index) {
    return 'push ' + segment + ' ' + index;
  },

  //see above
  writePop: function(segment, index) {
    return 'pop ' + segment + ' ' + index;
  },

  //command==add,sub,neg,eq,gt,lt,and,or,not
  writeArithmetic: function(command) {
    return command;
  },

  writeLabel: function(label) {
    return 'label ' + label; 
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
    return 'function ' + name + ' ' + nlocals;
  },

  writeReturn: function() {
    return 'return';
  }

 };