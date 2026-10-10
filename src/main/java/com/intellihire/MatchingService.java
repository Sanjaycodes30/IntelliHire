package com.intellihire;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.web.multipart.MultipartFile;

import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

import java.util.Arrays;

import java.util.LinkedHashMap;

import java.util.LinkedHashSet;

import java.util.List;

import java.util.Map;

import java.util.Set;

import java.util.stream.Collectors;

@Service

public class MatchingService {

    private final JobRepository jobRepository;

    private final CandidateRepository candidateRepository;

    private final ResumeParserService resumeParserService;

    private final SkillExtractionService skillExtractionService;

    private final SkillNormalizer skillNormalizer;

    private final OllamaEmbeddingService embeddingService;

    public MatchingService(

            JobRepository jobRepository,

            CandidateRepository candidateRepository,

            ResumeParserService resumeParserService,

            SkillExtractionService skillExtractionService,

            SkillNormalizer skillNormalizer,

            OllamaEmbeddingService embeddingService) {

        this.jobRepository = jobRepository;

        this.candidateRepository = candidateRepository;

        this.resumeParserService = resumeParserService;

        this.skillExtractionService = skillExtractionService;

        this.skillNormalizer = skillNormalizer;

        this.embeddingService = embeddingService;

    }

    // Match an existing candidate against a job

    public Map<String, Object> matchCandidate(

            Long jobId, Long candidateId) {

        Job job = findJob(jobId);

        Candidate candidate = candidateRepository.findById(candidateId)

                .orElseThrow(() -> new ResponseStatusException(

                        HttpStatus.NOT_FOUND,

                        "Candidate not found"));

        Set<String> candidateSkills = parseSkills(candidate.getSkills());

        Map<String, Object> result = calculateMatch(job, candidateSkills);

        Integer requiredExperience = job.getMinExperienceYears();

        Integer candidateExperience = candidate.getExperienceYears();

        Boolean experienceEligible;

        if (requiredExperience == null || requiredExperience == 0) {

            experienceEligible = true;

        } else if (candidateExperience == null) {

            experienceEligible = null;

        } else {

            experienceEligible = candidateExperience >= requiredExperience;

        }

        result.put("candidateId", candidate.getId());

        result.put("candidateName", candidate.getName());

        result.put(

                "requiredExperienceYears",

                requiredExperience == null ? 0 : requiredExperience);

        result.put("candidateExperienceYears", candidateExperience);

        result.put("experienceEligible", experienceEligible);

        // Build a richer profile using existing candidate data.

        // Full resume text is not stored for registered candidates.

        StringBuilder candidateProfile = new StringBuilder();

        if (!candidateSkills.isEmpty()) {

            candidateProfile.append("Technical skills: ")

                    .append(String.join(", ", candidateSkills))

                    .append(".\n");

        }

        if (candidateExperience != null) {

            candidateProfile.append("Professional experience: ")

                    .append(candidateExperience)

                    .append(" years.\n");

        }

        if (candidate.getCurrentLocation() != null

                && !candidate.getCurrentLocation().isBlank()) {

            candidateProfile.append("Current location: ")

                    .append(candidate.getCurrentLocation().trim())

                    .append(".\n");

        }

        addSemanticSimilarity(

                result,

                job,

                candidateProfile.toString(),

                candidateSkills,

                "CANDIDATE_PROFILE");

        addEvidenceScore(result);
        addMatchExplanation(result);

        return result;

    }

    // Match an uploaded PDF resume against a job

    public Map<String, Object> matchResume(

            Long jobId, MultipartFile file) throws IOException {

        Job job = findJob(jobId);

        String resumeText = resumeParserService.extractText(file);

        List<String> detectedSkills = skillExtractionService.extractSkills(resumeText);

        Set<String> candidateSkills = parseSkills(String.join(",", detectedSkills));

        Map<String, Object> result = calculateMatch(job, candidateSkills);

        result.put("detectedSkills", detectedSkills);

        result.put("totalSkillsDetected", detectedSkills.size());

        Integer requiredExperience = job.getMinExperienceYears();

        result.put(

                "requiredExperienceYears",

                requiredExperience == null ? 0 : requiredExperience);

        // Experience extraction from PDFs is not yet implemented.

        result.put("candidateExperienceYears", null);

        result.put(

                "experienceEligible",

                requiredExperience == null || requiredExperience == 0

                        ? true

                        : null);

        // Compare against the actual PDF text, not just detected skills.

        StringBuilder resumeProfile = new StringBuilder();

        if (!candidateSkills.isEmpty()) {

            resumeProfile.append("Detected technical skills: ")

                    .append(String.join(", ", candidateSkills))

                    .append(".\n");

        }

        if (resumeText != null && !resumeText.isBlank()) {

            resumeProfile.append("Resume content:\n")

                    .append(resumeText);

        }

        addSemanticSimilarity(

                result,

                job,

                resumeProfile.toString(),

                candidateSkills,

                "RESUME_TEXT");

        addEvidenceScore(result);
        addMatchExplanation(result);

        return result;

    }

    // Preserve the original rule-based matching calculation

    private Map<String, Object> calculateMatch(

            Job job, Set<String> candidateSkills) {

        RequirementSkills requirements = parseRequirements(job.getRequiredSkills());

        Set<String> requiredSkills = requirements.allSkills();

        List<String> matchedSkills = requiredSkills.stream()

                .filter(candidateSkills::contains)

                .toList();

        List<String> missingSkills = requiredSkills.stream()

                .filter(skill -> !candidateSkills.contains(skill))

                .toList();

        double matchScore = requiredSkills.isEmpty()

                ? 0.0

                : Math.round(

                        matchedSkills.size() * 10000.0

                                / requiredSkills.size())

                        / 100.0;

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("jobId", job.getId());

        result.put("jobTitle", job.getTitle());

        result.put("matchScore", matchScore);

        result.put("matchedSkills", matchedSkills);

        result.put("missingSkills", missingSkills);

        List<String> missingMandatory = requirements.mandatory().stream()
                .filter(skill -> !candidateSkills.contains(skill)).toList();
        List<String> matchedMandatory = requirements.mandatory().stream()
                .filter(candidateSkills::contains).toList();
        List<String> matchedPreferred = requirements.preferred().stream()
                .filter(candidateSkills::contains).toList();
        List<String> missingPreferred = requirements.preferred().stream()
                .filter(skill -> !candidateSkills.contains(skill)).toList();
        result.put("mandatorySkills", List.copyOf(requirements.mandatory()));
        result.put("preferredSkills", List.copyOf(requirements.preferred()));
        result.put("matchedMandatorySkills", matchedMandatory);
        result.put("missingMandatorySkills", missingMandatory);
        result.put("matchedPreferredSkills", matchedPreferred);
        result.put("missingPreferredSkills", missingPreferred);
        result.put("mandatoryCoverage", percentage(matchedMandatory.size(), requirements.mandatory().size()));
        result.put("preferredCoverage", percentage(matchedPreferred.size(), requirements.preferred().size()));
        result.put("mandatoryRequirementsMet", missingMandatory.isEmpty() && !requirements.mandatory().isEmpty());
        result.put("requirementStatus", requirements.mandatory().isEmpty()
                ? "NO_MANDATORY_SKILLS"
                : missingMandatory.isEmpty()
                        ? "ALL_MANDATORY_MATCHED"
                        : "MISSING_MANDATORY_SKILLS");

        return result;

    }

    // Construct richer job context for AI embeddings

    private String buildJobContext(Job job) {

        StringBuilder context = new StringBuilder();

        if (job.getTitle() != null && !job.getTitle().isBlank()) {

            context.append("Job title: ")

                    .append(job.getTitle().trim())

                    .append(".\n");

        }

        RequirementSkills requirements = parseRequirements(job.getRequiredSkills());
        if (!requirements.mandatory().isEmpty()) {
            context.append("Mandatory technical skills: ")
                    .append(String.join(", ", requirements.mandatory())).append(".\n");
        }
        if (!requirements.preferred().isEmpty()) {
            context.append("Preferred technical skills: ")
                    .append(String.join(", ", requirements.preferred())).append(".\n");
        }

        if (job.getDescription() != null

                && !job.getDescription().isBlank()) {

            context.append("Job description:\n")

                    .append(job.getDescription().trim())

                    .append("\n");

        }

        if (job.getMinExperienceYears() != null) {

            context.append("Minimum experience: ")

                    .append(job.getMinExperienceYears())

                    .append(" years.\n");

        }

        return context.toString();

    }

    // Add context-aware semantic similarity without altering matchScore

    private void addSemanticSimilarity(

            Map<String, Object> result,

            Job job,

            String candidateContext,

            Set<String> candidateSkills,

            String comparisonType) {

        result.put("semanticSimilarity", null);

        result.put("semanticStatus", "INSUFFICIENT_DATA");

        result.put("semanticModel", "nomic-embed-text");

        result.put("semanticComparisonType", comparisonType);

        String jobContext = buildJobContext(job);

        // Require meaningful candidate evidence.

        // Resume text can be useful even when no known skills are detected.

        boolean hasCandidateEvidence = comparisonType.equals("RESUME_TEXT")

                ? candidateContext != null

                        && !candidateContext.isBlank()

                : !candidateSkills.isEmpty();

        if (jobContext.isBlank() || !hasCandidateEvidence) {

            return;

        }

        try {

            double[] jobEmbedding = embeddingService.generateEmbedding(jobContext);

            double[] candidateEmbedding = embeddingService.generateEmbedding(candidateContext);

            double similarity = embeddingService.cosineSimilarity(

                    jobEmbedding,

                    candidateEmbedding);

            double roundedSimilarity = Math.round(similarity * 10000.0) / 10000.0;

            result.put("semanticSimilarity", roundedSimilarity);

            result.put("semanticStatus", "SUCCESS");

        } catch (InterruptedException e) {

            Thread.currentThread().interrupt();

            result.put("semanticStatus", "UNAVAILABLE");

        } catch (IOException | IllegalArgumentException e) {

            result.put("semanticStatus", "UNAVAILABLE");

        }

    }

    // Experimental, evidence-gated relevance signal. Not a qualification
    // probability.
    // No required skill evidence => no semantic bonus, even with high cosine
    // similarity.
    // Never alter the original matchScore or experienceEligible values.
    private void addEvidenceScore(Map<String, Object> result) {
        double coverage = ((Number) result.get("matchScore")).doubleValue();
        coverage = Math.max(0.0, Math.min(100.0, coverage));

        @SuppressWarnings("unchecked")
        List<String> matched = (List<String>) result.get("matchedSkills");
        @SuppressWarnings("unchecked")
        List<String> missing = (List<String>) result.get("missingSkills");

        int matchedCount = matched.size();
        int requiredCount = matchedCount + missing.size();
        boolean semanticAvailable = "SUCCESS".equals(result.get("semanticStatus"))
                && result.get("semanticSimilarity") instanceof Number;

        double relevance = coverage;
        double semanticBonus = 0.0;
        if (requiredCount > 0 && matchedCount > 0 && semanticAvailable) {
            double cosine = ((Number) result.get("semanticSimilarity")).doubleValue();
            if (Double.isFinite(cosine)) {
                // A deliberately small, gated bonus; 15% is experimental, NOT calibrated.
                double bounded = Math.max(0.0, Math.min(1.0, cosine));
                double coverageFraction = (double) matchedCount / requiredCount;
                semanticBonus = (100.0 - coverage) * 0.15 * coverageFraction * bounded;
                relevance = Math.min(100.0, coverage + semanticBonus);
            }
        }

        result.put("evidenceScore", Math.round(relevance * 100.0) / 100.0);
        result.put("evidenceScoreUsesMandatoryWeighting", false); // No unvalidated weighting yet.
        result.put("semanticBonus", Math.round(semanticBonus * 100.0) / 100.0);
        result.put("evidenceScoreStatus", requiredCount == 0 ? "NO_REQUIRED_SKILLS"
                : !semanticAvailable ? "RULE_BASED_FALLBACK" : "EXPERIMENTAL");
        result.put("evidenceExplanation", requiredCount == 0
                ? "No required skills were specified; no relevance score can be assessed."
                : matchedCount == 0
                        ? "No required skills matched. Semantic similarity adds no points."
                        : !semanticAvailable
                                ? "Ollama similarity is unavailable; using required-skill coverage only."
                                : "Skill coverage is the primary evidence; semantic similarity can add a small gated bonus.");
    }

    // Step 6I: deterministic explanations derived only from measured evidence.
    // This does not modify scoring, ranking, or persisted data.
    @SuppressWarnings("unchecked")
    private void addMatchExplanation(Map<String, Object> result) {
        List<String> mandatory = (List<String>) result.get("mandatorySkills");
        List<String> preferred = (List<String>) result.get("preferredSkills");
        List<String> matchedMandatory = (List<String>) result.get("matchedMandatorySkills");
        List<String> missingMandatory = (List<String>) result.get("missingMandatorySkills");
        List<String> matchedPreferred = (List<String>) result.get("matchedPreferredSkills");
        List<String> missingPreferred = (List<String>) result.get("missingPreferredSkills");

        List<String> evidence = new java.util.ArrayList<>();
        List<String> gaps = new java.util.ArrayList<>();

        if (mandatory.isEmpty()) {
            evidence.add("No mandatory technical skills were specified for this job.");
        } else {
            evidence.add("Mandatory skills matched: " + matchedMandatory.size()
                    + " of " + mandatory.size() + ".");
            if (!matchedMandatory.isEmpty()) {
                evidence.add("Matched mandatory skills: " + String.join(", ", matchedMandatory) + ".");
            }
            if (!missingMandatory.isEmpty()) {
                gaps.add("Missing mandatory skill evidence: " + String.join(", ", missingMandatory) + ".");
            }
        }

        if (!preferred.isEmpty()) {
            evidence.add("Preferred skills matched: " + matchedPreferred.size()
                    + " of " + preferred.size() + ".");
            if (!matchedPreferred.isEmpty()) {
                evidence.add("Matched preferred skills: " + String.join(", ", matchedPreferred) + ".");
            }
            if (!missingPreferred.isEmpty()) {
                gaps.add("Missing preferred skill evidence: " + String.join(", ", missingPreferred) + ".");
            }
        }

        Object eligible = result.get("experienceEligible");
        Object requiredYears = result.get("requiredExperienceYears");
        Object candidateYears = result.get("candidateExperienceYears");
        String experienceStatement;
        if (Boolean.TRUE.equals(eligible)) {
            experienceStatement = "Recorded experience meets the minimum requirement ("
                    + candidateYears + " years recorded; " + requiredYears + " required).";
            // For uploaded resumes with no experience requirement, the years are unknown.
            if (candidateYears == null) {
                experienceStatement = "No minimum experience is required; resume experience was not determined.";
            }
        } else if (Boolean.FALSE.equals(eligible)) {
            experienceStatement = "Recorded experience is below the minimum requirement ("
                    + candidateYears + " years recorded; " + requiredYears + " required).";
            gaps.add(experienceStatement);
        } else {
            experienceStatement = "Experience eligibility could not be determined from available data.";
            gaps.add(experienceStatement);
        }
        evidence.add(experienceStatement);

        String semanticStatus = String.valueOf(result.get("semanticStatus"));
        String semanticStatement = "SUCCESS".equals(semanticStatus)
                ? "AI semantic similarity is supporting context, not proof of any individual skill or qualification."
                : "AI semantic similarity is unavailable or lacks sufficient data; explanations use recorded skill evidence.";
        evidence.add(semanticStatement);

        String summary = mandatory.isEmpty()
                ? "No mandatory skills defined; review preferred skills and experience manually."
                : "Matches " + matchedMandatory.size() + " of " + mandatory.size()
                        + " mandatory skills and " + matchedPreferred.size() + " of "
                        + preferred.size() + " preferred skills. "
                        + (missingMandatory.isEmpty()
                                ? "All listed mandatory skills have matching evidence. "
                                : "Some mandatory skills lack matching evidence. ")
                        + (Boolean.TRUE.equals(eligible)
                                ? "Experience requirement met."
                                : Boolean.FALSE.equals(eligible)
                                        ? "Experience requirement not met."
                                        : "Experience eligibility unknown.");

        result.put("matchExplanation", summary);
        result.put("matchEvidence", evidence);
        result.put("matchGaps", gaps);
        result.put("matchExplanationStatus", "RULE_DERIVED");
    }

    // Backwards compatible: existing unmarked job skills remain mandatory.
    // Prefix a skill with ? to mark it preferred; ! explicitly marks mandatory.
    // These markers are stored in the existing requiredSkills text field.
    private RequirementSkills parseRequirements(String input) {
        Set<String> mandatory = new LinkedHashSet<>();
        Set<String> preferred = new LinkedHashSet<>();
        if (input == null || input.isBlank()) {
            return new RequirementSkills(mandatory, preferred);
        }
        for (String part : input.split(",")) {
            String token = part.trim();
            boolean isPreferred = token.startsWith("?");
            if (token.startsWith("?") || token.startsWith("!")) {
                token = token.substring(1).trim();
            }
            String skill = skillNormalizer.normalize(token);
            if (skill == null || skill.isBlank())
                continue;
            if (isPreferred) {
                if (!mandatory.contains(skill))
                    preferred.add(skill);
            } else {
                mandatory.add(skill);
                preferred.remove(skill); // Mandatory wins if repeated in both categories.
            }
        }
        return new RequirementSkills(mandatory, preferred);
    }

    private record RequirementSkills(Set<String> mandatory, Set<String> preferred) {
        Set<String> allSkills() {
            Set<String> all = new LinkedHashSet<>(mandatory);
            all.addAll(preferred);
            return all;
        }
    }

    private double percentage(int matched, int total) {
        return total == 0 ? 0.0 : Math.round(matched * 10000.0 / total) / 100.0;
    }

    // Normalize comma-separated skill names

    private Set<String> parseSkills(String skills) {

        if (skills == null || skills.isBlank()) {

            return new LinkedHashSet<>();

        }

        return Arrays.stream(skills.split(","))

                .map(skillNormalizer::normalize)

                .filter(skill -> !skill.isEmpty())

                .collect(

                        Collectors.toCollection(LinkedHashSet::new));

    }

    // Retrieve a job or return HTTP 404

    private Job findJob(Long jobId) {

        return jobRepository.findById(jobId)

                .orElseThrow(() -> new ResponseStatusException(

                        HttpStatus.NOT_FOUND,

                        "Job not found"));

    }

}
