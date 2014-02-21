//First push cmd
@17
D=A  	// store in d
@SP  	// put stack pointer (address 0, val 256) on A reg
A=M  	// store value of SP (256) in A reg
M=D     // store constant above (7) in mem at address 256
@SP 	// increment stack pointer value
M=M+1

//Second push cmd
@17   	// pass in constant num
D=A  	// store in d
@SP  	// put stack pointer (address 0, val 257) on A reg
A=M  	// store value of SP (256) in A reg
M=D     // store constant above (8) in mem at address 257

@SP 	// increment stack pointer value
M=M+1

//Eq cmd
@SP     //decrement stack pointer
M=M-1
A=M
D=M     //store popped value in D
@SP	    //decrement stack pointer
M=M-1   
A=M      

D=D-M   //store computation's result (if eq, should be 0)
@SETTRUE0
D;JEQ
@SETFALSE0
D;JNE
(SETTRUE0)
	@SP
	A=M
	M=-1
	@SP   
	M=M+1
	@CONTINUE0
	0;JMP
(SETFALSE0)
	@SP
	A=M
	M=0
	@SP   
	M=M+1
	@CONTINUE0
	0;JMP
(CONTINUE0)


//First push cmd
@17
D=A  	// store in d
@SP  	// put stack pointer (address 0, val 256) on A reg
A=M  	// store value of SP (256) in A reg
M=D     // store constant above (7) in mem at address 256
@SP 	// increment stack pointer value
M=M+1

//Second push cmd
@16   	// pass in constant num
D=A  	// store in d
@SP  	// put stack pointer (address 0, val 257) on A reg
A=M  	// store value of SP (256) in A reg
M=D     // store constant above (8) in mem at address 257

@SP 	// increment stack pointer value
M=M+1

//Eq cmd
@SP     //decrement stack pointer
M=M-1

A=M
D=M     //store popped value in D

@SP	    //decrement stack pointer
M=M-1   

A=M      
D=D-M   //store computation's result (if eq, should be 0)

@SETTRUE1
D;JEQ
@SETFALSE1
0;JMP
(SETTRUE1)
	@SP
	A=M
	M=-1
	@SP   
	M=M+1
	@CONTINUE1
	0;JMP
(SETFALSE1)
	@SP
	A=M
	M=0
	@SP   
	M=M+1
	@CONTINUE1
	0;JMP
(CONTINUE1)


