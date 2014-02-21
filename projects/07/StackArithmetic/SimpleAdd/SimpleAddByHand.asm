// VM Tranlation
// Must first push two items onto the 'stack' and adjust the stack pointer accordingly
// Then add those two items and push that answer back on the stack, also adjusting SP accordingly

//First push cmd
@7
D=A  	// store in d
@SP  	// put stack pointer (address 0, val 256) on A reg
A=M  	// store value of SP (256) in A reg
M=D     // store constant above (7) in mem at address 256
@SP 	// increment stack pointer value
M=M+1
//Second push cmd
@8   	// pass in constant num
D=A  	// store in d
@SP  	// put stack pointer (address 0, val 257) on A reg
A=M  	// store value of SP (256) in A reg
M=D     // store constant above (8) in mem at address 257

@SP 	// increment stack pointer value
M=M+1

//Add cmd
@SP     //decrement stack pointer
M=M-1
A=M
D=M     //store popped value in D
@SP
M=M-1   //decrement stack pointer
A=M
M=D+M   //store computation's result
@SP     //increment stack pointer
M=M+1