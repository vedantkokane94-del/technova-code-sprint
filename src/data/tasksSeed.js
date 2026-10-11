export const SEED_TASKS = [
  {
    day: 1,
    title: "Profile Card",
    level: "Beginner",
    points: 10,
    trackCategory: "General (Web/App/Python/DSA)",
    description: "Create a clean personal Profile Card. Display your name, branch, at least 3 technical skills with badges, and a clickable link to your portfolio or LinkedIn profile.",
    bonus: "Add a smooth hover scale animation and an interactive copy-email button.",
    hints: [
      "Start with a centered card container using flexbox or grid.",
      "Use badge pills for your 3 skills with subtle background colors.",
      "Ensure your profile avatar or initials image has an appropriate aspect ratio."
    ],
    variants: {
      A: { name: "Light Theme", instruction: "Design with an elegant light theme: crisp white surface, soft gray typography, and subtle shadows." },
      B: { name: "Dark Theme", instruction: "Design with a modern dark theme: dark slate background, high-contrast crisp text, and neon/accent badges." },
      C: { name: "Colourful Theme", instruction: "Design with a vibrant colorful theme: dynamic gradient backdrop, playful badge borders, and warm accents." }
    }
  },
  {
    day: 2,
    title: "Simple Calculator",
    level: "Beginner",
    points: 10,
    trackCategory: "Web / App / Python",
    description: "Build a functional calculator that allows users to input two numbers and perform Addition (+), Subtraction (-), Multiplication (*), and Division (/), displaying the result cleanly.",
    bonus: "Add keyboard shortcuts (Enter to calculate, Esc to clear) or handle division by zero with a friendly alert.",
    hints: [
      "Keep track of the first input, operation, and second input in your state or variables.",
      "Check that division by zero returns 'Cannot divide by 0' instead of Infinity.",
      "Format decimal numbers up to 2 decimal places when displaying results."
    ],
    variants: {
      A: { name: "Two Numbers", instruction: "Provide two dedicated numeric inputs and 4 operator buttons (+, -, *, /) that compute immediately." },
      B: { name: "Add a Clear Button", instruction: "Include a prominent 'Clear / Reset' button that restores all fields and result to 0 instantly." },
      C: { name: "Add Square of a Number", instruction: "Include a special 'x²' button that immediately squares the currently selected number." }
    },
    dsaTrack: {
      title: "Reverse a String",
      description: "Write a function to reverse a string in-place or return a new reversed string without using built-in reverse helpers. Submit your code with 2-3 test cases.",
      bonus: "Achieve O(n) time and O(1) auxiliary space using a two-pointer approach.",
      hints: [
        "Convert the string to an array or character buffer if working in languages with immutable strings.",
        "Use two pointers: one at index 0 and another at length - 1, swapping characters until they meet.",
        "Consider test cases with an empty string, single character, and palindromes."
      ],
      variants: {
        A: { name: "Alpha-numeric String", instruction: "Test with alphanumeric strings: 'Technova2026!' and 'SVIT_Nashik'. Verify special characters retain position." },
        B: { name: "Sentence Word Reversal", instruction: "Reverse the order of words in a sentence: 'Learn Build Grow SVIT' becomes 'SVIT Grow Build Learn'." },
        C: { name: "Case-Preserving Reverse", instruction: "Reverse character positions while maintaining original capitalization index positions." }
      }
    }
  },
  {
    day: 3,
    title: "To-Do List",
    level: "Beginner",
    points: 10,
    trackCategory: "Web / App / Python",
    description: "Build an interactive To-Do List application. Users must be able to add a new task, mark a task as completed (strikethrough), and delete a task.",
    bonus: "Persist tasks in localStorage so they survive page reload.",
    hints: [
      "Each task item should be an object with an id, text, and completed boolean property.",
      "Use Array.prototype.filter to delete tasks without mutating previous state directly.",
      "Add an empty state message like 'No tasks yet! Time to learn something new.'"
    ],
    variants: {
      A: { name: "Plain List", instruction: "Standard minimal list with checkmark toggle and delete trash button for each item." },
      B: { name: "Add a Counter of Pending Tasks", instruction: "Display an active summary counter badge showing 'X of Y tasks completed'." },
      C: { name: "Add a Clear All Button", instruction: "Include a 'Clear Completed' or 'Clear All Tasks' button with a confirmation popup." }
    },
    dsaTrack: {
      title: "Find Largest Number in a List",
      description: "Write an algorithm to find the largest and second largest numbers in an unsorted list without using full list sorting. Provide 2-3 test cases.",
      bonus: "Accomplish the search in a single O(n) pass without duplicates skewing the second largest.",
      hints: [
        "Maintain two variables: max and secondMax, initialized to negative infinity.",
        "Iterate through array: if num > max, update both secondMax and max.",
        "Handle edge cases where all numbers are identical or list length is less than 2."
      ],
      variants: {
        A: { name: "Standard Integers", instruction: "Test with array containing positive, negative, and zero values e.g. [-5, 12, 0, 99, 43, 99]." },
        B: { name: "Floating Point Array", instruction: "Test with decimal floating point values e.g. [3.14, 2.71, 99.8, 99.81, 0.001]." },
        C: { name: "Stream Input", instruction: "Process inputs in a simulated streaming fashion as elements arrive one by one." }
      }
    }
  },
  {
    day: 4,
    title: "Mini Quiz",
    level: "Easy",
    points: 15,
    trackCategory: "Web / App / Python",
    description: "Create a 5-question multiple-choice interactive quiz. Show one question at a time or as a list, evaluate selections, and display the final score with congratulations at the end.",
    bonus: "Add a timer per question (e.g. 15 seconds) or show explanation on wrong answers.",
    hints: [
      "Store questions as an array of objects: { question, options: [], correctIndex }.",
      "Maintain a currentIndex and a score counter in state.",
      "Disable option buttons after the user selects an answer to prevent multiple points."
    ],
    variants: {
      A: { name: "Python Quiz", instruction: "Include 5 questions about Python fundamentals (data types, list comprehensions, slicing, functions, dicts)." },
      B: { name: "General Knowledge Quiz", instruction: "Include 5 questions on science, geography, and world milestones." },
      C: { name: "Technology and Computing Quiz", instruction: "Include 5 questions about computer history, web protocols, and modern computing pioneers." }
    },
    dsaTrack: {
      title: "Check for a Palindrome",
      description: "Implement a function to verify if a given sequence is a palindrome, ignoring non-alphanumeric characters and case. Provide 2-3 test cases.",
      bonus: "Implement it both iteratively and recursively.",
      hints: [
        "Clean the string first or skip non-alphanumeric characters on the fly.",
        "Compare characters at start and end pointers moving toward center.",
        "Check odd and even length strings like 'racecar' and 'noon'."
      ],
      variants: {
        A: { name: "Phrase Palindrome", instruction: "Validate sentences like 'A man, a plan, a canal: Panama!'." },
        B: { name: "Numeric Palindrome", instruction: "Determine if an integer is a palindrome without converting it to a string." },
        C: { name: "Linked List Palindrome", instruction: "Check if a singly linked list has palindromic node values." }
      }
    }
  },
  {
    day: 5,
    title: "Unit Converter",
    level: "Easy",
    points: 15,
    trackCategory: "Web / App / Python",
    description: "Build a responsive unit converter that allows the user to input a value in one unit, select units or toggle conversion direction, and see the calculated conversion in real-time.",
    bonus: "Add a swap button (reversible) to quickly invert the source and target units.",
    hints: [
      "Use a conversion multiplier or standard formula.",
      "Listen to input changes using onChange to update output instantaneously.",
      "Handle non-numeric and negative inputs gracefully."
    ],
    variants: {
      A: { name: "Kilometers and Miles", instruction: "Convert between kilometers (km) and miles (mi). 1 mile ≈ 1.60934 km." },
      B: { name: "Celsius and Fahrenheit", instruction: "Convert between Celsius (°C) and Fahrenheit (°F). °F = (°C × 9/5) + 32." },
      C: { name: "Kilograms and Pounds", instruction: "Convert between kilograms (kg) and pounds (lbs). 1 kg ≈ 2.20462 lbs." }
    },
    dsaTrack: {
      title: "Count Vowels and Consonants",
      description: "Write a function to count the number of vowels, consonants, digits, and special symbols in a given string. Provide 2-3 test cases.",
      bonus: "Return a dictionary/hashmap of frequency breakdown for each vowel.",
      hints: [
        "Maintain an uppercase or lowercase normalized lookup set for vowels: {a, e, i, o, u}.",
        "Check character ASCII code or regex for consonants.",
        "Handle whitespaces and punctuation cleanly."
      ],
      variants: {
        A: { name: "Simple Sentence", instruction: "Analyze multi-line text input with standard punctuation." },
        B: { name: "Code Snippet String", instruction: "Parse a code string and count vowels ignoring syntax characters." },
        C: { name: "Vowel Frequency Histogram", instruction: "Return exact counts of each individual vowel: a, e, i, o, u." }
      }
    }
  },
  {
    day: 6,
    title: "Notes or Expense List",
    level: "Easy",
    points: 15,
    trackCategory: "Web / App / Python",
    description: "Build a tracking application where users can add log entries with a title/category and numeric value (or date), view the total count or sum, and delete items. Saving to localStorage is an optional bonus.",
    bonus: "Implement filtering by category or sorting by highest amount.",
    hints: [
      "Calculate totals using Array.reduce on the items array.",
      "Format currencies or numbers nicely using Intl.NumberFormat."
    ],
    variants: {
      A: { name: "Expense List", instruction: "Track spending items with expense name, category (Food, Travel, Books), and amount in ₹. Display Grand Total." },
      B: { name: "Shopping List", instruction: "Track shopping items with item name, quantity, and estimated price, displaying total item count and cost." },
      C: { name: "Study-Hours Log", instruction: "Track daily study sessions with Subject, Hours studied, and Topic notes, calculating weekly total hours." }
    },
    dsaTrack: {
      title: "Factorial using Loop, then Recursion",
      description: "Implement factorial calculation using both an iterative loop and a recursive approach. Compare their performance and write tests for edge cases like 0! and 1!.",
      bonus: "Add memoization to optimize repeated calculations or prevent stack overflow for large n.",
      hints: [
        "Base case for recursion: if n <= 1 return 1.",
        "Beware of integer overflow for numbers greater than 20 in languages with fixed-width integers.",
        "Demonstrate test cases with n = 0, 1, 5, 10."
      ],
      variants: {
        A: { name: "Iterative vs Recursive Benchmark", instruction: "Print execution time comparison between iterative and recursive methods for n=15." },
        B: { name: "Trailing Zeroes in Factorial", instruction: "Calculate the number of trailing zeroes in n! without calculating the full factorial." },
        C: { name: "Memoized Factorial", instruction: "Implement factorial with a memoization table/cache to achieve O(1) lookup after first run." }
      }
    }
  },
  {
    day: 7,
    title: "Sign-up Form with Validation",
    level: "Easy-Medium",
    points: 20,
    trackCategory: "Web / App / Python",
    description: "Create a complete user Sign-up Form with robust client-side validation. Validate Full Name (min 3 chars), Email format (must contain @ and valid domain), and Password (minimum 8 characters, at least 1 digit). Display clear inline error messages.",
    bonus: "Add a password strength indicator meter (Weak, Medium, Strong).",
    hints: [
      "Store errors in an object matching field names: { name: '', email: '', password: '' }.",
      "Validate on blur or on form submission before proceeding.",
      "Provide visual cues: green border on valid fields, red border with error text on invalid fields."
    ],
    variants: {
      A: { name: "Add Show/Hide Password", instruction: "Include a clickable eye icon button next to password input to toggle visibility." },
      B: { name: "Add Confirm Password", instruction: "Include a Confirm Password field that actively checks if both passwords match." },
      C: { name: "Add Terms and Conditions Checkbox", instruction: "Require checking 'I accept the Code Sprint Terms and Conditions' before submission." }
    },
    dsaTrack: {
      title: "Remove Duplicates from a List",
      description: "Write an algorithm to remove duplicate elements from an array/list. First solve using a Set/Hashmap, and then solve in-place for a sorted array in O(1) extra space.",
      bonus: "Explain time and space complexity tradeoffs of both approaches.",
      hints: [
        "For sorted arrays, use a two-pointer technique: slow pointer keeps track of unique elements.",
        "For unsorted arrays, hash set provides O(n) average time complexity.",
        "Test with arrays with all duplicates, no duplicates, and negative numbers."
      ],
      variants: {
        A: { name: "In-Place Sorted Array", instruction: "Modify array in-place such that each unique element appears once, returning new length." },
        B: { name: "Preserve Original Order", instruction: "Remove duplicates from unsorted array while maintaining first-appearance order." },
        C: { name: "Allow at most 2 Duplicates", instruction: "Allow duplicates to appear at most twice (LeetCode 80 style) in-place." }
      }
    }
  },
  {
    day: 8,
    title: "Search Box with Live Filtering",
    level: "Medium",
    points: 20,
    trackCategory: "Web / App / Python",
    description: "Display a catalog list of 15 items with image/badge and descriptions. Include a search input that filters the list in real-time as the user types, with highlighted matching text and a 'No items found' state.",
    bonus: "Add category tag pills to filter alongside text search or add debounce to the search input.",
    hints: [
      "Use items.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).",
      "Show a clear 'X' button in the search bar to reset the filter instantly."
    ],
    variants: {
      A: { name: "Books Directory", instruction: "Catalog 15 technical and programming books with title, author, and year." },
      B: { name: "Movies / Tech Shows", instruction: "Catalog 15 iconic tech and sci-fi movies/documentaries with title, genre, and rating." },
      C: { name: "Food & Campus Canteen Menu", instruction: "Catalog 15 campus canteen food and snack items with name, price in ₹, and veg/non-veg tag." }
    },
    dsaTrack: {
      title: "Basic Stack: Check Balanced Brackets",
      description: "Implement a stack data structure or use an array stack to verify whether a string containing brackets (), {}, [] is properly balanced. Provide 2-3 test cases.",
      bonus: "Extend to handle full mathematical expressions containing operands and operators.",
      hints: [
        "Push opening brackets onto stack.",
        "When encountering a closing bracket, check if the stack top matches the corresponding pair.",
        "Ensure the stack is empty at the end for balanced string."
      ],
      variants: {
        A: { name: "Standard Parentheses and Brackets", instruction: "Validate expressions like '{[()]}' (valid) and '{[(])}' (invalid)." },
        B: { name: "Arithmetic Expression Validation", instruction: "Verify valid bracket placement in expressions like '((2 + 3) * [4 - 1])'." },
        C: { name: "Minimum Additions to Balance", instruction: "Calculate the minimum number of brackets needed to make an unbalanced string balanced." }
      }
    }
  },
  {
    day: 9,
    title: "My Mini Project (Capstone)",
    level: "Medium (Final)",
    points: 25,
    trackCategory: "General (Web/App/Python/DSA)",
    description: "Combine everything you have learned over the sprint into one self-directed mini project of your own idea. Must contain a short README with features & instructions, plus 2-3 screenshots. A live demo link or video is a bonus!",
    bonus: "Deploy live to Vercel/Netlify/GitHub Pages or record a 60-second video demo walk-through.",
    hints: [
      "Pick a real student problem (e.g. attendance tracker, notes manager, campus event planner, portfolio).",
      "Document your project clearly in README.md: Problem Statement, Tech Stack, How to Run, Screenshots.",
      "Polish your UI with proper spacing, clear typography, and responsive mobile layout."
    ],
    variants: {
      A: { name: "Productivity Tool", instruction: "Build a tool that boosts daily student efficiency (task manager, habit tracker, or syllabus checklist)." },
      B: { name: "Interactive Utility or Game", instruction: "Build an interactive learning game, typing speed tester, or canvas animation tool." },
      C: { name: "Campus Community Resource", instruction: "Build an SVIT campus resource finder, club showcase, or alumni mentorship directory." }
    }
  }
];
