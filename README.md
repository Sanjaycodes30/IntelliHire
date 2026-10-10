# IntelliHire

**AI-Powered Recruitment and Candidate Matching Platform**

IntelliHire is a full-stack recruitment application that helps organize job openings, manage candidates, process resumes, and evaluate candidate suitability using skill-based and semantic matching.

The platform combines structured recruitment workflows with explainable AI-assisted scoring to support more transparent candidate evaluation.

## Key Features

- **Job Management:** Create, view, update, and delete job openings.
- **Candidate Management:** Maintain candidate profiles and associated information.
- **Application Tracking:** Manage job applications and update their recruitment status.
- **Resume Processing:** Upload and parse resumes to extract relevant information.
- **Skill Extraction and Normalization:** Identify and standardize technical skills for matching.
- **AI-Assisted Matching:** Combine structured skill evaluation with semantic similarity from locally generated embeddings.
- **Explainable Candidate Scoring:** Provide matching evidence, mandatory/preferred skill coverage, and ranking information.
- **Graceful AI Fallback:** Continue evidence-based evaluation when the local embedding service is unavailable.

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Java, Spring Boot, Maven |
| Frontend | React, Vite, JavaScript, CSS |
| Database | PostgreSQL |
| Persistence | Spring Data JPA / Hibernate |
| AI Embeddings | Ollama, `nomic-embed-text` |
| Resume Processing | PDF parsing and skill extraction |
| Version Control | Git and GitHub |

## System Architecture

```text
React + Vite Frontend
        |
        | REST API
        v
Spring Boot Backend
        |
        +---- PostgreSQL
        |     Jobs, candidates, applications
        |
        +---- Resume Processing
        |     Parsing, skill extraction
        |
        +---- Matching Engine
              Skill coverage, evidence scoring
              |
              +---- Ollama
                    Local semantic embeddings
```

## API Overview

### Jobs

| Method | Endpoint |
|---|---|
| GET | `/api/jobs` |
| GET | `/api/jobs/{id}` |
| POST | `/api/jobs` |
| PUT | `/api/jobs/{id}` |
| DELETE | `/api/jobs/{id}` |

### Candidates

| Method | Endpoint |
|---|---|
| GET | `/api/candidates` |
| GET | `/api/candidates/{id}` |
| POST | `/api/candidates` |
| PUT | `/api/candidates/{id}` |
| DELETE | `/api/candidates/{id}` |

### Applications

| Method | Endpoint |
|---|---|
| GET | `/api/applications` |
| GET | `/api/applications/job/{jobId}` |
| GET | `/api/applications/candidate/{candidateId}` |
| POST | `/api/applications` |
| PUT | `/api/applications/{id}/status` |
| DELETE | `/api/applications/{id}` |

### Resume Processing and Matching

| Method | Endpoint |
|---|---|
| POST | `/api/resumes/upload` |
| POST | `/api/resumes/parse` |
| GET | `/api/match/jobs/{jobId}/candidates/{candidateId}` |
| POST | `/api/match/jobs/{jobId}/resume` |

### Diagnostics

| Method | Endpoint |
|---|---|
| GET | `/api/health` |
| GET | `/api/test/embeddings` |

The embedding test endpoint is intended for development diagnostics.

## Local Development

### Prerequisites

- Java compatible with the project's Maven configuration
- Maven
- Node.js and npm
- PostgreSQL
- Ollama with the `nomic-embed-text` model

### 1. Clone the Repository

```bash
git clone https://github.com/Sanjaycodes30/IntelliHire.git
cd IntelliHire
```

### 2. Configure PostgreSQL

Create a PostgreSQL database named `intellihire` and configure the database connection in `src/main/resources/application.properties`.

Set your database password as an environment variable:

```bash
export DB_PASSWORD='your_local_database_password'
```

Never commit database passwords or other credentials to source control.

### 3. Start Ollama

Ensure Ollama is running locally and download the embedding model if necessary:

```bash
ollama pull nomic-embed-text
```

### 4. Start the Backend

```bash
mvn spring-boot:run
```

The backend runs at `http://localhost:8080` by default.

### 5. Start the Frontend

Open another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The frontend is available at `http://localhost:5173` by default.

## Testing

Run backend tests:

```bash
mvn test
```

Build the frontend:

```bash
cd frontend
npm run build
```

Run frontend lint checks:

```bash
npm run lint
```

## AI Matching Approach

IntelliHire evaluates candidates using a combination of structured matching and semantic relevance.

1. Extract candidate skills from profile or resume information.
2. Normalize skill names to improve consistency.
3. Compare candidate skills against mandatory and preferred job requirements.
4. Evaluate available experience information.
5. Generate semantic similarity signals using Ollama embeddings when available.
6. Produce explainable scoring information to support candidate comparison.

If Ollama is unavailable, the application can fall back to its non-semantic evidence score.

**Note:** Matching scores are decision-support signals, not guarantees of candidate suitability. Recruitment decisions should include human review.

## Future Improvements

- Authentication and role-based access control
- More comprehensive automated testing
- Improved resume extraction and parsing
- Deployment and production configuration
- Expanded recruitment analytics

## Project Status

**Active Development**

IntelliHire currently includes a functional backend, React frontend, PostgreSQL persistence, resume-processing capabilities, and AI-assisted candidate matching.

---

Built as a full-stack software engineering and applied AI project.