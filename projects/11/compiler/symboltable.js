var utils = require('./utils');

module.exports = SymTable;

function SymTable() {
  this.classData = {};
  this.subroutineData = {};
}

SymTable.prototype = {

  constructor: SymTable,
  
  //Wipes out subroutine scope
  startSubroutine: function() {
    this.subroutineData = {};
  },

  addIdentifier: function(name, type, kind) {
    if (utils.anyEqual(kind, 'arg', 'var')) {
      var idx = this.varCount(kind);
      if ( !(name in this.subroutineData) ){
        this.subroutineData[name] = {
          type: type,
          kind: kind,
          idx: idx
        };
        return idx; //just to be nice
      }
    } 
    else if (utils.anyEqual(kind, 'static', 'field')) {
      if ( !(name in this.classData) ){
        var idx = this.varCount(kind);
        this.classData[name] = {
          type: type,
          kind: kind,
          idx: idx
        };
        return idx; //just to be nice
      }
    }
  },

  //get identifier in currentest scope
  getIdentifier: function(name) {
    if (name in this.subroutineData) {
      return {
        type: this.subroutineData[name].type,
        kind: this.subroutineData[name].kind,
        idx: this.subroutineData[name].idx
      };
    }    
    else if (name in this.classData) {
      return {
        type: this.classData[name].type,
        kind: this.classData[name].kind,
        idx: this.classData[name].idx
      };
    }
  },

  //returns # of vars of given kind defined in current scope
  varCount: function(kind) {
    var count = 0,
      name;
    
    for (name in this.classData) {
      if (this.classData[name].kind === kind) {
        count++;
      }
    }

    for (name in this.subroutineData) {
      if (this.subroutineData[name].kind === kind) {
        count++;
      }
    }

    return count;

  }
}