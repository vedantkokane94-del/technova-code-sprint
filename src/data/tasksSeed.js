export const SPRINT_START_DATE = "14th October 2026";
export const SPRINT_END_DATE = "22nd October 2026";
export const SPRINT_ISSUE_DATE = "23rd October 2026";
export const EVENT_START_DATE = "14 Oct 2026";
export const EVENT_END_DATE = "22 Oct 2026";
export const EVENT_ISSUE_DATE = "23 Oct 2026";

// Section 2: Central Schedule Definition with explicit IST (+05:30) timestamps
// Day 1 unlocks on 14 October 2026 at 8:00 AM IST (2026-10-14T08:00:00+05:30 / 2026-10-14T02:30:00Z)
// Each subsequent day adds exactly 24 hours (8:00 AM IST)
export const SPRINT_UNLOCK_BASE_UTC = "2026-10-14T08:00:00+05:30";
export const SPRINT_CATCHUP_CLOSE_UTC = "2026-10-22T23:59:59+05:30"; // 11:59:59 PM IST, 22 Oct 2026

export const getDayUnlockTimeUtc = (day) => {
  const baseMs = Date.parse(SPRINT_UNLOCK_BASE_UTC);
  const dayOffsetMs = (Number(day) - 1) * 24 * 60 * 60 * 1000;
  return new Date(baseMs + dayOffsetMs).toISOString();
};

export const getDayDeadlineTimeUtc = (day) => {
  // Daily on-time submission closes at 11:59:59 PM IST (+05:30 / 18:29:59 UTC on same IST date)
  const unlockIso = getDayUnlockTimeUtc(day);
  const datePart = unlockIso.slice(0, 10);
  return new Date(`${datePart}T23:59:59+05:30`).toISOString();
};

export const isDayUnlocked = (day, currentTimeMs = Date.now()) => {
  const unlockMs = Date.parse(getDayUnlockTimeUtc(day));
  return currentTimeMs >= unlockMs;
};

export const getEffectiveSprintDay = (currentTimeMs = Date.now()) => {
  for (let d = 9; d >= 1; d--) {
    if (isDayUnlocked(d, currentTimeMs)) return d;
  }
  return 0; // Pre-sprint kickoff (before 14 Oct 2026, 8:00 AM IST)
};

export const SPRINT_SCHEDULE = [
  { day: 1, dateStr: "14 Oct 2026", weekday: "Wednesday", label: "Kickoff: Standard I/O & Variables", fullDate: "14th October 2026", isKickoff: true, unlockUtc: getDayUnlockTimeUtc(1) },
  { day: 2, dateStr: "15 Oct 2026", weekday: "Thursday", label: "Conditionals & Decision Logic", fullDate: "15th October 2026", unlockUtc: getDayUnlockTimeUtc(2) },
  { day: 3, dateStr: "16 Oct 2026", weekday: "Friday", label: "Iteration: Loops & Series", fullDate: "16th October 2026", unlockUtc: getDayUnlockTimeUtc(3) },
  { day: 4, dateStr: "17 Oct 2026", weekday: "Saturday", label: "Nested Loops & Number Theory", fullDate: "17th October 2026", unlockUtc: getDayUnlockTimeUtc(4) },
  { day: 5, dateStr: "18 Oct 2026", weekday: "Sunday", label: "Mathematical Logic & Digits", fullDate: "18th October 2026", unlockUtc: getDayUnlockTimeUtc(5) },
  { day: 6, dateStr: "19 Oct 2026", weekday: "Monday", label: "Array Structures & Traversal", fullDate: "19th October 2026", unlockUtc: getDayUnlockTimeUtc(6) },
  { day: 7, dateStr: "20 Oct 2026", weekday: "Tuesday", label: "Modular Functions & Recursion", fullDate: "20th October 2026", unlockUtc: getDayUnlockTimeUtc(7) },
  { day: 8, dateStr: "21 Oct 2026", weekday: "Wednesday", label: "Searching & Sorting Algorithms", fullDate: "21st October 2026", unlockUtc: getDayUnlockTimeUtc(8) },
  { day: 9, dateStr: "22 Oct 2026", weekday: "Thursday", label: "Capstone: Menu-Driven Application", fullDate: "22nd October 2026", isFinale: true, unlockUtc: getDayUnlockTimeUtc(9) }
];

export const EVENT_DAYS = SPRINT_SCHEDULE;

export const getSprintDaySchedule = (day) => {
  return SPRINT_SCHEDULE.find(s => s.day === Number(day)) || SPRINT_SCHEDULE[0];
};

export const SEED_TASKS = [
  {
    day: 1,
    title: "Standard I/O & Formatting",
    level: "Beginner",
    points: 5,
    programPoints: 3.5,
    quizPoints: 1.5,
    trackCategory: "C / C++ / Java / Python",
    description: "Write a program that reads a user string (name) and an integer (year) from standard input (stdin) and prints formatted welcome text to stdout.",
    requiredConcept: "Standard Input/Output formatting",
    hints: [
      "Use scanf / cin / Scanner / input() to read from standard input.",
      "Print exact formatted line matching output format e.g. 'Welcome <Name>! Sprint Year: <Year>'.",
      "Ensure trailing newlines match expected stdout."
    ],
    variants: {
      A: { name: "Single Word & Integer", instruction: "Read one word name and integer year; output 'Welcome <Name>! Sprint Year: <Year>'." },
      B: { name: "Uppercase Name", instruction: "Convert input name to uppercase before printing welcome message." },
      C: { name: "Double Newline Format", instruction: "Print name and sprint year on two distinct lines with clean label prefixes." }
    }
  },
  {
    day: 2,
    title: "Conditionals & Number Classification",
    level: "Beginner",
    points: 5,
    programPoints: 3.5,
    quizPoints: 1.5,
    trackCategory: "C / C++ / Java / Python",
    description: "Read an integer from stdin and classify whether it is Positive Even, Positive Odd, Negative Even, Negative Odd, or Zero Even.",
    requiredConcept: "if-else conditional branching and modulo arithmetic",
    hints: [
      "Use (n % 2 == 0) to verify even parity.",
      "Handle edge case for 0 explicitly.",
      "Check both sign (positive vs negative) and parity."
    ],
    variants: {
      A: { name: "Full Classification", instruction: "Output exact label: 'Positive Even', 'Positive Odd', 'Negative Even', 'Negative Odd', or 'Zero Even'." },
      B: { name: "Range Verification", instruction: "Additionally verify whether the number falls inside the interval [-1000, 1000]." },
      C: { name: "Divisibility by 5", instruction: "In addition to parity, print whether the number is also evenly divisible by 5." }
    }
  },
  {
    day: 3,
    title: "Loop Constructs & Series Accumulation",
    level: "Beginner",
    points: 8,
    programPoints: 5.6,
    quizPoints: 2.4,
    trackCategory: "C / C++ / Java / Python",
    description: "Read an integer N from stdin. Using an explicit loop construct (for / while), calculate and print the sum of integers from 1 up to N.",
    requiredConcept: "Loop construct (for or while loop)",
    hints: [
      "Initialize accumulator variable sum = 0 before entering loop.",
      "Loop from 1 to N, adding current index to accumulator.",
      "Handle N = 0 where sum is 0."
    ],
    variants: {
      A: { name: "Natural Number Sum", instruction: "Calculate sum of numbers from 1 to N using an explicit loop." },
      B: { name: "Even Number Sum", instruction: "Calculate sum of only even numbers from 2 up to N." },
      C: { name: "Square Sum Series", instruction: "Calculate sum of squares of numbers from 1 up to N (1² + 2² + ... + N²)." }
    }
  },
  {
    day: 4,
    title: "Nested Loops & Primality Testing",
    level: "Intermediate",
    points: 10,
    programPoints: 7.0,
    quizPoints: 3.0,
    trackCategory: "C / C++ / Java / Python",
    description: "Read an integer N from stdin and determine if N is a prime number. Output 'PRIME' or 'NOT PRIME'.",
    requiredConcept: "Nested loops or divisor testing loop with early exit",
    hints: [
      "Numbers less than or equal to 1 are NOT PRIME.",
      "2 is the only even prime number.",
      "Loop divisor i from 2 up to sqrt(N) to optimize efficiency."
    ],
    variants: {
      A: { name: "Standard Prime Check", instruction: "Check if N is prime; print 'PRIME' or 'NOT PRIME'." },
      B: { name: "Count Divisors", instruction: "Output the exact count of positive divisors of N alongside the prime status." },
      C: { name: "Next Prime Finder", instruction: "If N is not prime, print the immediately following prime number." }
    }
  },
  {
    day: 5,
    title: "Mathematical Logic & Digit Operations",
    level: "Intermediate",
    points: 12,
    programPoints: 8.4,
    quizPoints: 3.6,
    trackCategory: "C / C++ / Java / Python",
    description: "Read two positive integers A and B from stdin. Calculate and output their Greatest Common Divisor (GCD) using the Euclidean algorithm.",
    requiredConcept: "While loop with modulo Euclidean algorithm",
    hints: [
      "While B != 0, compute remainder R = A % B, set A = B, and B = R.",
      "When B reaches 0, A is the GCD.",
      "Ensure non-negative inputs."
    ],
    variants: {
      A: { name: "Euclidean GCD", instruction: "Compute GCD(A, B) using iterative or recursive Euclidean method." },
      B: { name: "GCD & LCM Pair", instruction: "Compute both GCD and LCM using formula (A * B) / GCD." },
      C: { name: "Digit Sum of GCD", instruction: "Compute the sum of individual digits of the resulting GCD." }
    }
  },
  {
    day: 6,
    title: "Array Data Structures & Traversal",
    level: "Intermediate",
    points: 12,
    programPoints: 8.4,
    quizPoints: 3.6,
    trackCategory: "C / C++ / Java / Python",
    description: "Read array size N followed by N integers. Find the minimum element, maximum element, and output the reversed array.",
    requiredConcept: "Array or List data structure",
    hints: [
      "Store numbers in an array or list of size N.",
      "Traverse once to track min and max values.",
      "Traverse backwards or use two pointers to print reversed order."
    ],
    variants: {
      A: { name: "Min, Max & Reversed", instruction: "Output: 'Min: <min> Max: <max> Reversed: <elements in reverse>'." },
      B: { name: "Second Largest Element", instruction: "Find and output the second distinct largest element in the array." },
      C: { name: "Zero-Filled Partition", instruction: "Move all zero elements to the end of the array while maintaining relative order." }
    }
  },
  {
    day: 7,
    title: "Modular Functions & Recursion",
    level: "Advanced",
    points: 13,
    programPoints: 9.1,
    quizPoints: 3.9,
    trackCategory: "C / C++ / Java / Python",
    description: "Implement at least two user-defined functions, including one recursive function, to calculate Factorial n! and the Nth Fibonacci number.",
    requiredConcept: "At least 2 user-defined functions and recursive function call",
    hints: [
      "Define distinct functions outside of main.",
      "Implement recursive factorial: if n <= 1 return 1, else return n * fact(n - 1).",
      "Format output cleanly: 'Fact: <val> Fibo: <val>'."
    ],
    variants: {
      A: { name: "Factorial & Fibonacci", instruction: "Compute both values using recursive function implementations." },
      B: { name: "Recursive Power Function", instruction: "Implement recursive power(base, exp) computing base^exp in O(log exp) time." },
      C: { name: "Tower of Hanoi Steps", instruction: "Print the total recursive move count and sequence for N disks." }
    }
  },
  {
    day: 8,
    title: "Searching & Sorting Algorithms",
    level: "Advanced",
    points: 15,
    programPoints: 10.5,
    quizPoints: 4.5,
    trackCategory: "C / C++ / Java / Python",
    description: "Read N integers followed by a search target key. Sort the array in ascending order and use Binary Search to find the target key.",
    requiredConcept: "Named Algorithm (Bubble/Selection sort nested loop with swap, or Binary Search)",
    hints: [
      "Implement a sorting pass e.g. Bubble sort with swap logic.",
      "Implement Binary Search with low, high, and mid pointers.",
      "Output: 'Sorted: <list> Found: YES' or 'Sorted: <list> Found: NO'."
    ],
    variants: {
      A: { name: "Sort & Binary Search", instruction: "Sort the array and report whether target is present with 'Found: YES' or 'Found: NO'." },
      B: { name: "Search Index Position", instruction: "Output the exact 0-indexed position where target was found in sorted array (-1 if absent)." },
      C: { name: "Count Occurrences", instruction: "Find count of duplicate target keys using binary search bounds." }
    }
  },
  {
    day: 9,
    title: "Capstone Project: Menu-Driven Application",
    level: "Capstone",
    points: 20,
    programPoints: 14.0,
    quizPoints: 6.0,
    trackCategory: "C / C++ / Java / Python",
    description: "Build an interactive menu-driven console application managing Student Records. Must have at least 3 user-defined functions and a continuous loop processing choices (1: Add Student, 2: Display All, 3: Exit).",
    requiredConcept: "At least 3 user-defined functions and interactive menu loop",
    hints: [
      "Define separate functions for addRecord(), displayRecords(), and computeStats().",
      "Use a while(1) / while(true) / do-while loop to read choices until option 3.",
      "Handle multiple student entries sequentially from stdin."
    ],
    variants: {
      A: { name: "Student Score Records", instruction: "Options: 1: Add Name & Score, 2: Display All Records, 3: Exit." },
      B: { name: "Bank Account Transactions", instruction: "Options: 1: Deposit, 2: Withdraw with balance check, 3: View Balance & Exit." },
      C: { name: "Library Book Inventory", instruction: "Options: 1: Add Book, 2: Search by Title, 3: View Count & Exit." }
    }
  }
];
