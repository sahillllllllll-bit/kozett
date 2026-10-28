import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSummary,
  EarnedCertificate,
} from '../types'

const categoryOptions = [
  'Programming Languages',
  'Frontend Development',
  'Backend Development',
  'Full Stack Development',
  'Data Structures & Algorithms',
  'Databases',
  'Cloud Computing',
  'DevOps',
  'AI & Machine Learning',
  'Computer Science',
  'Tools & Version Control',
]

const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2'
const selectClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className='rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200' role='alert'>
      <p>{message}</p>
      {onRetry ? (
        <button type='button' onClick={onRetry} className='mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold transition hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/50'>
          Try again
        </button>
      ) : null}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='11' cy='11' r='7' />
      <path d='m20 20-4-4' />
    </svg>
  )
}

function CertificateIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z' />
      <path d='M14.5 3.5v5h5M8 12h8M8 15h5' />
      <circle cx='16.5' cy='17' r='2.2' />
      <path d='m15.1 18.7-.5 2.3 1.9-1 1.8 1-.5-2.3' />
    </svg>
  )
}

function TechnologyMark({ title }: { title: string }) {
  const mark = title.toLowerCase().includes('javascript') ? 'JS'
    : title.toLowerCase().includes('typescript') ? 'TS'
      : title.toLowerCase().includes('python') ? 'Py'
        : title.toLowerCase().includes('react') ? '⚛'
          : title.toLowerCase().includes('mongo') ? 'M'
            : title.toLowerCase().includes('sql') ? 'SQL'
              : title.toLowerCase().includes('git') ? '⌘'
                : title.toLowerCase().includes('c++') ? 'C++'
                  : title.toLowerCase().includes('java') ? 'J'
                    : title.toLowerCase().includes('algorithm') || title.toLowerCase().includes('data structure') ? 'DSA'
                      : title.slice(0, 2).toUpperCase()

  return (
    <span className='inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-700/20 bg-cyan-50 text-sm font-black tracking-tight text-cyan-800 shadow-[0_0_20px_rgba(8,145,178,0.08)] dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200'>
      {mark}
    </span>
  )
}

export function CertificatesPage() {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [sort, setSort] = useState('title')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void api.assessments().then((response) => {
      if (!cancelled) setAssessments(response.assessments)
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load assessments.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadKey])

  const visibleAssessments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const results = assessments.filter((assessment) => {
      const matchesText = !normalizedQuery || [
        assessment.title,
        assessment.technology,
        assessment.category,
        ...assessment.topics,
      ].some((field) => field.toLocaleLowerCase().includes(normalizedQuery))
      const matchesCategory = category === 'all' || assessment.category === category
      const matchesDifficulty = difficulty === 'all' || assessment.difficulty === difficulty
      return matchesText && matchesCategory && matchesDifficulty
    })
    return results.sort((left, right) => sort === 'difficulty'
      ? left.difficulty.localeCompare(right.difficulty) || left.title.localeCompare(right.title)
      : left.title.localeCompare(right.title))
  }, [assessments, category, difficulty, query, sort])

  return (
    <section className='mx-auto min-h-[70vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8'>
      <header className='relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40 sm:p-9'>
        <div aria-hidden='true' className='pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl' />
        <div className='relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-cyan-800 dark:text-cyan-300'>Kozett · Learn to prove it</p>
            <h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl'>Kozett Certification Academy</h1>
            <p className='mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300'>Learn. Test your skills. Earn certificates that showcase what you know.</p>
          </div>
          <Link to='/my-certificates' className={`${buttonClass} w-full shrink-0 sm:w-auto`}>
            <CertificateIcon />
            Your Certificates
          </Link>
        </div>
      </header>

      <div className='mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_190px_180px] lg:items-end'>
        <div>
          <label htmlFor='academy-search' className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>Explore assessments</label>
          <div className='relative'>
            <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500'><SearchIcon /></span>
            <input
              id='academy-search'
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search technologies, programming languages, and assessments...'
              className='w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
            />
          </div>
        </div>
        <div>
          <label htmlFor='academy-category' className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>Category</label>
          <select id='academy-category' value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
            <option value='all'>All categories</option>
            {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor='academy-difficulty' className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>Difficulty</label>
          <select id='academy-difficulty' value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={selectClass}>
            <option value='all'>All levels</option>
            <option value='Beginner'>Beginner</option>
            <option value='Intermediate'>Intermediate</option>
            <option value='Advanced'>Advanced</option>
          </select>
        </div>
        <div>
          <label htmlFor='academy-sort' className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>Sort by</label>
          <select id='academy-sort' value={sort} onChange={(event) => setSort(event.target.value)} className={selectClass}>
            <option value='title'>Alphabetical</option>
            <option value='difficulty'>Difficulty</option>
          </select>
        </div>
      </div>

      <p className='mt-5 text-sm text-slate-600 dark:text-slate-300' aria-live='polite'>
        {visibleAssessments.length} {visibleAssessments.length === 1 ? 'assessment' : 'assessments'} available
      </p>
      {loading ? (
        <div className={`${panelClass} mt-4 text-sm text-slate-600 dark:text-slate-300`} role='status'>Loading academy assessments...</div>
      ) : error ? (
        <div className='mt-4'><ErrorMessage message={`Unable to load assessments: ${error}`} onRetry={() => setReloadKey((current) => current + 1)} /></div>
      ) : visibleAssessments.length ? (
        <div className='mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {visibleAssessments.map((assessment) => (
            <article key={assessment.id} className={`${panelClass} flex min-h-[280px] flex-col hover:border-cyan-600/50 hover:shadow-md dark:hover:border-cyan-400/40`}>
              <div className='flex items-start gap-3'>
                <TechnologyMark title={assessment.technology} />
                <div className='min-w-0'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300'>{assessment.category}</p>
                  <h2 className='mt-1 text-lg font-bold text-slate-950 dark:text-white'>{assessment.title}</h2>
                </div>
              </div>
              <p className='mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300'>{assessment.description}</p>
              <div className='mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300'>
                <span className='rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800'>{assessment.difficulty}</span>
                <span className='rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800'>{assessment.questionCount} questions</span>
                <span className='rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800'>{assessment.timeLimitMinutes} min</span>
              </div>
              <div className='mt-auto flex items-center justify-between gap-3 pt-5'>
                <div>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>Pass: {assessment.passingScore}%</p>
                  <p className='mt-1 text-xs font-medium text-cyan-800 dark:text-cyan-300'>
                    {assessment.certificateAvailable ? 'Kozett certificate on pass' : 'Certificate unavailable'}
                  </p>
                </div>
                <Link to={`/certificates/${encodeURIComponent(assessment.slug)}`} className={buttonClass}>Explore assessment</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={`${panelClass} mt-4 border-dashed py-10 text-center`}>
          <h2 className='font-semibold text-slate-950 dark:text-white'>No assessments found</h2>
          <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>Try a different search, category, or difficulty.</p>
        </div>
      )}
      <p className='mt-8 text-xs leading-5 text-slate-500 dark:text-slate-400'>Kozett assessment certificates recognize completion of an in-platform skill assessment. They are not third-party accreditations or professional licenses.</p>
    </section>
  )
}

export function AssessmentDetailsPage() {
  const { assessmentSlug = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState<AssessmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api.assessment(assessmentSlug).then((response) => {
      if (!cancelled) setAssessment(response.assessment)
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load this assessment.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [assessmentSlug])

  async function startAssessment() {
    if (!user) {
      const destination = `/certificates/${encodeURIComponent(assessmentSlug)}/test`
      navigate(`/login?redirect=${encodeURIComponent(destination)}`)
      return
    }
    setStarting(true)
    setError(null)
    try {
      navigate(`/certificates/${encodeURIComponent(assessmentSlug)}/test`)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start this assessment.')
      setStarting(false)
    }
  }

  if (loading) return <PageMessage>Loading assessment details...</PageMessage>
  if (error || !assessment) return <PageMessage error={error ?? 'Assessment not found.'}><Link to='/certificates' className='mt-4 inline-flex text-sm font-semibold text-cyan-800 dark:text-cyan-300'>Back to the academy</Link></PageMessage>

  return (
    <section className='mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8'>
      <Link to='/certificates' className='text-sm font-semibold text-cyan-800 hover:text-cyan-600 dark:text-cyan-300'>← Academy</Link>
      <article className={`${panelClass} mt-5 p-6 sm:p-9`}>
        <div className='flex items-start gap-4'>
          <TechnologyMark title={assessment.technology} />
          <div>
            <p className='text-sm font-semibold text-cyan-800 dark:text-cyan-300'>{assessment.category}</p>
            <h1 className='mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white'>{assessment.title}</h1>
            <p className='mt-3 leading-7 text-slate-600 dark:text-slate-300'>{assessment.description}</p>
          </div>
        </div>
        <div className='mt-7 grid gap-3 sm:grid-cols-3'>
          <Stat label='Questions' value={`${assessment.questionCount}`} />
          <Stat label='Time limit' value={`${assessment.timeLimitMinutes} minutes`} />
          <Stat label='Passing score' value={`${assessment.passingScore}%`} />
        </div>
        <section className='mt-7'>
          <h2 className='font-semibold text-slate-950 dark:text-white'>Topics covered</h2>
          <ul className='mt-3 flex flex-wrap gap-2'>
            {assessment.topics.map((topic) => <li key={topic} className='rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200'>{topic}</li>)}
          </ul>
        </section>
        <div className='mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between'>
          <p className='max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300'>Your answers are scored securely after submission. Passing earns a Kozett-issued skill assessment certificate; it is not a third-party accreditation.</p>
          <button type='button' disabled={starting} onClick={() => void startAssessment()} className={`${buttonClass} shrink-0 disabled:cursor-wait disabled:opacity-60`}>
            {starting ? 'Starting...' : 'Start Assessment'}
          </button>
        </div>
        {error ? (
          <div className='mt-4' role='alert'>
            <p className='text-sm text-red-700 dark:text-red-300'>{error}</p>
            
          </div>
        ) : null}
      </article>
    </section>
  )
}

function PageMessage({ children, error }: { children?: React.ReactNode; error?: string }) {
  return (
    <section className='mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8'>
      {error ? <ErrorMessage message={error} /> : <div className={`${panelClass} text-sm text-slate-600 dark:text-slate-300`} role='status'>{children ?? 'Loading...'}</div>}
      {error ? children : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80'>
      <p className='text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'>{label}</p>
      <p className='mt-1 text-lg font-bold text-slate-950 dark:text-white'>{value}</p>
    </div>
  )
}

export function AssessmentTestPage() {
  const { assessmentSlug = '' } = useParams()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null)
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [timeExpired, setTimeExpired] = useState(false)
  const [timerNow, setTimerNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const answersRef = useRef(answers)
  answersRef.current = answers

  useEffect(() => {
    let cancelled = false
    const attemptStorageKey = `kozett-assessment-attempt:${assessmentSlug}`
    const answersStorageKey = `${attemptStorageKey}:answers`
    async function initialize() {
      setLoading(true)
      setError(null)
      try {
        const stored = sessionStorage.getItem(attemptStorageKey)
        let activeAttempt: AssessmentAttempt
        if (stored) {
          activeAttempt = JSON.parse(stored) as AssessmentAttempt
          if (Date.parse(activeAttempt.endsAt) <= Date.now()) {
            throw new Error('This assessment attempt has expired. Return to the introduction to start again.')
          }
          const questionResponse = await api.assessmentQuestions(activeAttempt.id)
          if (!cancelled) {
            const savedAnswers = sessionStorage.getItem(answersStorageKey)
            if (savedAnswers) {
              const restoredAnswers = JSON.parse(savedAnswers) as Record<string, string>
              answersRef.current = restoredAnswers
              setAnswers(restoredAnswers)
            }
            setAttempt(activeAttempt)
            setQuestions(questionResponse.questions)
          }
        } else {
          const response = await api.startAssessment(assessmentSlug)
          activeAttempt = response.attempt
          sessionStorage.setItem(attemptStorageKey, JSON.stringify(activeAttempt))
          const questionResponse = await api.assessmentQuestions(activeAttempt.id)
          if (!cancelled) {
            setAttempt(activeAttempt)
            setQuestions(questionResponse.questions)
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to start the assessment.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [assessmentSlug])

  async function submit(isExpired = false) {
    if (!attempt || submitting) return
    const unansweredIndexes = questions
      .map((question, index) => answersRef.current[question.id] ? -1 : index)
      .filter((index) => index >= 0)
    if (!isExpired && unansweredIndexes.length) {
      setCurrentIndex(unansweredIndexes[0])
      setError('Answer every question before submitting. Use the question review buttons to find unanswered items.')
      return
    }
    if (!isExpired && !window.confirm('Submit your assessment now? You cannot change your answers after submission.')) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await api.submitAssessment(attempt.id, answersRef.current)
      sessionStorage.removeItem(`kozett-assessment-attempt:${assessmentSlug}`)
      sessionStorage.removeItem(`kozett-assessment-attempt:${assessmentSlug}:answers`)
      navigate(`/certificates/${encodeURIComponent(assessmentSlug)}/results/${encodeURIComponent(response.result.id)}`, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your assessment. Your answers are preserved; retry when you are connected.')
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!attempt || submitting || timeExpired) return
    const timer = window.setInterval(() => {
      const now = Date.now()
      setTimerNow(now)
      if (Date.parse(attempt.endsAt) <= now) {
        window.clearInterval(timer)
        setTimeExpired(true)
        void submit(true)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [attempt, submitting, timeExpired])

  const remainingSeconds = attempt ? Math.max(0, Math.floor((Date.parse(attempt.endsAt) - timerNow) / 1000)) : 0
  const currentQuestion = questions[currentIndex]

  function selectAnswer(questionId: string, optionId: string) {
    const updatedAnswers = { ...answersRef.current, [questionId]: optionId }
    answersRef.current = updatedAnswers
    setAnswers(updatedAnswers)
    sessionStorage.setItem(`kozett-assessment-attempt:${assessmentSlug}:answers`, JSON.stringify(updatedAnswers))
  }

  if (loading) return <PageMessage>Preparing your assessment...</PageMessage>
  if (error && !attempt) return <PageMessage error={error}><Link to={`/certificates/${encodeURIComponent(assessmentSlug)}`} className='mt-4 inline-flex text-sm font-semibold text-cyan-800 dark:text-cyan-300'>Return to assessment introduction</Link></PageMessage>
  if (!attempt || !currentQuestion) return <PageMessage error={error ?? 'No questions are available for this assessment.'} />

  return (
    <section className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm text-slate-500 dark:text-slate-400'>{attempt.assessment.title}</p>
          <h1 className='text-2xl font-bold text-slate-950 dark:text-white'>Assessment in progress</h1>
        </div>
        <div className={`rounded-xl px-4 py-2 font-mono text-sm font-bold ${remainingSeconds < 60 ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`} role='timer' aria-label='Time remaining'>
          {Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:{(remainingSeconds % 60).toString().padStart(2, '0')}
        </div>
      </div>
      <div className={`${panelClass} p-5 sm:p-8`}>
        <div className='flex items-center justify-between gap-4'>
          <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Question {currentIndex + 1} of {questions.length}</p>
          <p className='text-sm text-slate-500 dark:text-slate-400'>{Object.keys(answers).length} answered</p>
        </div>
        <div className='mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800'>
          <div className='h-full rounded-full bg-cyan-600 transition-all' style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
        <p className='mt-7 text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300'>{currentQuestion.topic}</p>
        <h2 className='mt-2 text-xl font-semibold leading-8 text-slate-950 dark:text-white'>{currentQuestion.text}</h2>
        {currentIndex === questions.length - 1 ? (
          <nav aria-label='Assessment question review' className='mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'>Review questions · Unanswered: {questions.filter((question) => !answers[question.id]).map((question) => questions.indexOf(question) + 1).join(', ') || 'none'}</p>
            <div className='mt-3 flex flex-wrap gap-2'>
              {questions.map((question, index) => (
                <button key={question.id} type='button' onClick={() => setCurrentIndex(index)} aria-label={`Question ${index + 1}, ${answers[question.id] ? 'answered' : 'unanswered'}`} className={`h-9 w-9 rounded-lg border text-sm font-semibold ${index === currentIndex ? 'border-cyan-700 bg-cyan-700 text-white' : answers[question.id] ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                  {index + 1}
                </button>
              ))}
            </div>
          </nav>
        ) : null}
        <fieldset className='mt-6 space-y-3'>
          <legend className='sr-only'>Choose one answer</legend>
          {currentQuestion.options.map((option) => {
            const selected = answers[currentQuestion.id] === option.id
            return (
              <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${selected ? 'border-cyan-600 bg-cyan-50 ring-1 ring-cyan-600 dark:border-cyan-400 dark:bg-cyan-950/40 dark:ring-cyan-400' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'}`}>
                <input type='radio' name={`question-${currentQuestion.id}`} value={option.id} checked={selected} onChange={() => selectAnswer(currentQuestion.id, option.id)} className='mt-1 accent-cyan-700' />
                <span className='text-sm leading-6 text-slate-800 dark:text-slate-100'>{option.text}</span>
              </label>
            )
          })}
        </fieldset>
        {error ? <p className='mt-4 text-sm text-red-700 dark:text-red-300' role='alert'>{error}</p> : null}
        <div className='mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700'>
          <button type='button' disabled={currentIndex === 0 || submitting || timeExpired} onClick={() => setCurrentIndex((index) => index - 1)} className='rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200'>Previous</button>
          {currentIndex < questions.length - 1 ? (
            <button type='button' disabled={submitting || timeExpired} onClick={() => setCurrentIndex((index) => index + 1)} className={buttonClass}>Next question</button>
          ) : (
            <button type='button' disabled={submitting} onClick={() => void submit()} className={buttonClass}>{submitting ? 'Submitting securely...' : 'Review & submit'}</button>
          )}
        </div>
        {currentIndex === questions.length - 1 ? (
          <p className='mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400'>Review your answers using the question numbers above. Answer every question before submitting. Final submission cannot be changed.</p>
        ) : null}
      </div>
    </section>
  )
}

export function AssessmentResultsPage() {
  const { assessmentSlug = '', attemptId = '' } = useParams()
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    void api.assessmentResult(attemptId).then((response) => {
      if (!cancelled) setResult(response.result)
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load assessment results.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [attemptId])

  if (loading) return <PageMessage>Loading results...</PageMessage>
  if (error || !result) return <PageMessage error={error ?? 'Assessment result not found.'}><Link to='/certificates' className='mt-4 inline-flex text-sm font-semibold text-cyan-800 dark:text-cyan-300'>Return to academy</Link></PageMessage>
  return (
    <section className='mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8'>
      <article className={`${panelClass} p-6 text-center sm:p-10`}>
        <p className='text-sm font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300'>Assessment result</p>
        <h1 className='mt-3 text-3xl font-bold text-slate-950 dark:text-white'>{result.passed ? 'Assessment passed' : 'Keep learning and try again'}</h1>
        <p className='mt-2 text-slate-600 dark:text-slate-300'>{result.assessment.title}</p>
        <p className='mt-7 text-6xl font-black tracking-tight text-slate-950 dark:text-white'>{result.score}<span className='text-3xl'>%</span></p>
        <p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>{result.correctAnswers} correct out of {result.totalQuestions} · Passing score {result.assessment.passingScore}%</p>
        {result.passed && result.certificateId ? (
          <div className='mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30'>
            <p className='font-semibold text-emerald-900 dark:text-emerald-200'>Your Kozett certificate has been issued.</p>
            <Link to='/my-certificates' className={`${buttonClass} mt-4`}>View your certificate</Link>
          </div>
        ) : (
          <p className='mt-7 text-sm text-slate-600 dark:text-slate-300'>No certificate is issued for a failed assessment.</p>
        )}
        <Link to={`/certificates/${encodeURIComponent(assessmentSlug)}`} className='mt-7 inline-flex text-sm font-semibold text-cyan-800 hover:text-cyan-600 dark:text-cyan-300'>Return to assessment details</Link>
      </article>
    </section>
  )
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] ?? character)
}

function downloadCertificate(certificate: EarnedCertificate) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990"><rect width="1400" height="990" fill="#07111f"/><rect x="35" y="35" width="1330" height="920" rx="24" fill="none" stroke="#22d3ee" stroke-width="3"/><rect x="52" y="52" width="1296" height="886" rx="18" fill="none" stroke="#334155"/><text x="700" y="175" text-anchor="middle" fill="#67e8f9" font-family="Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="7">KOZETT CERTIFICATION ACADEMY</text><path d="M480 220h440" stroke="#164e63" stroke-width="2"/><text x="700" y="330" text-anchor="middle" fill="#f8fafc" font-family="Georgia,serif" font-size="58">Certificate of Achievement</text><text x="700" y="410" text-anchor="middle" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="24">This certificate is proudly presented to</text><text x="700" y="510" text-anchor="middle" fill="#67e8f9" font-family="Georgia,serif" font-size="52">${escapeXml(certificate.recipientName)}</text><path d="M320 550h760" stroke="#475569"/><text x="700" y="630" text-anchor="middle" fill="#e2e8f0" font-family="Arial,sans-serif" font-size="29">for demonstrating skills in</text><text x="700" y="695" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="38" font-weight="700">${escapeXml(certificate.assessmentName)}</text><text x="700" y="760" text-anchor="middle" fill="#94a3b8" font-family="Arial,sans-serif" font-size="22">Issued by ${escapeXml(certificate.issuer)} · Score ${certificate.score}% · ${escapeXml(new Date(certificate.issuedAt).toLocaleDateString())}</text><text x="700" y="855" text-anchor="middle" fill="#67e8f9" font-family="monospace" font-size="20">Credential ID: ${escapeXml(certificate.certificateId)}</text><text x="700" y="900" text-anchor="middle" fill="#64748b" font-family="Arial,sans-serif" font-size="16">Kozett skill assessment certificate · Not a third-party accreditation</text></svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `kozett-certificate-${certificate.certificateId}.svg`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function MyCertificatesPage() {
  const { user } = useAuth()
  const [certificates, setCertificates] = useState<EarnedCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void api.myCertificates().then((response) => {
      if (!cancelled) setCertificates(response.certificates)
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load your certificates.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadKey])

  const categories = [...new Set(certificates.map((certificate) => certificate.category))].sort()
  const visibleCertificates = certificates.filter((certificate) => {
    const normalized = query.trim().toLocaleLowerCase()
    return (category === 'all' || certificate.category === category) &&
      (!normalized || [certificate.title, certificate.assessmentName, certificate.technology, certificate.issuer, certificate.certificateId]
        .some((field) => field.toLocaleLowerCase().includes(normalized)))
  }).sort((left, right) => sort === 'title'
    ? left.title.localeCompare(right.title)
    : Date.parse(right.issuedAt) - Date.parse(left.issuedAt))

  if (!user) return <Navigate to='/login' replace />
  return (
    <section className='mx-auto min-h-[70vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='text-sm font-semibold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300'>Your learning record</p>
          <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl'>Your Certificates</h1>
          <p className='mt-3 text-slate-600 dark:text-slate-300'>Kozett-issued certificates from assessments you have passed.</p>
        </div>
        <Link to='/certificates' className='inline-flex text-sm font-semibold text-cyan-800 hover:text-cyan-600 dark:text-cyan-300'>Explore the academy →</Link>
      </div>
      <div className='mt-7 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_180px]'>
        <label className='relative block'>
          <span className='sr-only'>Search your certificates</span>
          <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500'><SearchIcon /></span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search certificates, technologies, issuers, or IDs...' className='w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white' />
        </label>
        <select aria-label='Filter certificates by category' value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
          <option value='all'>All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label='Sort certificates' value={sort} onChange={(event) => setSort(event.target.value)} className={selectClass}>
          <option value='newest'>Newest first</option>
          <option value='title'>Title (A–Z)</option>
        </select>
      </div>
      <p className='mt-4 text-sm text-slate-600 dark:text-slate-300' aria-live='polite'>{visibleCertificates.length} {visibleCertificates.length === 1 ? 'certificate' : 'certificates'} found</p>
      <div className='mt-4'>
        {loading ? <div className={panelClass} role='status'>Loading your certificates...</div>
          : error ? <ErrorMessage message={`Unable to load certificates: ${error}`} onRetry={() => setReloadKey((current) => current + 1)} />
            : visibleCertificates.length ? (
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {visibleCertificates.map((certificate) => (
                  <article key={certificate.id} className={`${panelClass} flex flex-col`}>
                    <div className='flex items-start gap-3'>
                      <CertificateIcon />
                      <div><h2 className='font-semibold text-slate-950 dark:text-white'>{certificate.title}</h2><p className='mt-1 text-sm text-slate-600 dark:text-slate-300'>{certificate.assessmentName}</p></div>
                    </div>
                    <div className='mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300'>
                      <span className='rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200'>{certificate.category}</span>
                      <span className='rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800'>Score {certificate.score}%</span>
                    </div>
                    <p className='mt-4 text-sm text-slate-600 dark:text-slate-300'>Issued by {certificate.issuer} · {new Date(certificate.issuedAt).toLocaleDateString()}</p>
                    <p className='mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400'>ID: {certificate.certificateId}</p>
                    <div className='mt-auto flex flex-wrap gap-2 pt-5'>
                      <Link to={`/my-certificates/${encodeURIComponent(certificate.certificateId)}`} className={buttonClass}>View Certificate</Link>
                      <button type='button' onClick={() => downloadCertificate(certificate)} className='rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800'>Download</button>
                      <Link to={`/verify/${encodeURIComponent(certificate.certificateId)}`} className='inline-flex items-center px-2 text-sm font-semibold text-cyan-800 hover:text-cyan-600 dark:text-cyan-300'>Verify</Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : certificates.length ? (
              <div className={`${panelClass} border-dashed py-10 text-center`}>
                <h2 className='font-semibold text-slate-950 dark:text-white'>No certificates found</h2>
                <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>Try changing the search query or category filter.</p>
              </div>
            ) : (
              <div className={`${panelClass} border-dashed py-12 text-center`}>
                <CertificateIcon />
                <h2 className='mt-4 font-semibold text-slate-950 dark:text-white'>Your first certificate is waiting to be earned</h2>
                <p className='mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300'>Choose an assessment, demonstrate your skills, and pass to receive a Kozett-issued certificate.</p>
                <Link to='/certificates' className={`${buttonClass} mt-5`}>Explore assessments</Link>
              </div>
            )}
      </div>
    </section>
  )
}

export function MyCertificateDetailPage() {
  const { certificateId = '' } = useParams()
  const [certificate, setCertificate] = useState<EarnedCertificate | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void api.myCertificate(certificateId).then((response) => {
      if (!cancelled) setCertificate(response.certificate)
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load this certificate.')
    })
    return () => { cancelled = true }
  }, [certificateId])
  if (error) return <PageMessage error={error} />
  if (!certificate) return <PageMessage>Loading certificate...</PageMessage>
  return (
    <section className='mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8'>
      <div className={`${panelClass} border-cyan-700/30 bg-gradient-to-br from-white to-cyan-50 p-8 text-center dark:from-slate-950 dark:to-cyan-950/40 sm:p-14`}>
        <p className='text-sm font-bold uppercase tracking-[0.2em] text-cyan-800 dark:text-cyan-300'>Kozett Certification Academy</p>
        <h1 className='mt-8 text-3xl font-bold text-slate-950 dark:text-white'>Certificate of Achievement</h1>
        <p className='mt-6 text-slate-600 dark:text-slate-300'>Presented to</p>
        <p className='mt-2 text-3xl font-semibold text-cyan-800 dark:text-cyan-200'>{certificate.recipientName}</p>
        <p className='mt-6 text-slate-600 dark:text-slate-300'>for demonstrating skills in</p>
        <h2 className='mt-2 text-2xl font-bold text-slate-950 dark:text-white'>{certificate.assessmentName}</h2>
        <p className='mt-5 text-sm text-slate-600 dark:text-slate-300'>Score {certificate.score}% · Issued {new Date(certificate.issuedAt).toLocaleDateString()} · By {certificate.issuer}</p>
        <p className='mt-4 break-all font-mono text-sm text-slate-500 dark:text-slate-400'>Credential ID: {certificate.certificateId}</p>
        <p className='mt-5 text-xs text-slate-500 dark:text-slate-400'>Kozett skill assessment certificate. This is not a third-party accreditation.</p>
        <div className='mt-8 flex flex-wrap justify-center gap-3'>
          <button type='button' onClick={() => downloadCertificate(certificate)} className={buttonClass}>Download certificate</button>
          <Link to={`/verify/${encodeURIComponent(certificate.certificateId)}`} className='rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-700'>Verify credential</Link>
        </div>
      </div>
    </section>
  )
}

export function CertificateVerificationPage() {
  const { certificateId = '' } = useParams()
  const [valid, setValid] = useState<boolean | null>(null)
  const [certificate, setCertificate] = useState<EarnedCertificate | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void api.verifyCertificate(certificateId).then((response) => {
      if (!cancelled) {
        setValid(response.valid)
        setCertificate(response.certificate ?? null)
      }
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to verify this credential.')
    })
    return () => { cancelled = true }
  }, [certificateId])
  if (error) return <PageMessage error={error} />
  if (valid === null) return <PageMessage>Verifying credential...</PageMessage>
  return (
    <section className='mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8'>
      <article className={`${panelClass} p-6 sm:p-9`}>
        <p className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${valid ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'}`}>
          {valid ? 'Valid Kozett credential' : 'Credential not found or invalid'}
        </p>
        <h1 className='mt-5 text-2xl font-bold text-slate-950 dark:text-white'>Public credential verification</h1>
        {valid && certificate ? (
          <dl className='mt-6 grid gap-4 sm:grid-cols-2'>
            <Detail label='Certificate' value={certificate.title} />
            <Detail label='Recipient' value={certificate.recipientName} />
            <Detail label='Assessment' value={certificate.assessmentName} />
            <Detail label='Issuer' value={certificate.issuer} />
            <Detail label='Issue date' value={new Date(certificate.issuedAt).toLocaleDateString()} />
            <Detail label='Credential ID' value={certificate.certificateId} />
          </dl>
        ) : <p className='mt-3 text-sm text-slate-600 dark:text-slate-300'>No active certificate record matches this ID.</p>}
        <p className='mt-7 text-xs leading-5 text-slate-500 dark:text-slate-400'>A valid credential confirms completion of a Kozett platform assessment. It does not represent third-party accreditation.</p>
      </article>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className='text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'>{label}</dt><dd className='mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100'>{value}</dd></div>
}
