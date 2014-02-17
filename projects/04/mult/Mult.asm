// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Mult.asm

// Multiplies R0 and R1 and stores the result in R2.
// (R0, R1, R2 refer to RAM[0], RAM[1], and RAM[3], respectively.)
  
  @R2    //grab memory address for result
  M=0    //initialize result to 0
(LOOP)
  @R1    //grab second num
  D=M    //set d to second num
  @END
  D;JLE  //if second num <=0, jump to end
  @R0    //grab first num
  D=M    //set d to first num
  @R2    //grab result
  M=M+D  //result += first num
  @R1    //grab second num
  M=M-1  //second num--
  @LOOP
  0;JMP  //loop again
(END)
  @END
  0;JMP
