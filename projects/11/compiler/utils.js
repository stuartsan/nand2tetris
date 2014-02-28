//Checks if the first argument matches any subsequent arguments
exports.anyEqual = function(firstArg, anotherArg, etc) {
  var args = [].slice.apply(arguments);
  for (var i = 1; i < args.length; i++) {
    if (args[0] === args[i]) { return true };
  }
  return false;
}