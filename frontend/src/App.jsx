import { useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyJob = {
  title: '',
  company: '',
  location: '',
  description: '',
  requiredSkills: '',
  minExperienceYears: 0,
}

const emptyCandidate = {
  name: '',
  email: '',
  phone: '',
  skills: '',
  experienceYears: 0,
  currentLocation: '',
}

const applicationStatuses = [
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFERED',
  'HIRED',
  'REJECTED',
]

const stageColors = {
  APPLIED: '#6558f5',
  SHORTLISTED: '#0284c7',
  INTERVIEW: '#ea8500',
  OFFERED: '#8b5cf6',
  HIRED: '#16a34a',
  REJECTED: '#dc2626',
}

async function api(url, options) {
  const response = await fetch(url, options)

  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status})`

    try {
      const data = await response.json()
      message = data.message || data.error || message

      if (
        response.status === 409 &&
        (url.includes('/api/applications'))
      ) {
        message =
          'This candidate already has an application for the selected job.'
      }
    } catch {
      // The response may not contain JSON.
    }

    throw new Error(message)
  }

  if (response.status === 204) return null

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function SkillTags({ skills, type = 'detected' }) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return <p className="muted">None</p>
  }

  return (
    <div className="skill-list">
      {skills.map((skill) => (
        <span className={`skill ${type}`} key={skill}>
          {type === 'matched' ? '✓ ' : ''}
          {skill}
        </span>
      ))}
    </div>
  )
}

// Evidence-gated score is calculated by the backend, not independently in React.
// Candidate ordering still uses the original rule-based matchScore.
// Step 6H: deterministic, lexicographic ranking. No new weighted score.
// Experience: eligible (2), unknown (1), below minimum (0).
function experienceRank(value) {
  return value === true ? 2 : value === null || value === undefined ? 1 : 0
}

function rankingCoverage(result, field, fallback) {
  const raw = result[field] ?? fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

function compareCandidateMatches(a, b) {
  const mandatoryA = Array.isArray(a.result.mandatorySkills) ? a.result.mandatorySkills.length : 0
  const mandatoryB = Array.isArray(b.result.mandatorySkills) ? b.result.mandatorySkills.length : 0
  const primaryA = mandatoryA > 0
    ? rankingCoverage(a.result, 'mandatoryCoverage', a.result.matchScore)
    : rankingCoverage(a.result, 'preferredCoverage', a.result.matchScore)
  const primaryB = mandatoryB > 0
    ? rankingCoverage(b.result, 'mandatoryCoverage', b.result.matchScore)
    : rankingCoverage(b.result, 'preferredCoverage', b.result.matchScore)

  return (primaryB - primaryA) ||
    (experienceRank(b.result.experienceEligible) - experienceRank(a.result.experienceEligible)) ||
    (rankingCoverage(b.result, 'preferredCoverage', 0) - rankingCoverage(a.result, 'preferredCoverage', 0)) ||
    (rankingCoverage(b.result, 'evidenceScore', b.result.matchScore) -
      rankingCoverage(a.result, 'evidenceScore', a.result.matchScore)) ||
    a.candidate.name.localeCompare(b.candidate.name) ||
    (Number(a.candidate.id) - Number(b.candidate.id))
}

function RankingExplanation({ result }) {
  const mandatory = Array.isArray(result.mandatorySkills) ? result.mandatorySkills : []
  const preferred = Array.isArray(result.preferredSkills) ? result.preferredSkills : []
  const primaryLabel = mandatory.length ? 'Mandatory skill coverage' : 'Preferred skill coverage (no mandatory skills specified)'
  const primaryValue = mandatory.length ? result.mandatoryCoverage : result.preferredCoverage
  const experience = result.experienceEligible === true ? 'Meets minimum experience' :
    result.experienceEligible === false ? 'Below minimum experience' : 'Experience not verified'
  return (
    <div className="experience-box" style={{ marginTop: '14px' }}>
      <h4>Why this candidate is ranked here</h4>
      <p className="muted small">{primaryLabel}: {Number(primaryValue ?? result.matchScore ?? 0).toFixed(2)}%</p>
      <p className="muted small">Experience: {experience}</p>
      <p className="muted small">Preferred skill coverage: {preferred.length ? `${Number(result.preferredCoverage ?? 0).toFixed(2)}%` : 'Not specified'}</p>
      <p className="muted small">Tie-breaker: evidence-aware score {Number(result.evidenceScore ?? result.matchScore ?? 0).toFixed(2)} / 100</p>
      <p className="muted small">Ranking is based on ordered criteria, not a hiring recommendation. AI similarity is supporting evidence only.</p>
    </div>
  )
}

function MatchExplanation({ result }) {
  const summary = typeof result.matchExplanation === 'string'
    ? result.matchExplanation.trim()
    : ''
  const evidence = Array.isArray(result.matchEvidence)
    ? result.matchEvidence.filter((item) => typeof item === 'string' && item.trim())
    : []
  const gaps = Array.isArray(result.matchGaps)
    ? result.matchGaps.filter((item) => typeof item === 'string' && item.trim())
    : []

  if (!summary && evidence.length === 0 && gaps.length === 0) return null

  return (
    <div className="experience-box" style={{ marginTop: '14px' }}>
      <h4>Evidence-Based Match Explanation</h4>
      {summary && <p>{summary}</p>}
      {evidence.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <strong>Supporting evidence</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            {evidence.map((item, index) => <li key={`evidence-${index}`}>{item}</li>)}
          </ul>
        </div>
      )}
      {gaps.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <strong>Missing or unverified requirements</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            {gaps.map((item, index) => <li key={`gap-${index}`}>{item}</li>)}
          </ul>
        </div>
      )}
      <p className="muted small" style={{ marginTop: '12px' }}>
        {result.matchExplanationStatus === 'RULE_DERIVED'
          ? 'Explanation derived from recorded requirements and candidate evidence.'
          : 'Explanation from the matching service.'}
        {' '}Missing evidence does not necessarily mean a candidate lacks a skill.
        This is not an automated hiring decision.
      </p>
    </div>
  )
}

function HybridPreview({ result }) {
  const value = result.evidenceScore
  const score = value == null ? null : Number(value)
  const available = score !== null && Number.isFinite(score)
  return (
    <div className="experience-box" style={{ marginTop: '14px' }}>
      <h4>Experimental Evidence-Aware Score</h4>
      {available ? (
        <>
          <p style={{ fontSize: '22px', fontWeight: 700, margin: '8px 0' }}>
            {score.toFixed(2)} / 100
          </p>
          <p className="muted small">{result.evidenceExplanation}</p>
          <p className="muted small">
            Skill coverage: {Number(result.matchScore ?? 0).toFixed(2)} / 100
            {' · '}Semantic bonus: {Number(result.semanticBonus ?? 0).toFixed(2)} points
            {' · '}Status: {result.evidenceScoreStatus || 'UNKNOWN'}
          </p>
          <p className="muted small">
            Experimental heuristic, not a calibrated qualification score or hiring decision.
            Experience eligibility is assessed separately. Candidate rankings use the Step 6H ordered criteria.
          </p>
        </>
      ) : (
        <p className="muted small">
          This result was generated by an older backend. Restart Spring Boot with the Step 6E MatchingService.
        </p>
      )}
    </div>
  )
}

function SemanticSimilarity({ result }) {
  const status = result.semanticStatus
  const raw = result.semanticSimilarity
  const similarity = raw == null ? null : Number(raw)
  const available = status === 'SUCCESS' &&
    similarity !== null && Number.isFinite(similarity)

  return (
    <div className="experience-box" style={{ marginTop: '18px' }}>
      <h4>AI Semantic Similarity</h4>
      {available ? (
        <>
          <p style={{ fontSize: '26px', fontWeight: 700, margin: '8px 0' }}>
            {similarity.toFixed(4)}
          </p>
          <p className="muted small">
            Cosine similarity (range -1 to 1) using job context and
            {result.semanticComparisonType === 'RESUME_TEXT'
              ? ' uploaded resume text.'
              : ' registered candidate profile information.'}
            {' '}This is not a qualification percentage or hiring decision.
          </p>
          <p className="muted small">
            Model: {result.semanticModel || 'Local embedding model'}
          </p>
        </>
      ) : (
        <p className="muted small">
          {status === 'UNAVAILABLE'
            ? 'Local AI matching is unavailable. Rule-based results are still shown.'
            : status === 'INSUFFICIENT_DATA'
              ? 'Not enough job or candidate skills to calculate semantic similarity.'
              : 'Semantic similarity was not included in this response.'}
        </p>
      )}
    </div>
  )
}

function RequirementAnalysis({ result }) {
  // Older API responses do not contain the Step 6G fields.
  if (!Array.isArray(result.mandatorySkills) || !Array.isArray(result.preferredSkills)) {
    return null
  }

  const mandatory = result.mandatorySkills
  const preferred = result.preferredSkills
  const coverage = (value) => {
    const number = Number(value)
    return Number.isFinite(number) ? `${number.toFixed(2)}%` : 'Not available'
  }

  return (
    <div className="experience-box" style={{ marginTop: '16px' }}>
      <h4>Requirement-Aware Skill Analysis</h4>
      <p className="muted small">
        Mandatory skills are unmarked in the job description; skills prefixed with ? are preferred.
        Coverage measures exact normalized skill evidence, not overall candidate suitability.
      </p>
      <div className="result-grid">
        <div className="result-box">
          <h4>Mandatory Skills — {mandatory.length ? coverage(result.mandatoryCoverage) : 'None specified'}</h4>
          <p className="muted small">Matched</p>
          <SkillTags skills={result.matchedMandatorySkills} type="matched" />
          <p className="muted small">Missing</p>
          <SkillTags skills={result.missingMandatorySkills} type="missing" />
        </div>
        <div className="result-box">
          <h4>Preferred Skills — {preferred.length ? coverage(result.preferredCoverage) : 'None specified'}</h4>
          <p className="muted small">Matched</p>
          <SkillTags skills={result.matchedPreferredSkills} type="matched" />
          <p className="muted small">Missing</p>
          <SkillTags skills={result.missingPreferredSkills} type="missing" />
        </div>
      </div>
      <p className="muted small">
        Mandatory requirement status: {' '}
        {result.requirementStatus === 'ALL_MANDATORY_MATCHED'
          ? 'All mandatory skills matched'
          : result.requirementStatus === 'MISSING_MANDATORY_SKILLS'
            ? 'Some mandatory skills are missing'
            : 'No mandatory skills specified'}
      </p>
    </div>
  )
}

function MatchResults({ result, showDetectedSkills = false }) {
  const raw = Number(result.matchScore ?? 0)
  const score = Number.isFinite(raw)
    ? Math.max(0, Math.min(100, raw))
    : 0

  return (
    <div className="match-results">
      <div className="result-heading">
        <div>
          <h3>Match Analysis</h3>
          <p className="muted">
            {result.jobTitle || 'Job requirements comparison'}
          </p>
          <p className="muted small">Rule-based skill coverage</p>
        </div>
        <div className="score-circle">{score}%</div>
      </div>

      <div className="score-track">
        <div className="score-fill" style={{ width: `${score}%` }} />
      </div>

      <p className="muted small">
        Percentage of required technical skills matched.
        This rule-based score is not a hiring decision.
      </p>

      <SemanticSimilarity result={result} />
      <HybridPreview result={result} />
      <RequirementAnalysis result={result} />
      <MatchExplanation result={result} />

      <div className="result-grid">
        <div className="result-box">
          <h4>Matched Skills</h4>
          <SkillTags skills={result.matchedSkills} type="matched" />
        </div>
        <div className="result-box">
          <h4>Missing Skills</h4>
          <SkillTags skills={result.missingSkills} type="missing" />
        </div>
      </div>

      <div className="experience-box">
        <h4>Experience Eligibility</h4>
        <p>
          Required:{' '}
          <strong>
            {result.requiredExperienceYears == null
              ? 'Unknown'
              : `${result.requiredExperienceYears} years`}
          </strong>
        </p>
        <p>
          Candidate:{' '}
          <strong>
            {result.candidateExperienceYears == null
              ? 'Not determined'
              : `${result.candidateExperienceYears} years`}
          </strong>
        </p>
        <p>
          Status:{' '}
          <strong>
            {result.experienceEligible == null
              ? 'Not determined'
              : result.experienceEligible
                ? 'Meets requirement'
                : 'Below requirement'}
          </strong>
        </p>
      </div>

      {showDetectedSkills && (
        <div className="detected-section">
          <h4>
            All Detected Skills (
            {result.totalSkillsDetected ?? result.detectedSkills?.length ?? 0})
          </h4>
          <SkillTags skills={result.detectedSkills} />
        </div>
      )}
    </div>
  )
}

function RecruitmentAnalytics({ jobs, applications }) {
  const total = applications.length

  const counts = applicationStatuses.reduce((result, status) => {
    result[status] = applications.filter(
      (application) => application.status === status
    ).length
    return result
  }, {})

  const jobStats = jobs.map((job) => ({
    ...job,
    count: applications.filter(
      (application) => application.job?.id === job.id
    ).length,
  }))

  const maxJobCount = Math.max(
    1,
    ...jobStats.map((job) => job.count)
  )

  const activeCount =
    counts.APPLIED +
    counts.SHORTLISTED +
    counts.INTERVIEW +
    counts.OFFERED

  const hiringRate = total
    ? ((counts.HIRED / total) * 100).toFixed(1)
    : '0.0'

  const rejectedRate = total
    ? ((counts.REJECTED / total) * 100).toFixed(1)
    : '0.0'

  const analyticsCard = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '20px',
  }

  const analyticsGrid = {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '16px',
    marginBottom: '24px',
  }

  const barTrack = {
    height: '12px',
    borderRadius: '20px',
    background: '#e9edf4',
    overflow: 'hidden',
  }

  return (
    <section className="panel" id="recruitment-analytics">
      <div className="section-heading">
        <div>
          <h2>Recruitment Analytics</h2>
          <p>
            Understand recruitment activity and current
            application statuses.
          </p>
        </div>

        <span className="feature-tag">
          Live Analytics
        </span>
      </div>

      <div style={analyticsGrid}>
        {[
          {
            label: 'Total Applications',
            value: total,
            description: 'Applications in the pipeline',
            color: '#6558f5',
          },
          {
            label: 'Active Applications',
            value: activeCount,
            description: 'Applied through offered',
            color: '#0284c7',
          },
          {
            label: 'Candidates Hired',
            value: counts.HIRED,
            description: 'Currently marked as hired',
            color: '#16a34a',
          },
          {
            label: 'Hiring Rate',
            value: `${hiringRate}%`,
            description: 'Hired / total applications',
            color: '#8b5cf6',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            style={{
              ...analyticsCard,
              borderTop: `4px solid ${metric.color}`,
            }}
          >
            <p
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#64748b',
                margin: '0 0 12px',
              }}
            >
              {metric.label}
            </p>

            <strong
              style={{
                display: 'block',
                fontSize: '32px',
                color: '#182338',
                marginBottom: '8px',
              }}
            >
              {metric.value}
            </strong>

            <p
              style={{
                fontSize: '12px',
                color: '#64748b',
                margin: 0,
              }}
            >
              {metric.description}
            </p>
          </div>
        ))}
      </div>

      <div style={analyticsGrid}>
        <div style={analyticsCard}>
          <h3 style={{ marginTop: 0 }}>
            Hiring Outcomes
          </h3>

          <p className="muted">
            Outcomes based on current application statuses.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span>Hired</span>
            <strong>{hiringRate}%</strong>
          </div>

          <div style={barTrack}>
            <div
              style={{
                width: `${hiringRate}%`,
                height: '100%',
                background: stageColors.HIRED,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              margin: '20px 0 10px',
            }}
          >
            <span>Rejected</span>
            <strong>{rejectedRate}%</strong>
          </div>

          <div style={barTrack}>
            <div
              style={{
                width: `${rejectedRate}%`,
                height: '100%',
                background: stageColors.REJECTED,
              }}
            />
          </div>
        </div>

        <div style={analyticsCard}>
          <h3 style={{ marginTop: 0 }}>
            Application Distribution
          </h3>

          <p className="muted">
            Share of applications in each hiring stage.
          </p>

          {applicationStatuses.map((status) => {
            const count = counts[status]
            const percentage = total
              ? (count / total) * 100
              : 0

            return (
              <div
                key={status}
                style={{ marginBottom: '16px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '7px',
                    fontSize: '13px',
                  }}
                >
                  <span>{status}</span>
                  <strong>
                    {count} ({percentage.toFixed(0)}%)
                  </strong>
                </div>

                <div style={barTrack}>
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: stageColors[status],
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={analyticsCard}>
        <h3 style={{ marginTop: 0 }}>
          Applications Per Job
        </h3>

        <p className="muted">
          Compare the number of applications received
          for each job opening.
        </p>

        {jobStats.length === 0 ? (
          <div className="empty-state">
            No jobs available yet.
          </div>
        ) : (
          jobStats.map((job) => (
            <div
              key={job.id}
              style={{ marginBottom: '22px' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '9px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>{job.title}</strong>
                  <div className="muted small">
                    {job.company}
                  </div>
                </div>

                <strong>
                  {job.count}{' '}
                  {job.count === 1
                    ? 'application'
                    : 'applications'}
                </strong>
              </div>

              <div style={barTrack}>
                <div
                  style={{
                    width: `${(job.count / maxJobCount) * 100
                      }%`,
                    height: '100%',
                    background: '#6558f5',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <p
        className="muted small"
        style={{ marginTop: '18px' }}
      >
        Analytics are calculated from the current
        application records. These figures are not
        historical conversion rates or predictions.
      </p>
    </section>
  )
}

function App() {
  const [jobs, setJobs] = useState([])
  const [candidates, setCandidates] = useState([])
  const [applications, setApplications] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [jobSearch, setJobSearch] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [experienceFilter, setExperienceFilter] =
    useState('all')

  const [jobForm, setJobForm] = useState({ ...emptyJob })
  const [editingJobId, setEditingJobId] = useState(null)
  const [savingJob, setSavingJob] = useState(false)
  const [deletingJobId, setDeletingJobId] = useState(null)
  const [jobMessage, setJobMessage] = useState('')
  const [jobError, setJobError] = useState('')

  const [candidateForm, setCandidateForm] = useState({
    ...emptyCandidate,
  })
  const [editingCandidateId, setEditingCandidateId] =
    useState(null)
  const [savingCandidate, setSavingCandidate] =
    useState(false)
  const [deletingCandidateId, setDeletingCandidateId] =
    useState(null)
  const [candidateMessage, setCandidateMessage] =
    useState('')
  const [candidateError, setCandidateError] = useState('')

  const [applicationJob, setApplicationJob] = useState('')
  const [applicationCandidate, setApplicationCandidate] =
    useState('')
  const [applicationSaving, setApplicationSaving] =
    useState(false)
  const [applicationUpdatingId, setApplicationUpdatingId] =
    useState(null)
  const [applicationDeletingId, setApplicationDeletingId] =
    useState(null)
  const [applicationError, setApplicationError] =
    useState('')
  const [applicationMessage, setApplicationMessage] =
    useState('')

  const [selectedJob, setSelectedJob] = useState('')
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeResult, setResumeResult] = useState(null)
  const [resumeError, setResumeError] = useState('')
  const [analyzingResume, setAnalyzingResume] =
    useState(false)

  const [registrationFile, setRegistrationFile] = useState(null)
  const [registrationForm, setRegistrationForm] = useState(null)
  const [registrationParsing, setRegistrationParsing] = useState(false)
  const [registrationSaving, setRegistrationSaving] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [registrationFileKey, setRegistrationFileKey] = useState(0)

  const [candidateMatchJob, setCandidateMatchJob] =
    useState('')
  const [selectedCandidate, setSelectedCandidate] =
    useState('')
  const [candidateMatchResult, setCandidateMatchResult] =
    useState(null)
  const [candidateMatchError, setCandidateMatchError] =
    useState('')
  const [matchingCandidate, setMatchingCandidate] =
    useState(false)

  const [rankingJob, setRankingJob] = useState('')
  const [rankings, setRankings] = useState([])
  const [rankingLoading, setRankingLoading] =
    useState(false)
  const [rankingError, setRankingError] = useState('')
  const [rankingComplete, setRankingComplete] =
    useState(false)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          jobData,
          candidateData,
          applicationData,
        ] = await Promise.all([
          api('/api/jobs'),
          api('/api/candidates'),
          api('/api/applications'),
        ])

        setJobs(jobData)
        setCandidates(candidateData)
        setApplications(applicationData)

        if (jobData.length > 0) {
          const id = String(jobData[0].id)
          setSelectedJob(id)
          setCandidateMatchJob(id)
          setRankingJob(id)
          setApplicationJob(id)
        }

        if (candidateData.length > 0) {
          const id = String(candidateData[0].id)
          setSelectedCandidate(id)
          setApplicationCandidate(id)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const filteredJobs = useMemo(() => {
    const query = jobSearch.toLowerCase().trim()

    return jobs.filter((job) =>
      [
        job.title,
        job.company,
        job.location,
        job.requiredSkills,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )
    )
  }, [jobs, jobSearch])

  const filteredCandidates = useMemo(() => {
    const query = candidateSearch.toLowerCase().trim()
    const skill = skillFilter.toLowerCase().trim()

    return candidates.filter((candidate) => {
      const matchesSearch = [
        candidate.name,
        candidate.email,
        candidate.currentLocation,
        candidate.skills,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )

      const matchesSkill = String(candidate.skills ?? '')
        .toLowerCase()
        .includes(skill)

      const years = Number(candidate.experienceYears ?? 0)

      const matchesExperience =
        experienceFilter === 'all' ||
        (experienceFilter === '0-1' && years <= 1) ||
        (experienceFilter === '2-4' &&
          years >= 2 &&
          years <= 4) ||
        (experienceFilter === '5+' && years >= 5)

      return (
        matchesSearch &&
        matchesSkill &&
        matchesExperience
      )
    })
  }, [
    candidates,
    candidateSearch,
    skillFilter,
    experienceFilter,
  ])

  const averageExperience = candidates.length
    ? (
      candidates.reduce(
        (sum, candidate) =>
          sum + Number(candidate.experienceYears ?? 0),
        0
      ) / candidates.length
    ).toFixed(1)
    : '0.0'

  const pipelineCounts = applicationStatuses.reduce(
    (counts, status) => {
      counts[status] = applications.filter(
        (application) => application.status === status
      ).length

      return counts
    },
    {}
  )

  function clearRankings() {
    setRankings([])
    setRankingComplete(false)
    setRankingError('')
  }

  function invalidateMatches() {
    setResumeResult(null)
    setCandidateMatchResult(null)
    clearRankings()
  }

  function updateJobField(event) {
    const { name, value } = event.target
    setJobForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function startEditJob(job) {
    setEditingJobId(job.id)
    setJobForm({
      title: job.title ?? '',
      company: job.company ?? '',
      location: job.location ?? '',
      description: job.description ?? '',
      requiredSkills: job.requiredSkills ?? '',
      minExperienceYears: job.minExperienceYears ?? 0,
    })

    setJobError('')
    setJobMessage('')

    document
      .getElementById('create-job')
      ?.scrollIntoView({ behavior: 'smooth' })
  }

  function cancelEditJob() {
    setEditingJobId(null)
    setJobForm({ ...emptyJob })
    setJobError('')
    setJobMessage('')
  }

  async function handleSaveJob(event) {
    event.preventDefault()
    setSavingJob(true)
    setJobError('')
    setJobMessage('')

    const editing = editingJobId !== null

    try {
      const saved = await api(
        editing
          ? `/api/jobs/${editingJobId}`
          : '/api/jobs',
        {
          method: editing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...jobForm,
            minExperienceYears: Number(
              jobForm.minExperienceYears
            ),
          }),
        }
      )

      if (!saved || saved.id == null) {
        throw new Error(
          'No saved job returned by server.'
        )
      }

      setJobs((previous) =>
        editing
          ? previous.map((job) =>
            job.id === editingJobId ? saved : job
          )
          : [...previous, saved]
      )

      if (!editing) {
        const id = String(saved.id)
        setSelectedJob(id)
        setCandidateMatchJob(id)
        setRankingJob(id)
        setApplicationJob(id)
      }

      invalidateMatches()
      setEditingJobId(null)
      setJobForm({ ...emptyJob })

      setJobMessage(
        editing
          ? 'Job updated successfully.'
          : 'Job created.'
      )
    } catch (err) {
      setJobError(err.message)
    } finally {
      setSavingJob(false)
    }
  }

  async function handleDeleteJob(job) {
    if (
      !window.confirm(
        `Delete "${job.title}"?\nThis cannot be undone.`
      )
    ) {
      return
    }

    setDeletingJobId(job.id)
    setJobError('')

    try {
      await api(`/api/jobs/${job.id}`, {
        method: 'DELETE',
      })

      const remaining = jobs.filter(
        (item) => item.id !== job.id
      )

      const fallback = remaining.length
        ? String(remaining[0].id)
        : ''

      setJobs(remaining)

      if (selectedJob === String(job.id)) {
        setSelectedJob(fallback)
      }

      if (candidateMatchJob === String(job.id)) {
        setCandidateMatchJob(fallback)
      }

      if (rankingJob === String(job.id)) {
        setRankingJob(fallback)
      }

      if (applicationJob === String(job.id)) {
        setApplicationJob(fallback)
      }

      if (editingJobId === job.id) {
        cancelEditJob()
      }

      invalidateMatches()
      setJobMessage('Job deleted successfully.')
    } catch (err) {
      setJobError(err.message)
    } finally {
      setDeletingJobId(null)
    }
  }

  function updateCandidateField(event) {
    const { name, value } = event.target

    setCandidateForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function startEditCandidate(candidate) {
    setEditingCandidateId(candidate.id)

    setCandidateForm({
      name: candidate.name ?? '',
      email: candidate.email ?? '',
      phone: candidate.phone ?? '',
      skills: candidate.skills ?? '',
      experienceYears: candidate.experienceYears ?? 0,
      currentLocation: candidate.currentLocation ?? '',
    })

    setCandidateError('')
    setCandidateMessage('')

    document
      .getElementById('add-candidate')
      ?.scrollIntoView({ behavior: 'smooth' })
  }

  function cancelEditCandidate() {
    setEditingCandidateId(null)
    setCandidateForm({ ...emptyCandidate })
    setCandidateError('')
    setCandidateMessage('')
  }

  async function handleSaveCandidate(event) {
    event.preventDefault()
    setSavingCandidate(true)
    setCandidateError('')
    setCandidateMessage('')

    const editing = editingCandidateId !== null

    try {
      const saved = await api(
        editing
          ? `/api/candidates/${editingCandidateId}`
          : '/api/candidates',
        {
          method: editing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...candidateForm,
            experienceYears: Number(
              candidateForm.experienceYears
            ),
          }),
        }
      )

      if (!saved || saved.id == null) {
        throw new Error(
          'No saved candidate returned by server.'
        )
      }

      setCandidates((previous) =>
        editing
          ? previous.map((candidate) =>
            candidate.id === editingCandidateId
              ? saved
              : candidate
          )
          : [...previous, saved]
      )

      if (!editing) {
        const id = String(saved.id)
        setSelectedCandidate(id)
        setApplicationCandidate(id)
      }

      invalidateMatches()
      setEditingCandidateId(null)
      setCandidateForm({ ...emptyCandidate })

      setCandidateMessage(
        editing
          ? 'Candidate updated successfully.'
          : 'Candidate added successfully.'
      )
    } catch (err) {
      setCandidateError(err.message)
    } finally {
      setSavingCandidate(false)
    }
  }

  async function handleDeleteCandidate(candidate) {
    if (
      !window.confirm(
        `Delete "${candidate.name}"?\nThis cannot be undone.`
      )
    ) {
      return
    }

    setDeletingCandidateId(candidate.id)
    setCandidateError('')

    try {
      await api(`/api/candidates/${candidate.id}`, {
        method: 'DELETE',
      })

      const remaining = candidates.filter(
        (item) => item.id !== candidate.id
      )

      setCandidates(remaining)

      const fallback = remaining.length
        ? String(remaining[0].id)
        : ''

      if (
        selectedCandidate === String(candidate.id)
      ) {
        setSelectedCandidate(fallback)
      }

      if (
        applicationCandidate === String(candidate.id)
      ) {
        setApplicationCandidate(fallback)
      }

      if (editingCandidateId === candidate.id) {
        cancelEditCandidate()
      }

      invalidateMatches()

      setCandidateMessage(
        'Candidate deleted successfully.'
      )
    } catch (err) {
      setCandidateError(err.message)
    } finally {
      setDeletingCandidateId(null)
    }
  }

  async function handleCreateApplication(event) {
    event.preventDefault()

    if (!applicationJob || !applicationCandidate) {
      setApplicationError(
        'Please select a job and a candidate.'
      )
      return
    }

    setApplicationSaving(true)
    setApplicationError('')
    setApplicationMessage('')

    try {
      const created = await api(
        `/api/applications?jobId=${applicationJob}` +
        `&candidateId=${applicationCandidate}`,
        { method: 'POST' }
      )

      setApplications((previous) => [
        ...previous,
        created,
      ])

      setApplicationMessage(
        'Candidate added to recruitment pipeline.'
      )
    } catch (err) {
      setApplicationError(err.message)
    } finally {
      setApplicationSaving(false)
    }
  }

  async function handleUpdateApplicationStatus(
    applicationId,
    newStatus
  ) {
    setApplicationUpdatingId(applicationId)
    setApplicationError('')
    setApplicationMessage('')

    try {
      const updated = await api(
        `/api/applications/${applicationId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      )

      setApplications((previous) =>
        previous.map((application) =>
          application.id === applicationId
            ? updated
            : application
        )
      )

      setApplicationMessage(
        `Application status updated to ${newStatus}.`
      )
    } catch (err) {
      setApplicationError(err.message)
    } finally {
      setApplicationUpdatingId(null)
    }
  }

  async function handleDeleteApplication(application) {
    const confirmed = window.confirm(
      `Remove ${application.candidate.name}'s ` +
      `application for ${application.job.title}?`
    )

    if (!confirmed) return

    setApplicationDeletingId(application.id)
    setApplicationError('')
    setApplicationMessage('')

    try {
      await api(
        `/api/applications/${application.id}`,
        { method: 'DELETE' }
      )

      setApplications((previous) =>
        previous.filter(
          (item) => item.id !== application.id
        )
      )

      setApplicationMessage(
        'Application removed successfully.'
      )
    } catch (err) {
      setApplicationError(err.message)
    } finally {
      setApplicationDeletingId(null)
    }
  }

  function handleRegistrationFileChange(event) {
    setRegistrationFile(event.target.files?.[0] || null)
    setRegistrationForm(null)
    setRegistrationError('')
    setRegistrationMessage('')
  }

  function updateRegistrationField(event) {
    const { name, value } = event.target
    setRegistrationForm((previous) => ({
      ...previous,
      [name]: value,
    }))
    setRegistrationError('')
  }

  async function handleParseRegistration(event) {
    event.preventDefault()
    setRegistrationError('')
    setRegistrationMessage('')
    setRegistrationForm(null)

    if (!registrationFile) {
      setRegistrationError('Please select a PDF resume.')
      return
    }

    if (!registrationFile.name.toLowerCase().endsWith('.pdf')) {
      setRegistrationError('Only PDF resumes are supported.')
      return
    }

    if (registrationFile.size > 5 * 1024 * 1024) {
      setRegistrationError('Maximum PDF size is 5 MB.')
      return
    }

    setRegistrationParsing(true)

    try {
      const data = new FormData()
      data.append('file', registrationFile)

      const parsed = await api('/api/resumes/parse', {
        method: 'POST',
        body: data,
      })

      setRegistrationForm({
        name: parsed.name ?? '',
        email: parsed.email ?? '',
        phone: parsed.phone ?? '',
        skills: parsed.skills ?? '',
        experienceYears: parsed.experienceYears ?? '',
        currentLocation: parsed.currentLocation ?? '',
      })

      setRegistrationMessage(
        'Resume parsed. Review all fields before saving the candidate.'
      )
    } catch (err) {
      setRegistrationError(err.message)
    } finally {
      setRegistrationParsing(false)
    }
  }

  async function handleSaveRegistration(event) {
    event.preventDefault()
    if (!registrationForm || registrationSaving) return

    setRegistrationError('')
    setRegistrationMessage('')

    const name = registrationForm.name.trim()
    const email = registrationForm.email.trim().toLowerCase()
    const skills = registrationForm.skills.trim()
    const yearsText = String(registrationForm.experienceYears).trim()
    const years = Number(yearsText)

    if (!name || !email || !skills) {
      setRegistrationError('Name, email and skills are required.')
      return
    }

    if (!yearsText || !Number.isInteger(years) || years < 0) {
      setRegistrationError(
        'Enter valid experience in whole years (0 or more).'
      )
      return
    }

    setRegistrationSaving(true)

    try {
      const latestCandidates = await api('/api/candidates')
      setCandidates(latestCandidates)

      const duplicate = latestCandidates.find(
        (candidate) =>
          String(candidate.email ?? '').trim().toLowerCase() === email
      )

      if (duplicate) {
        throw new Error(
          'A candidate with this email already exists. No new profile was created.'
        )
      }

      const saved = await api('/api/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone: registrationForm.phone.trim(),
          skills,
          experienceYears: years,
          currentLocation: registrationForm.currentLocation.trim(),
        }),
      })

      if (!saved || saved.id == null) {
        throw new Error(
          'The server did not return a saved candidate.'
        )
      }

      setCandidates((previous) => [...previous, saved])
      setSelectedCandidate(String(saved.id))
      setApplicationCandidate(String(saved.id))
      invalidateMatches()

      setRegistrationForm(null)
      setRegistrationFile(null)
      setRegistrationFileKey((previous) => previous + 1)

      setRegistrationMessage(
        'Candidate registered successfully. View the Candidate Directory.'
      )
    } catch (err) {
      setRegistrationError(err.message)
    } finally {
      setRegistrationSaving(false)
    }
  }

  async function handleCandidateMatch(event) {
    event.preventDefault()

    setMatchingCandidate(true)
    setCandidateMatchError('')
    setCandidateMatchResult(null)

    try {
      const result = await api(
        `/api/match/jobs/${candidateMatchJob}` +
        `/candidates/${selectedCandidate}`
      )

      setCandidateMatchResult(result)
    } catch (err) {
      setCandidateMatchError(err.message)
    } finally {
      setMatchingCandidate(false)
    }
  }

  async function handleResumeMatch(event) {
    event.preventDefault()

    if (!resumeFile || !selectedJob) {
      setResumeError('Select a job and PDF resume.')
      return
    }

    if (
      !resumeFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setResumeError('Only PDF resumes are supported.')
      return
    }

    if (resumeFile.size > 5 * 1024 * 1024) {
      setResumeError('Maximum PDF size is 5 MB.')
      return
    }

    setAnalyzingResume(true)
    setResumeError('')
    setResumeResult(null)

    try {
      const form = new FormData()
      form.append('file', resumeFile)

      const result = await api(
        `/api/match/jobs/${selectedJob}/resume`,
        {
          method: 'POST',
          body: form,
        }
      )

      setResumeResult(result)
    } catch (err) {
      setResumeError(err.message)
    } finally {
      setAnalyzingResume(false)
    }
  }

  async function handleRankCandidates(event) {
    event.preventDefault()

    setRankingLoading(true)
    setRankingError('')
    setRankingComplete(false)
    setRankings([])

    try {
      const results = await Promise.all(
        candidates.map(async (candidate) => ({
          candidate,
          result: await api(
            `/api/match/jobs/${rankingJob}` +
            `/candidates/${candidate.id}`
          ),
        }))
      )

      results.sort(compareCandidateMatches)

      setRankings(results)
      setRankingComplete(true)
    } catch (err) {
      setRankingError(err.message)
    } finally {
      setRankingLoading(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">IH</div>
          <div>
            <h2>IntelliHire</h2>
            <p>Recruitment Intelligence</p>
          </div>
        </div>

        <div className="nav-label">OVERVIEW</div>

        <nav>
          <a href="#dashboard">▦ Dashboard</a>
          <a href="#recruitment-analytics">
            ◫ Recruitment Analytics
          </a>
          <a href="#jobs">▣ Job Openings</a>
          <a href="#candidates">♙ Candidates</a>
        </nav>

        <div className="nav-label">MANAGEMENT</div>

        <nav>
          <a href="#create-job">＋ Create Job</a>
          <a href="#add-candidate">＋ Add Candidate</a>
          <a href="#resume-registration">▤ Resume Registration</a>
          <a href="#recruitment-pipeline">
            ◈ Recruitment Pipeline
          </a>
        </nav>

        <div className="nav-label">MATCHING TOOLS</div>

        <nav>
          <a href="#candidate-rankings">
            ★ Candidate Rankings
          </a>
          <a href="#candidate-matcher">
            ◎ Candidate Matcher
          </a>
          <a href="#resume-matcher">
            ▤ Resume Matcher
          </a>
        </nav>

        <div className="sidebar-footer">
          IntelliHire v2.4
          <span>Local development</span>
        </div>
      </aside>

      <main className="main">
        <header className="header" id="dashboard">
          <div>
            <span className="eyebrow">
              RECRUITMENT OVERVIEW
            </span>
            <h1>Recruiter Dashboard</h1>
            <p>
              Manage job openings, candidates, and
              recruitment workflows.
            </p>
          </div>

          <span className="status">
            ● Matching Engine Ready
          </span>
        </header>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <section className="stats">
          <div className="stat-card">
            <div className="stat-icon purple">▣</div>
            <h3>Total Job Openings</h3>
            <strong>
              {loading ? '...' : jobs.length}
            </strong>
            <p>Jobs stored in IntelliHire</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">♙</div>
            <h3>Registered Candidates</h3>
            <strong>
              {loading ? '...' : candidates.length}
            </strong>
            <p>Candidate profiles available</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">◷</div>
            <h3>Average Experience</h3>
            <strong>
              {loading ? '...' : averageExperience}
              <span className="stat-unit"> yrs</span>
            </strong>
            <p>Across registered candidates</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">◎</div>
            <h3>Total Applications</h3>
            <strong>
              {loading ? '...' : applications.length}
            </strong>
            <p>Recruitment pipeline records</p>
          </div>
        </section>

        <RecruitmentAnalytics
          jobs={jobs}
          applications={applications}
        />

        <section className="panel" id="jobs">
          <div className="section-heading">
            <div>
              <h2>Job Openings</h2>
              <p>
                Browse and manage available positions.
              </p>
            </div>

            <span className="feature-tag">
              {filteredJobs.length} of {jobs.length} jobs
            </span>
          </div>

          <div className="filter-bar">
            <input
              aria-label="Search jobs"
              placeholder="Search title, company, location, skills..."
              value={jobSearch}
              onChange={(event) =>
                setJobSearch(event.target.value)
              }
            />

            <a className="link-button" href="#create-job">
              + New Job
            </a>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="empty-state">
              {jobs.length === 0
                ? 'No jobs yet. Create your first opening.'
                : 'No jobs match your search.'}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Job Title</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Min. Experience</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <strong>{job.title}</strong>
                      </td>
                      <td>{job.company}</td>
                      <td>{job.location || '—'}</td>
                      <td>
                        {job.minExperienceYears ?? 0} yrs
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="edit-button"
                            onClick={() =>
                              startEditJob(job)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="delete-button"
                            disabled={
                              deletingJobId === job.id
                            }
                            onClick={() =>
                              handleDeleteJob(job)
                            }
                          >
                            {deletingJobId === job.id
                              ? 'Deleting...'
                              : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" id="create-job">
          <div className="section-heading">
            <div>
              <h2>
                {editingJobId !== null
                  ? 'Edit Job Opening'
                  : 'Create Job Opening'}
              </h2>
              <p>
                {editingJobId !== null
                  ? 'Update an existing job.'
                  : 'Publish a new job to your database.'}
              </p>
            </div>

            <span className="feature-tag">
              Job Management
            </span>
          </div>

          <form
            className="job-form"
            onSubmit={handleSaveJob}
          >
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="job-title">
                  Job Title *
                </label>
                <input
                  id="job-title"
                  name="title"
                  value={jobForm.title}
                  onChange={updateJobField}
                  placeholder="Java Backend Developer"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="job-company">
                  Company *
                </label>
                <input
                  id="job-company"
                  name="company"
                  value={jobForm.company}
                  onChange={updateJobField}
                  placeholder="Company name"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="job-location">
                  Location
                </label>
                <input
                  id="job-location"
                  name="location"
                  value={jobForm.location}
                  onChange={updateJobField}
                  placeholder="Bengaluru"
                />
              </div>

              <div className="form-field">
                <label htmlFor="job-experience">
                  Minimum Experience (Years)
                </label>
                <input
                  id="job-experience"
                  name="minExperienceYears"
                  type="number"
                  min="0"
                  step="1"
                  value={jobForm.minExperienceYears}
                  onChange={updateJobField}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="job-skills">
                Job Skills (comma-separated) *
              </label>
              <input
                id="job-skills"
                name="requiredSkills"
                value={jobForm.requiredSkills}
                onChange={updateJobField}
                placeholder="Python, Machine Learning, LLMs, ?SQL, ?REST APIs"
                required
              />
              <p className="muted small">
                Unmarked skills are mandatory. Prefix optional skills with ? (for example, ?SQL).
                Existing jobs remain compatible.
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="job-description">
                Job Description
              </label>
              <textarea
                id="job-description"
                name="description"
                rows="4"
                value={jobForm.description}
                onChange={updateJobField}
                placeholder="Describe the role..."
              />
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                disabled={savingJob}
              >
                {savingJob
                  ? 'Saving...'
                  : editingJobId !== null
                    ? 'Save Changes'
                    : '+ Create Job'}
              </button>

              {editingJobId !== null && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditJob}
                  disabled={savingJob}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {jobMessage && (
            <div
              className="success-message"
              role="status"
            >
              {jobMessage}
            </div>
          )}

          {jobError && (
            <div className="error" role="alert">
              {jobError}
            </div>
          )}
        </section>

        <section className="panel" id="candidates">
          <div className="section-heading">
            <div>
              <h2>Candidate Directory</h2>
              <p>
                Search and filter registered candidate
                profiles.
              </p>
            </div>

            <span className="feature-tag">
              {filteredCandidates.length} of{' '}
              {candidates.length} candidates
            </span>
          </div>

          <div className="filter-bar">
            <input
              aria-label="Search candidates"
              placeholder="Search name, email, location..."
              value={candidateSearch}
              onChange={(event) =>
                setCandidateSearch(event.target.value)
              }
            />

            <input
              aria-label="Filter by skill"
              placeholder="Filter by skill..."
              value={skillFilter}
              onChange={(event) =>
                setSkillFilter(event.target.value)
              }
            />

            <select
              aria-label="Filter by experience"
              value={experienceFilter}
              onChange={(event) =>
                setExperienceFilter(event.target.value)
              }
            >
              <option value="all">
                All Experience
              </option>
              <option value="0-1">0–1 years</option>
              <option value="2-4">2–4 years</option>
              <option value="5+">5+ years</option>
            </select>

            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setCandidateSearch('')
                setSkillFilter('')
                setExperienceFilter('all')
              }}
            >
              Clear
            </button>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="empty-state">
              {candidates.length === 0
                ? 'No candidates yet. Add your first candidate.'
                : 'No candidates match these filters.'}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Experience</th>
                    <th>Location</th>
                    <th>Skills</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCandidates.map(
                    (candidate) => (
                      <tr key={candidate.id}>
                        <td>
                          <strong>
                            {candidate.name}
                          </strong>
                          <div className="muted small">
                            {candidate.email}
                          </div>
                        </td>

                        <td>
                          {candidate.experienceYears ??
                            0}{' '}
                          yrs
                        </td>

                        <td>
                          {candidate.currentLocation ||
                            '—'}
                        </td>

                        <td className="skills-cell">
                          {candidate.skills || '—'}
                        </td>

                        <td>
                          <div className="table-actions">
                            <button
                              className="edit-button"
                              onClick={() =>
                                startEditCandidate(
                                  candidate
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="delete-button"
                              disabled={
                                deletingCandidateId ===
                                candidate.id
                              }
                              onClick={() =>
                                handleDeleteCandidate(
                                  candidate
                                )
                              }
                            >
                              {deletingCandidateId ===
                                candidate.id
                                ? 'Deleting...'
                                : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="panel"
          id="add-candidate"
        >
          <div className="section-heading">
            <div>
              <h2>
                {editingCandidateId !== null
                  ? 'Edit Candidate'
                  : 'Add Candidate'}
              </h2>
              <p>
                {editingCandidateId !== null
                  ? 'Update a registered profile.'
                  : 'Register a candidate in IntelliHire.'}
              </p>
            </div>

            <span className="feature-tag">
              Candidate Management
            </span>
          </div>

          <form
            className="job-form"
            onSubmit={handleSaveCandidate}
          >
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="candidate-name">
                  Full Name *
                </label>
                <input
                  id="candidate-name"
                  name="name"
                  value={candidateForm.name}
                  onChange={updateCandidateField}
                  placeholder="Candidate name"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="candidate-email">
                  Email *
                </label>
                <input
                  id="candidate-email"
                  name="email"
                  type="email"
                  value={candidateForm.email}
                  onChange={updateCandidateField}
                  placeholder="candidate@example.com"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="candidate-phone">
                  Phone
                </label>
                <input
                  id="candidate-phone"
                  name="phone"
                  type="tel"
                  value={candidateForm.phone}
                  onChange={updateCandidateField}
                  placeholder="Phone number"
                />
              </div>

              <div className="form-field">
                <label htmlFor="candidate-location">
                  Current Location
                </label>
                <input
                  id="candidate-location"
                  name="currentLocation"
                  value={
                    candidateForm.currentLocation
                  }
                  onChange={updateCandidateField}
                  placeholder="Bengaluru"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="candidate-experience">
                  Experience (Years)
                </label>
                <input
                  id="candidate-experience"
                  name="experienceYears"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    candidateForm.experienceYears
                  }
                  onChange={updateCandidateField}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="candidate-skills">
                  Technical Skills *
                </label>
                <input
                  id="candidate-skills"
                  name="skills"
                  value={candidateForm.skills}
                  onChange={updateCandidateField}
                  placeholder="Java, SQL, Git"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                disabled={savingCandidate}
              >
                {savingCandidate
                  ? 'Saving...'
                  : editingCandidateId !== null
                    ? 'Save Changes'
                    : '+ Add Candidate'}
              </button>

              {editingCandidateId !== null && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={cancelEditCandidate}
                  disabled={savingCandidate}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {candidateMessage && (
            <div
              className="success-message"
              role="status"
            >
              {candidateMessage}
            </div>
          )}

          {candidateError && (
            <div className="error" role="alert">
              {candidateError}
            </div>
          )}
        </section>

        <section className="panel" id="resume-registration">
          <div className="section-heading">
            <div>
              <h2>Resume Registration</h2>
              <p>
                Upload a PDF, review extracted details, and
                register a candidate after confirmation.
              </p>
            </div>
            <span className="feature-tag">
              PDF Candidate Intake
            </span>
          </div>

          <form
            className="job-form"
            onSubmit={handleParseRegistration}
          >
            <div className="form-field">
              <label htmlFor="registration-pdf">
                Candidate PDF Resume *
              </label>
              <input
                key={registrationFileKey}
                id="registration-pdf"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleRegistrationFileChange}
                disabled={registrationParsing || registrationSaving}
                required
              />
              <small>
                PDF only · Maximum 5 MB · Uploading does not
                save a candidate.
              </small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={
                  registrationParsing ||
                  registrationSaving ||
                  !registrationFile
                }
              >
                {registrationParsing
                  ? 'Extracting...'
                  : 'Extract Candidate Details'}
              </button>
            </div>
          </form>

          {registrationError && (
            <div className="error" role="alert">
              {registrationError}
            </div>
          )}

          {registrationMessage && (
            <div className="success-message" role="status">
              {registrationMessage}
            </div>
          )}

          {registrationForm && (
            <div style={{ marginTop: '24px' }}>
              <h3>Review Extracted Candidate Details</h3>
              <p className="muted">
                Verify each field against the original resume
                before saving.
              </p>

              <form
                className="job-form"
                onSubmit={handleSaveRegistration}
              >
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="registration-name">
                      Full Name *
                    </label>
                    <input
                      id="registration-name"
                      name="name"
                      value={registrationForm.name}
                      onChange={updateRegistrationField}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="registration-email">
                      Email *
                    </label>
                    <input
                      id="registration-email"
                      name="email"
                      type="email"
                      value={registrationForm.email}
                      onChange={updateRegistrationField}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="registration-phone">
                      Phone
                    </label>
                    <input
                      id="registration-phone"
                      name="phone"
                      type="tel"
                      value={registrationForm.phone}
                      onChange={updateRegistrationField}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="registration-location">
                      Current Location
                    </label>
                    <input
                      id="registration-location"
                      name="currentLocation"
                      placeholder="Enter current location"
                      value={registrationForm.currentLocation}
                      onChange={updateRegistrationField}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="registration-experience">
                      Experience (Years) *
                    </label>
                    <input
                      id="registration-experience"
                      name="experienceYears"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Enter years of experience"
                      value={registrationForm.experienceYears}
                      onChange={updateRegistrationField}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="registration-skills">
                      Technical Skills *
                    </label>
                    <textarea
                      id="registration-skills"
                      name="skills"
                      rows="3"
                      value={registrationForm.skills}
                      onChange={updateRegistrationField}
                      required
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      registrationSaving ||
                      registrationParsing
                    }
                  >
                    {registrationSaving
                      ? 'Saving Candidate...'
                      : 'Save Candidate'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={registrationSaving}
                    onClick={() => {
                      setRegistrationForm(null)
                      setRegistrationMessage(
                        'Registration cancelled. No candidate was saved.'
                      )
                      setRegistrationError('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>


        <section
          className="panel"
          id="recruitment-pipeline"
        >
          <div className="section-heading">
            <div>
              <h2>Recruitment Pipeline</h2>
              <p>
                Track applications throughout the
                hiring process.
              </p>
            </div>

            <span className="feature-tag">
              Application Tracking
            </span>
          </div>

          <div className="pipeline-stats">
            {applicationStatuses.map((status) => (
              <div
                className="pipeline-stat"
                key={status}
              >
                <span>{status}</span>
                <strong>
                  {pipelineCounts[status]}
                </strong>
              </div>
            ))}
          </div>

          <h3>Create Application</h3>

          <form
            className="matcher-form"
            onSubmit={handleCreateApplication}
          >
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="application-job">
                  Job Opening
                </label>

                <select
                  id="application-job"
                  value={applicationJob}
                  onChange={(event) =>
                    setApplicationJob(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select job
                  </option>

                  {jobs.map((job) => (
                    <option
                      key={job.id}
                      value={job.id}
                    >
                      {job.title} — {job.company}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="application-candidate">
                  Candidate
                </label>

                <select
                  id="application-candidate"
                  value={applicationCandidate}
                  onChange={(event) =>
                    setApplicationCandidate(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select candidate
                  </option>

                  {candidates.map((candidate) => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.name} —{' '}
                      {candidate.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              className="primary-button"
              disabled={
                applicationSaving ||
                jobs.length === 0 ||
                candidates.length === 0
              }
            >
              {applicationSaving
                ? 'Creating Application...'
                : '+ Add to Pipeline'}
            </button>
          </form>

          {applicationError && (
            <div
              className="error"
              role="alert"
            >
              {applicationError}
            </div>
          )}

          {applicationMessage && (
            <div
              className="success-message"
              role="status"
            >
              {applicationMessage}
            </div>
          )}

          <div className="pipeline-table-heading">
            <h3>All Applications</h3>

            <span className="feature-tag">
              {applications.length} total
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="empty-state">
              No applications yet. Add a candidate
              to begin tracking.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job Opening</th>
                    <th>Current Status</th>
                    <th>Applied On</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {applications.map(
                    (application) => (
                      <tr key={application.id}>
                        <td>
                          <strong>
                            {
                              application.candidate
                                .name
                            }
                          </strong>

                          <div className="muted small">
                            {
                              application.candidate
                                .email
                            }
                          </div>
                        </td>

                        <td>
                          <strong>
                            {application.job.title}
                          </strong>

                          <div className="muted small">
                            {application.job.company}
                          </div>
                        </td>

                        <td>
                          <select
                            className="pipeline-status-select"
                            value={
                              application.status
                            }
                            disabled={
                              applicationUpdatingId ===
                              application.id
                            }
                            onChange={(event) =>
                              handleUpdateApplicationStatus(
                                application.id,
                                event.target.value
                              )
                            }
                          >
                            {applicationStatuses.map(
                              (status) => (
                                <option
                                  key={status}
                                  value={status}
                                >
                                  {status}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td>
                          {application.appliedAt
                            ? new Date(
                              application.appliedAt
                            ).toLocaleDateString()
                            : '—'}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="delete-button"
                            disabled={
                              applicationDeletingId ===
                              application.id
                            }
                            onClick={() =>
                              handleDeleteApplication(
                                application
                              )
                            }
                          >
                            {applicationDeletingId ===
                              application.id
                              ? 'Deleting...'
                              : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="panel"
          id="candidate-rankings"
        >
          <div className="section-heading">
            <div>
              <h2>Candidate Rankings</h2>
              <p>
                Compare every registered candidate
                against one job.
              </p>
            </div>

            <span className="feature-tag">
              Matching Tools
            </span>
          </div>

          <form
            className="matcher-form"
            onSubmit={handleRankCandidates}
          >
            <div className="form-field">
              <label htmlFor="ranking-job">
                Job Opening
              </label>

              <select
                id="ranking-job"
                value={rankingJob}
                onChange={(event) => {
                  setRankingJob(event.target.value)
                  clearRankings()
                }}
                required
              >
                <option value="">
                  Choose a job
                </option>

                {jobs.map((job) => (
                  <option
                    key={job.id}
                    value={job.id}
                  >
                    {job.title} — {job.company}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="primary-button"
              disabled={
                rankingLoading ||
                !rankingJob ||
                candidates.length === 0
              }
            >
              {rankingLoading
                ? 'Ranking Candidates...'
                : 'Rank All Candidates'}
            </button>
          </form>

          {rankingError && (
            <div className="error" role="alert">
              {rankingError}
            </div>
          )}

          {rankingComplete && (
            <div className="match-results">
              <h3>
                Ranked Candidates (
                {rankings.length})
              </h3>

              <p className="muted small">
                Ranked by mandatory skill coverage, then experience eligibility,
                then preferred skill coverage. Evidence-aware score breaks remaining
                ties. If no mandatory skills are specified, preferred coverage is
                used first. These are transparent screening signals, not hiring decisions.
              </p>

              {rankings.map(
                ({ candidate, result }, index) => {
                  const raw = Number(
                    result.matchScore ?? 0
                  )

                  const score = Number.isFinite(raw)
                    ? Math.max(
                      0,
                      Math.min(100, raw)
                    )
                    : 0

                  return (
                    <div
                      className="ranking-card"
                      key={candidate.id}
                    >
                      <div className="result-heading">
                        <div>
                          <span className="rank-label">
                            RANK #{index + 1}
                          </span>

                          <h3>
                            {candidate.name}
                          </h3>

                          <p className="muted">
                            {candidate.email}
                          </p>
                        </div>

                        <div className="score-circle">
                          {score}%
                        </div>
                      </div>

                      <div className="score-track">
                        <div
                          className="score-fill"
                          style={{
                            width: `${score}%`,
                          }}
                        />
                      </div>

                      <SemanticSimilarity result={result} />
                      <HybridPreview result={result} />
                      <RequirementAnalysis result={result} />
                      <RankingExplanation result={result} />
                      <MatchExplanation result={result} />

                      <p className="muted">
                        {candidate.experienceYears ??
                          'Unknown'}{' '}
                        years experience ·{' '}
                        {result.experienceEligible ==
                          null
                          ? 'Eligibility unknown'
                          : result.experienceEligible
                            ? 'Meets requirement'
                            : 'Below requirement'}
                      </p>

                      <div className="result-grid">
                        <div className="result-box">
                          <h4>
                            Matched Skills
                          </h4>
                          <SkillTags
                            skills={
                              result.matchedSkills
                            }
                            type="matched"
                          />
                        </div>

                        <div className="result-box">
                          <h4>
                            Missing Skills
                          </h4>
                          <SkillTags
                            skills={
                              result.missingSkills
                            }
                            type="missing"
                          />
                        </div>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </section>

        <section
          className="panel"
          id="candidate-matcher"
        >
          <div className="section-heading">
            <div>
              <h2>Candidate-to-Job Matcher</h2>
              <p>
                Analyze an individual registered
                candidate.
              </p>
            </div>

            <span className="feature-tag">
              Skill Analysis
            </span>
          </div>

          <form
            className="matcher-form"
            onSubmit={handleCandidateMatch}
          >
            <div className="form-field">
              <label htmlFor="match-job">
                Job Opening
              </label>

              <select
                id="match-job"
                value={candidateMatchJob}
                onChange={(event) => {
                  setCandidateMatchJob(
                    event.target.value
                  )
                  setCandidateMatchResult(null)
                }}
                required
              >
                <option value="">
                  Choose a job
                </option>

                {jobs.map((job) => (
                  <option
                    key={job.id}
                    value={job.id}
                  >
                    {job.title} — {job.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="match-candidate">
                Candidate
              </label>

              <select
                id="match-candidate"
                value={selectedCandidate}
                onChange={(event) => {
                  setSelectedCandidate(
                    event.target.value
                  )
                  setCandidateMatchResult(null)
                }}
                required
              >
                <option value="">
                  Choose a candidate
                </option>

                {candidates.map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                  >
                    {candidate.name} —{' '}
                    {candidate.email}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="primary-button"
              disabled={
                matchingCandidate ||
                !candidateMatchJob ||
                !selectedCandidate
              }
            >
              {matchingCandidate
                ? 'Matching...'
                : 'Match Candidate'}
            </button>
          </form>

          {candidateMatchError && (
            <div className="error" role="alert">
              {candidateMatchError}
            </div>
          )}

          {candidateMatchResult && (
            <MatchResults
              result={candidateMatchResult}
            />
          )}
        </section>

        <section
          className="panel"
          id="resume-matcher"
        >
          <div className="section-heading">
            <div>
              <h2>Resume Matcher</h2>
              <p>
                Upload a PDF and compare its
                detected skills with a job opening.
              </p>
            </div>

            <span className="feature-tag">
              PDF Analysis
            </span>
          </div>

          <form
            className="matcher-form"
            onSubmit={handleResumeMatch}
          >
            <div className="form-field">
              <label htmlFor="resume-job">
                Job Opening
              </label>

              <select
                id="resume-job"
                value={selectedJob}
                onChange={(event) => {
                  setSelectedJob(event.target.value)
                  setResumeResult(null)
                }}
                required
              >
                <option value="">
                  Choose a job
                </option>

                {jobs.map((job) => (
                  <option
                    key={job.id}
                    value={job.id}
                  >
                    {job.title} — {job.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="resume-file">
                PDF Resume
              </label>

              <input
                id="resume-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  setResumeFile(
                    event.target.files?.[0] || null
                  )
                  setResumeResult(null)
                }}
                required
              />

              <small>
                Maximum file size: 5 MB
              </small>
            </div>

            <button
              className="primary-button"
              disabled={
                analyzingResume || !selectedJob
              }
            >
              {analyzingResume
                ? 'Analyzing...'
                : 'Analyze Resume'}
            </button>
          </form>

          {resumeError && (
            <div className="error" role="alert">
              {resumeError}
            </div>
          )}

          {resumeResult && (
            <MatchResults
              result={resumeResult}
              showDetectedSkills
            />
          )}
        </section>

        <footer className="app-footer">
          IntelliHire · Recruitment Management Platform
          <span>
            Rule-based + local AI similarity · Local development
          </span>
        </footer>
      </main>
    </div>
  )
}

export default App