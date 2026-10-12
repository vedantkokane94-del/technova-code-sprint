/**
 * Technova Code Sprint (SVIT Nashik)
 * 8-Question Daily Quizzes per Sprint Day (Days 1 to 9)
 * Used for 30% of each day's points: Quiz score = 30% * dayPoints * (correct / 8)
 */

export const SPRINT_QUIZZES = {
  1: [
    { id: 'd1_q1', question: "Which format specifier is used to read an integer in C using scanf?", options: ["%d", "%f", "%c", "%s"], correct: 0 },
    { id: 'd1_q2', question: "What is the standard stream used for console output in C++?", options: ["cin", "cout", "cerr", "clog"], correct: 1 },
    { id: 'd1_q3', question: "In Java, what must be the name of the public class containing the main method?", options: ["Program", "App", "Main", "Solution"], correct: 2 },
    { id: 'd1_q4', question: "Which function is used in Python to read a line from standard input?", options: ["scan()", "input()", "read()", "cin()"], correct: 1 },
    { id: 'd1_q5', question: "What is the size of a standard 'int' data type on a 64-bit GCC compiler?", options: ["2 bytes", "4 bytes", "8 bytes", "16 bytes"], correct: 1 },
    { id: 'd1_q6', question: "Which symbol is used for line comments in Python?", options: ["//", "/*", "#", "--"], correct: 2 },
    { id: 'd1_q7', question: "What is the return type of the main() function in standard C?", options: ["void", "int", "float", "char"], correct: 1 },
    { id: 'd1_q8', question: "In Python, which built-in function returns the data type of an object?", options: ["typeof()", "type()", "kind()", "class()"], correct: 1 }
  ],
  2: [
    { id: 'd2_q1', question: "Which operator is used to test logical equality in C, C++, Java, and Python?", options: ["=", "==", "===", ":="], correct: 1 },
    { id: 'd2_q2', question: "What is the outcome of the expression (5 % 2) in C/C++/Java/Python?", options: ["2.5", "2", "1", "0"], correct: 2 },
    { id: 'd2_q3', question: "Which statement is used to execute code when all 'if' and 'else if' conditions are false?", options: ["default", "else", "finally", "break"], correct: 1 },
    { id: 'd2_q4', question: "In Python, which keyword represents 'else if'?", options: ["elseif", "elif", "else if", "case"], correct: 1 },
    { id: 'd2_q5', question: "What does the ternary operator (? :) do in C, C++, and Java?", options: ["Iterates a loop", "Evaluates conditional expression inline", "Allocates memory", "Declares a pointer"], correct: 1 },
    { id: 'd2_q6', question: "What is the result of true && false (or True and False)?", options: ["true / True", "false / False", "null", "undefined"], correct: 1 },
    { id: 'd2_q7', question: "Which data types cannot be used in a traditional switch statement in C?", options: ["int", "char", "float", "short"], correct: 2 },
    { id: 'd2_q8', question: "What keyword in Python indicates a block with no action?", options: ["void", "empty", "pass", "skip"], correct: 2 }
  ],
  3: [
    { id: 'd3_q1', question: "Which loop construct guarantees execution of its body at least once in C/C++/Java?", options: ["for", "while", "do-while", "foreach"], correct: 2 },
    { id: 'd3_q2', question: "What keyword immediately terminates the innermost enclosing loop?", options: ["continue", "break", "return", "exit"], correct: 1 },
    { id: 'd3_q3', question: "What keyword skips the rest of the current iteration and begins the next loop cycle?", options: ["pass", "next", "continue", "skip"], correct: 2 },
    { id: 'd3_q4', question: "In Python, what does range(1, 5) produce?", options: ["[1, 2, 3, 4, 5]", "[1, 2, 3, 4]", "[0, 1, 2, 3, 4]", "[2, 3, 4, 5]"], correct: 1 },
    { id: 'd3_q5', question: "What is the time complexity of a loop executing N times with constant work per step?", options: ["O(1)", "O(log N)", "O(N)", "O(N^2)"], correct: 2 },
    { id: 'd3_q6', question: "What causes an infinite loop in programming?", options: ["Loop termination condition never evaluates to false", "Using a while loop instead of for", "Declaring counter as integer", "Writing code in functions"], correct: 0 },
    { id: 'd3_q7', question: "In C/C++, what does 'i++' versus '++i' mean?", options: ["Post-increment vs pre-increment", "Pre-increment vs post-increment", "Double increment", "Bitwise increment"], correct: 0 },
    { id: 'd3_q8', question: "What is the sum of integers from 1 to N computed in closed form?", options: ["N * (N - 1) / 2", "N * (N + 1) / 2", "N^2", "2 * N"], correct: 1 }
  ],
  4: [
    { id: 'd4_q1', question: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correct: 2 },
    { id: 'd4_q2', question: "To check if a number N is prime, what is the maximum divisor we need to test?", options: ["N - 1", "N / 2", "sqrt(N)", "log(N)"], correct: 2 },
    { id: 'd4_q3', question: "What is the time complexity of checking primality by testing divisors up to sqrt(N)?", options: ["O(1)", "O(log N)", "O(sqrt(N))", "O(N)"], correct: 2 },
    { id: 'd4_q4', question: "Which ancient algorithm efficiently finds all primes up to a limit N?", options: ["Euclid's Algorithm", "Sieve of Eratosthenes", "Dijkstra's Algorithm", "Binary Search"], correct: 1 },
    { id: 'd4_q5', question: "Why is 1 not considered a prime number by mathematical definition?", options: ["It is even", "A prime must have exactly two distinct positive divisors", "It has negative factors", "Historical convention only"], correct: 1 },
    { id: 'd4_q6', question: "How many even prime numbers exist?", options: ["None", "Exactly one (2)", "Infinitely many", "Two (2 and 4)"], correct: 1 },
    { id: 'd4_q7', question: "What is a nested loop's complexity when both outer and inner loops iterate N times?", options: ["O(N)", "O(N log N)", "O(N^2)", "O(2^N)"], correct: 2 },
    { id: 'd4_q8', question: "Which operator is used to verify divisibility (a divides b)?", options: ["b / a == 0", "b % a == 0", "b & a == 0", "b ^ a == 0"], correct: 1 }
  ],
  5: [
    { id: 'd5_q1', question: "Which algorithm computes the Greatest Common Divisor (GCD) of two numbers efficiently?", options: ["Euclidean Algorithm", "Kadane's Algorithm", "Floyd's Algorithm", "Prim's Algorithm"], correct: 0 },
    { id: 'd5_q2', question: "What is the relationship between GCD(a, b) and LCM(a, b)?", options: ["GCD * LCM = a + b", "GCD * LCM = a * b", "GCD + LCM = a * b", "GCD / LCM = a / b"], correct: 1 },
    { id: 'd5_q3', question: "How do you extract the last digit of an integer N in decimal base?", options: ["N / 10", "N % 10", "N >> 1", "N - 10"], correct: 1 },
    { id: 'd5_q4', question: "How do you remove the last digit of an integer N in integer arithmetic?", options: ["N % 10", "N / 10", "N - 1", "N * 10"], correct: 1 },
    { id: 'd5_q5', question: "What is the time complexity of Euclidean algorithm for GCD(a, b)?", options: ["O(a * b)", "O(a + b)", "O(log(min(a, b)))", "O(1)"], correct: 2 },
    { id: 'd5_q6', question: "What is a Palindrome number?", options: ["Divisible by 11", "Equal to the reverse of its digits", "Sum of divisors equals number", "Has only odd digits"], correct: 1 },
    { id: 'd5_q7', question: "What is an Armstrong number (for 3 digits)?", options: ["Sum of digits is 15", "Sum of cubes of its digits equals the number itself", "Divisible by 3 and 7", "Has alternating parity"], correct: 1 },
    { id: 'd5_q8', question: "What does GCD(0, a) equal for a > 0?", options: ["0", "1", "a", "Undefined"], correct: 2 }
  ],
  6: [
    { id: 'd6_q1', question: "What is the index of the first element in standard C, C++, Java, and Python arrays?", options: ["-1", "0", "1", "None"], correct: 1 },
    { id: 'd6_q2', question: "What is the time complexity to access an element by index in an array?", options: ["O(1)", "O(log N)", "O(N)", "O(N^2)"], correct: 0 },
    { id: 'd6_q3', question: "In Python, which negative index refers to the last element of a list?", options: ["-0", "-1", "-last", "-len()"], correct: 1 },
    { id: 'd6_q4', question: "What happens in C when you access an array beyond its allocated bounds?", options: ["Throws ArrayIndexOutOfBoundsException", "Undefined Behaviour", "Automatically resizes array", "Returns 0"], correct: 1 },
    { id: 'd6_q5', question: "In Java, what exception is thrown on invalid array index access?", options: ["SegmentationFault", "NullPointerException", "ArrayIndexOutOfBoundsException", "IndexError"], correct: 2 },
    { id: 'd6_q6', question: "How can you reverse an array in O(N) time and O(1) auxiliary space?", options: ["Two-pointer swapping from ends inwards", "Sorting the array descending", "Recursive copies", "Using a hash table"], correct: 0 },
    { id: 'd6_q7', question: "What dynamic array class is commonly used in C++ STL?", options: ["std::array", "std::vector", "std::list", "std::deque"], correct: 1 },
    { id: 'd6_q8', question: "In Python, what method adds an element to the end of a list?", options: ["push()", "add()", "append()", "insert()"], correct: 2 }
  ],
  7: [
    { id: 'd7_q1', question: "What is a recursive function?", options: ["A function that never returns", "A function that calls itself directly or indirectly", "A function with no arguments", "A function declared inline"], correct: 1 },
    { id: 'd7_q2', question: "What essential condition prevents infinite recursion and stack overflow?", options: ["Loop condition", "Base case", "Exception handler", "Static variable"], correct: 1 },
    { id: 'd7_q3', question: "Which memory region stores function call frames, local variables, and return addresses?", options: ["Heap", "Call Stack", "Data Segment", "BSS Segment"], correct: 1 },
    { id: 'd7_q4', question: "What is the base case for calculating Factorial n! recursively?", options: ["n == 0 or n == 1 return 1", "n == 2 return 2", "n < 0 return 0", "n == 10 return 10"], correct: 0 },
    { id: 'd7_q5', question: "What is the space complexity of calculating factorial recursively due to the call stack?", options: ["O(1)", "O(log N)", "O(N)", "O(N^2)"], correct: 2 },
    { id: 'd7_q6', question: "In C/C++, what does passing an argument by pointer/reference accomplish?", options: ["Allows function to modify the caller's variable without copy overhead", "Prevents function execution", "Forces variable into register", "Makes variable global"], correct: 0 },
    { id: 'd7_q7', question: "What is the Fibonacci sequence recurrence relation for n >= 2?", options: ["F(n) = F(n-1) * F(n-2)", "F(n) = F(n-1) + F(n-2)", "F(n) = 2 * F(n-1)", "F(n) = F(n-1) - F(n-2)"], correct: 1 },
    { id: 'd7_q8', question: "In Python, which keyword is used to define a function?", options: ["function", "fn", "def", "func"], correct: 2 }
  ],
  8: [
    { id: 'd8_q1', question: "What is the average and worst-case time complexity of Binary Search?", options: ["O(1)", "O(log N)", "O(N)", "O(N^2)"], correct: 1 },
    { id: 'd8_q2', question: "What crucial prerequisite must be satisfied before Binary Search can be applied?", options: ["Elements must be unique", "Array must be sorted", "Array size must be power of 2", "Elements must be positive"], correct: 1 },
    { id: 'd8_q3', question: "What is the worst-case time complexity of Bubble Sort and Selection Sort?", options: ["O(log N)", "O(N)", "O(N log N)", "O(N^2)"], correct: 3 },
    { id: 'd8_q4', question: "How does Binary Search update its search range if target is greater than mid element?", options: ["high = mid - 1", "low = mid + 1", "mid = mid / 2", "low = 0"], correct: 1 },
    { id: 'd8_q5', question: "Which sorting algorithm repeatedly picks the minimum element from the unsorted portion?", options: ["Bubble Sort", "Selection Sort", "Insertion Sort", "Merge Sort"], correct: 1 },
    { id: 'd8_q6', question: "What is the best-case time complexity of standard Bubble Sort with an early-exit swapped flag?", options: ["O(1)", "O(N)", "O(N log N)", "O(N^2)"], correct: 1 },
    { id: 'd8_q7', question: "Why is mid calculated as low + (high - low) / 2 instead of (low + high) / 2 in C/C++/Java?", options: ["Avoids integer overflow for large indices", "Faster bit shift", "Ensures rounding up", "Syntax requirement"], correct: 0 },
    { id: 'd8_q8', question: "What is the worst-case time complexity of Linear Search in an array of size N?", options: ["O(1)", "O(log N)", "O(N)", "O(N log N)"], correct: 2 }
  ],
  9: [
    { id: 'd9_q1', question: "What is the primary architectural purpose of a menu-driven program?", options: ["Provide an interactive CLI loop where users select actions until explicit exit", "Run faster on GPU", "Compile without warnings", "Hide code from debugger"], correct: 0 },
    { id: 'd9_q2', question: "In a menu loop, which construct cleanly handles multiple numeric or character menu choices?", options: ["switch-case (or if-elif ladder)", "goto statements", "while-break chain", "thread pool"], correct: 0 },
    { id: 'd9_q3', question: "What is modular programming?", options: ["Writing everything in a single 1000-line function", "Breaking code into small, reusable, single-responsibility functions", "Using only global variables", "Avoiding loops entirely"], correct: 1 },
    { id: 'd9_q4', question: "In C, what function is used to free dynamically allocated heap memory?", options: ["delete()", "free()", "destroy()", "release()"], correct: 1 },
    { id: 'd9_q5', question: "What is encapsulation in software design?", options: ["Bundling data with functions that manipulate that data, restricting direct access", "Making all variables public", "Writing code in assembly", "Printing output to file"], correct: 0 },
    { id: 'd9_q6', question: "How should unexpected user input (e.g. entering 'hello' when a menu number is expected) be handled?", options: ["Crash with segmentation fault", "Validate input and prompt again cleanly", "Exit program immediately", "Ignore all subsequent lines"], correct: 1 },
    { id: 'd9_q7', question: "What is the time complexity to insert an element at the end of a dynamic array/vector?", options: ["Amortized O(1)", "O(N)", "O(N^2)", "O(log N)"], correct: 0 },
    { id: 'd9_q8', question: "In Python, which block structure is used for safe exception handling?", options: ["try ... except", "try ... catch", "begin ... rescue", "guard ... else"], correct: 0 }
  ]
};

export const QUIZ_QUESTIONS = SPRINT_QUIZZES;

export const getQuizQuestionsForDay = (day) => {
  return SPRINT_QUIZZES[Number(day)] || SPRINT_QUIZZES[1];
};

export default SPRINT_QUIZZES;
