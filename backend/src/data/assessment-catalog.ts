export interface SeedQuestion {
  prompt: string
  topic: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  options: Array<{ id: string; text: string }>
  correctOptionId: string
  explanation: string
}

export interface SeedAssessment {
  slug: string
  title: string
  technology: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  topics: string[]
  certificateAvailable: boolean
  category: string
  description: string
  introduction: string
  durationSeconds: number
  passingScore: number
  maxAttempts: number
  questions: SeedQuestion[]
}

let questionIndex = 0
const q = (prompt: string, correct: string, wrong: [string, string, string], explanation: string): SeedQuestion => {
  const correctPosition = questionIndex++ % 4
  const choices = [...wrong]
  choices.splice(correctPosition, 0, correct)
  return {
    prompt,
    topic: 'Core concepts',
    difficulty: 'Intermediate',
    options: choices.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
    correctOptionId: String.fromCharCode(65 + correctPosition),
    explanation,
  }
}

export const assessmentCatalog: SeedAssessment[] = [
  {
    slug: 'cpp',
    title: 'C++ Fundamentals',
    technology: 'C++',
    difficulty: 'Intermediate',
    topics: ['Language fundamentals', 'Memory management', 'STL', 'Object-oriented programming'],
    certificateAvailable: true,
    category: 'Programming Languages',
    description: 'Assess core C++ language, memory, and standard library knowledge.',
    introduction: 'This timed assessment covers modern C++ fundamentals. Choose one best answer per question; a certificate is issued only for a passing score.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('Which declaration creates a constant reference to an integer?', 'const int& value = source;', ['int& const value = source;', 'const int value& = source;', 'int const* value = source;'], 'A const lvalue reference cannot modify the referred-to integer.'),
      q('What is the primary purpose of std::unique_ptr?', 'Exclusive ownership of a dynamically managed object.', ['Shared ownership with reference counting.', 'A non-owning observer pointer.', 'Automatic storage duration for a local variable.'], 'unique_ptr represents sole ownership and releases its resource when destroyed.'),
      q('Which operation is guaranteed to leave a moved-from standard string valid?', 'It remains valid but its value is unspecified.', ['It is always empty.', 'It becomes a null pointer.', 'It is destroyed immediately.'], 'Moved-from standard library objects remain valid, though their state is generally unspecified.'),
      q('What does the override specifier ensure on a virtual member function?', 'That it overrides a virtual function in a base class.', ['That the function cannot be called through a base pointer.', 'That the function is inlined.', 'That the function is overloaded by templates.'], 'override makes a mismatched signature a compile-time error.'),
      q('Which container provides average constant-time key lookup?', 'std::unordered_map', ['std::vector', 'std::list', 'std::array'], 'An unordered_map uses hashing and offers average O(1) lookup.'),
    ],
  },
  {
    slug: 'javascript',
    title: 'JavaScript Fundamentals',
    technology: 'JavaScript',
    difficulty: 'Intermediate',
    topics: ['Language fundamentals', 'Scope', 'Arrays', 'Promises'],
    certificateAvailable: true,
    category: 'Programming Languages',
    description: 'Check JavaScript fundamentals, asynchronous behavior, and modern syntax.',
    introduction: 'Questions cover JavaScript language behavior, promises, scope, and data handling.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('What does a function declared with the async keyword always return?', 'A Promise.', ['An iterator.', 'A generator object.', 'The raw return value without wrapping.'], 'Async functions return a Promise that fulfills with the returned value.'),
      q('Which declaration is block-scoped and cannot be redeclared in the same scope?', 'let', ['var', 'function', 'globalThis'], 'let is block-scoped and duplicate lexical declarations are syntax errors.'),
      q('What is the result of typeof null in JavaScript?', '"object"', ['"null"', '"undefined"', '"number"'], 'The typeof null result is a historical language quirk.'),
      q('Which method creates a new array by transforming every element?', 'map()', ['filter()', 'reduceRight()', 'includes()'], 'map returns a new array containing each callback result.'),
      q('When does Promise.all reject?', 'As soon as any input promise rejects.', ['Only after all promises fulfill.', 'When the first promise fulfills.', 'It never rejects.'], 'Promise.all rejects with the first rejection reason.'),
    ],
  },
  {
    slug: 'python',
    title: 'Python Fundamentals',
    technology: 'Python',
    difficulty: 'Beginner',
    topics: ['Syntax', 'Data structures', 'Context managers', 'Generators'],
    certificateAvailable: true,
    category: 'Programming Languages',
    description: 'Assess Python syntax, data structures, and runtime concepts.',
    introduction: 'This assessment focuses on practical Python language and standard-library fundamentals.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('Which Python type is immutable and commonly used as a dictionary key?', 'tuple', ['list', 'set', 'dict'], 'A tuple containing hashable values is immutable and hashable.'),
      q('What does the `with` statement commonly ensure for a file?', 'The file is closed when the managed block exits.', ['The file is opened in binary mode.', 'The file is deleted after reading.', 'The file is automatically compressed.'], 'A context manager performs cleanup when control exits its block.'),
      q('What is the result of `bool([])`?', 'False', ['True', 'None', 'It raises TypeError.'], 'Empty collections are falsey in Python.'),
      q('Which keyword defines a generator function that yields values lazily?', 'yield', ['await', 'emit', 'defer'], 'yield suspends a generator and produces a value to its caller.'),
      q('In a list comprehension, what does `[x * 2 for x in values]` produce?', 'A new list of doubled values.', ['A generator object.', 'A tuple of doubled values.', 'The original list modified in place.'], 'List comprehensions construct a new list.'),
    ],
  },
  {
    slug: 'react',
    title: 'React.js',
    technology: 'React',
    difficulty: 'Intermediate',
    topics: ['Components', 'Props', 'State', 'Hooks'],
    certificateAvailable: true,
    category: 'Frontend Development',
    description: 'Evaluate React component, state, and rendering fundamentals.',
    introduction: 'Questions cover React components, hooks, props, and list rendering.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('What is the purpose of a React key when rendering a list?', 'Help React identify which items changed, moved, or were removed.', ['Provide a CSS selector for the item.', 'Encrypt the item props.', 'Force every list item to remount each render.'], 'Stable keys let reconciliation match elements between renders.'),
      q('When should a component call a state setter returned by useState?', 'In response to an event or other component logic that needs an update.', ['During every render unconditionally.', 'Only inside a useEffect callback.', 'Only in the component constructor.'], 'State setters request a render with the updated state.'),
      q('What are props in a React component?', 'Inputs passed from a parent component.', ['Mutable global variables owned by React.', 'DOM event handlers only.', 'A replacement for JSX.'], 'Props are the read-only inputs a parent supplies to a child.'),
      q('What does useEffect with an empty dependency array generally do?', 'Runs its effect after the component first mounts.', ['Runs before every render.', 'Runs only when the component unmounts.', 'Prevents the component from rendering.'], 'An empty dependency list schedules the effect for mount (and cleanup on unmount).'),
      q('Why should a controlled input receive both value and onChange?', 'React state supplies its value and the handler updates that state.', ['To make it submit automatically.', 'To enable server-side rendering.', 'To prevent keyboard input entirely.'], 'Controlled fields derive their displayed value from state.'),
    ],
  },
  {
    slug: 'dsa',
    title: 'Data Structures & Algorithms',
    technology: 'Algorithms',
    difficulty: 'Advanced',
    topics: ['Complexity', 'Data structures', 'Trees', 'Graphs'],
    certificateAvailable: true,
    category: 'Data Structures & Algorithms',
    description: 'Test algorithmic complexity, data structures, and graph fundamentals.',
    introduction: 'Select the best answer. Questions focus on standard complexity and algorithm concepts.',
    durationSeconds: 2100, passingScore: 70, maxAttempts: 3,
    questions: [
      q('What is the time complexity of binary search on a sorted array?', 'O(log n)', ['O(n)', 'O(n log n)', 'O(1) in all cases'], 'Each comparison halves the remaining search interval.'),
      q('Which data structure naturally supports last-in, first-out access?', 'Stack', ['Queue', 'Binary search tree', 'Hash table'], 'A stack removes the most recently added element first.'),
      q('What is the worst-case time complexity of quicksort with consistently poor pivots?', 'O(n²)', ['O(log n)', 'O(n)', 'O(n log n) always'], 'Highly unbalanced partitions can produce quadratic work.'),
      q('Which traversal of a binary search tree visits keys in sorted order?', 'In-order traversal', ['Pre-order traversal', 'Level-order traversal', 'Reverse post-order traversal'], 'In-order traversal visits left subtree, node, then right subtree.'),
      q('Which algorithm finds shortest paths from one source when edge weights are non-negative?', 'Dijkstra’s algorithm', ['Depth-first search', 'Kruskal’s algorithm', 'Binary search'], 'Dijkstra’s algorithm relaxes edges using non-negative path costs.'),
    ],
  },
  {
    slug: 'sql',
    title: 'SQL Fundamentals',
    technology: 'SQL',
    difficulty: 'Beginner',
    topics: ['Queries', 'Joins', 'Aggregation', 'Constraints'],
    certificateAvailable: true,
    category: 'Databases',
    description: 'Assess relational query, aggregation, and integrity concepts.',
    introduction: 'This assessment covers common SQL querying and relational database behavior.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('Which clause filters grouped rows after aggregation?', 'HAVING', ['WHERE', 'ORDER BY', 'FROM'], 'HAVING applies conditions to groups after GROUP BY.'),
      q('Which join returns only rows with matching keys in both tables?', 'INNER JOIN', ['LEFT JOIN', 'CROSS JOIN', 'FULL OUTER JOIN'], 'INNER JOIN keeps rows satisfying the join condition on both sides.'),
      q('What does COUNT(column_name) exclude?', 'Rows where that column is NULL.', ['Rows where the value is zero.', 'Duplicate values.', 'Rows with a non-empty string.'], 'COUNT(expression) counts non-NULL values.'),
      q('What is the purpose of a primary key?', 'Uniquely identify each row in a table.', ['Sort rows permanently.', 'Allow duplicate identifiers.', 'Encrypt the table data.'], 'A primary key enforces unique, non-null row identity.'),
      q('Which command changes existing rows in a table?', 'UPDATE', ['ALTER', 'CREATE', 'GRANT'], 'UPDATE modifies values in rows matching its condition.'),
    ],
  },
  {
    slug: 'mongodb',
    title: 'MongoDB',
    technology: 'MongoDB',
    difficulty: 'Intermediate',
    topics: ['Documents', 'CRUD', 'Indexes', 'Aggregation'],
    certificateAvailable: true,
    category: 'Databases',
    description: 'Check MongoDB document modeling, queries, and aggregation knowledge.',
    introduction: 'Questions cover MongoDB documents, indexes, CRUD operations, and pipelines.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('What is the default unique identifier field on a MongoDB document?', '_id', ['id', 'key', 'objectId'], 'MongoDB documents use _id as their primary identifier.'),
      q('Which update operator increments a numeric field atomically?', '$inc', ['$push', '$setOnInsert', '$unset'], '$inc adds a specified amount to a numeric field.'),
      q('What is a common benefit of an index in MongoDB?', 'Faster query lookup at the cost of storage and write overhead.', ['Guaranteed smaller documents.', 'Automatic elimination of duplicates for every field.', 'Faster writes in all cases.'], 'Indexes can improve reads but consume resources and require maintenance on writes.'),
      q('Which aggregation stage filters input documents?', '$match', ['$project', '$sortByCount', '$replaceRoot'], '$match selects documents that satisfy its query predicate.'),
      q('What does the $lookup aggregation stage provide?', 'A left outer join with another collection.', ['A transaction rollback.', 'A text index.', 'A schema migration.'], '$lookup joins matching documents from a specified collection.'),
    ],
  },
  {
    slug: 'git-github',
    title: 'Git & GitHub',
    technology: 'Git & GitHub',
    difficulty: 'Beginner',
    topics: ['Version control', 'Branches', 'Remotes', 'Pull requests'],
    certificateAvailable: true,
    category: 'Tools & Version Control',
    description: 'Evaluate Git version-control fundamentals and GitHub collaboration.',
    introduction: 'Questions cover commits, branches, remotes, and collaborative pull requests.',
    durationSeconds: 1800, passingScore: 70, maxAttempts: 3,
    questions: [
      q('Which command creates a new commit from staged changes?', 'git commit', ['git status', 'git fetch', 'git branch'], 'git commit records the staged snapshot in repository history.'),
      q('What does `git fetch` do?', 'Downloads remote refs and objects without merging them into the current branch.', ['Deletes the remote branch.', 'Stages all local changes.', 'Creates a GitHub pull request.'], 'Fetch updates remote-tracking information but does not integrate changes automatically.'),
      q('What is a Git branch?', 'A movable reference to a commit.', ['A separate copy of Git itself.', 'A compressed archive of the repository.', 'A GitHub issue label.'], 'Branches are lightweight references that can advance as commits are added.'),
      q('What is the usual purpose of a GitHub pull request?', 'Propose and review changes before merging them into a target branch.', ['Permanently delete a repository.', 'Replace local commits with tags.', 'Change a commit author without history.'], 'Pull requests support collaboration, review, and merging.'),
      q('Which command shows the working tree and staging area status?', 'git status', ['git log', 'git remote', 'git init'], 'git status reports modified, staged, and untracked files.'),
    ],
  },
]

const questionTopics: Record<string, string[]> = {
  cpp: ['References and constness', 'Smart pointers', 'Move semantics', 'Virtual functions', 'STL containers'],
  javascript: ['Async functions', 'Block scope', 'Type coercion', 'Array methods', 'Promise combinators'],
  python: ['Immutable collections', 'Context managers', 'Truthiness', 'Generators', 'Comprehensions'],
  react: ['List reconciliation', 'State management', 'Component props', 'Effects', 'Controlled inputs'],
  dsa: ['Search complexity', 'Stacks', 'Sorting complexity', 'Tree traversal', 'Shortest paths'],
  sql: ['Aggregation', 'Joins', 'Null handling', 'Keys and constraints', 'Data modification'],
  mongodb: ['Document identity', 'Update operators', 'Indexing', 'Aggregation filtering', 'Collection joins'],
  'git-github': ['Commits', 'Remote synchronization', 'Branches', 'Pull requests', 'Working tree'],
}

for (const assessment of assessmentCatalog) {
  assessment.questions.forEach((question, index) => {
    question.topic = questionTopics[assessment.slug][index]
    question.difficulty = assessment.difficulty
  })
}
