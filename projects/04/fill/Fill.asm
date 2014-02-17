// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input. 
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel. When no key is pressed, the
// program clears the screen, i.e. writes "white" in every pixel.

(RESET)
  @8192   //first 4 lns just setting @counter to data value
  D=A
  @counter
  M=D
  @16384  //set @screen's value to the memory address where screen map begins
  D=A
  @screen
  M=D
  @INFINITELOOPLOL
  0;JMP
(INFINITELOOPLOL)
  @counter
  D=M
  @RESET 
  D;JLE    //if counter is <= 0, reset it
  @KBD     //grab keyboard state
  D=M      //stash in d
  @COLORBLACK
  D;JNE    //jump to colorblack if keyboard state != 0
  @COLORWHITE
  0;JMP    //else jump to colorwhite
(COLORBLACK)
  @screen
  A=M
  M=-1
  @counter
  M=M-1
  @screen
  M=M+1
  @INFINITELOOPLOL
  0;JMP
(COLORWHITE)
  @screen
  A=M
  M=0
  @counter
  M=M-1
  @screen
  M=M+1
  @INFINITELOOPLOL
  0;JMP
