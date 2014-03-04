#!/usr/local/bin/node

/*
 * Command line script that accepts one or more .jack files in the Jack language,
 * passed via command line, and compiles them to an intermediate representation VM language.
 *
 * To pass >1 file, pass the directory containing .jack files.
 * It will operate on and output a corresponding VM file for each class.
 *
 * Ex: >> main.js awesomejackfiles
 */

 var fs = require('fs'),
  path = require('path'),
  Tokenizer = require('./tokenizer'),
  Compiler = require('./compiler'); 

var inputPath = path.normalize(path.join(process.cwd(), process.argv[2])),
  inputExt = path.extname(inputPath),
  inputName = path.basename(inputPath).replace(inputExt, ''),
  JACK_EXT = '.jack',
  isDir = (inputExt === ''),
  psQueueue = [];

//Put either the individual file, or all the .jack files in the directory, into a queue
//for processing
if (isDir) {
  fs.readdirSync(inputPath).forEach(function(file) {
    if (path.extname(file) === JACK_EXT) {
      psQueueue.push(path.normalize(path.join(inputPath, file)));
    }
  });
} 
else {
  if (inputExt !== JACK_EXT) {
    throw "Hay this compiler is only for Jack files!"
  }
  psQueueue.push(inputPath);  
}

psQueueue.forEach(function(filePath) {
  //Create new tokenizer for each file in the queue and generate output
  var tokenizer = new Tokenizer(fs.readFileSync(filePath, 'utf8'));
  var tokenized = tokenizer.execute();

  //Compile tokenized stream.
  var compiler = new Compiler(tokenized);
  var output = compiler.execute();

  //Write file
  fs.writeFileSync(filePath.replace(JACK_EXT, '.vm'), output.join('\n'), 'utf8');
});
