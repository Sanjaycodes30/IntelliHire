package com.intellihire;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchingServiceTest {

    @Mock
    JobRepository jobRepository;
    @Mock
    CandidateRepository candidateRepository;
    @Mock
    ResumeParserService resumeParserService;
    @Mock
    SkillExtractionService skillExtractionService;
    @Mock
    SkillNormalizer skillNormalizer;
    @Mock
    OllamaEmbeddingService embeddingService;

    MatchingService matchingService;

    @BeforeEach
    void setUp() {
        matchingService = new MatchingService(
                jobRepository, candidateRepository, resumeParserService,
                skillExtractionService, skillNormalizer, embeddingService);

        // Isolate the matching algorithm: normalization has its own responsibility.
        lenient().when(skillNormalizer.normalize(anyString())).thenAnswer(invocation -> {
            String value = invocation.getArgument(0, String.class).trim().toLowerCase();
            return value.equals("ml") ? "machine learning" : value;
        });
    }

    private void givenJob(String skills, int minimumYears) {
        Job job = mock(Job.class);
        when(jobRepository.findById(3L)).thenReturn(Optional.of(job));
        when(job.getRequiredSkills()).thenReturn(skills);
        lenient().when(job.getMinExperienceYears()).thenReturn(minimumYears);
        lenient().when(job.getTitle()).thenReturn("AI Developer");
    }

    private void givenCandidate(long id, String skills, int years) {
        Candidate candidate = mock(Candidate.class);
        when(candidateRepository.findById(id)).thenReturn(Optional.of(candidate));
        when(candidate.getSkills()).thenReturn(skills);
        lenient().when(candidate.getExperienceYears()).thenReturn(years);
        lenient().when(candidate.getName()).thenReturn("Synthetic Candidate");
        lenient().when(candidate.getId()).thenReturn(id);
    }

    private void ollamaSimilarity(double similarity) throws Exception {
        when(embeddingService.generateEmbedding(anyString()))
                .thenReturn(new double[] { 1.0, 0.0 });
        when(embeddingService.cosineSimilarity(any(double[].class), any(double[].class)))
                .thenReturn(similarity);
    }

    private static double score(Map<String, Object> result, String field) {
        return ((Number) result.get(field)).doubleValue();
    }

    @Test
    void strongMatchKeepsFullCoverageAndNoExtraBonus() throws Exception {
        givenJob("Python, SQL, AI, ML, API Integration, LLMs", 2);
        givenCandidate(11L, "Python, SQL, AI, Machine Learning, API Integration, LLMs", 3);
        ollamaSimilarity(0.9);

        Map<String, Object> result = matchingService.matchCandidate(3L, 11L);

        assertEquals(100.0, score(result, "matchScore"), 0.001);
        assertEquals(100.0, score(result, "evidenceScore"), 0.001);
        assertEquals(0.0, score(result, "semanticBonus"), 0.001);
        assertEquals(Boolean.TRUE, result.get("experienceEligible"));
    }

    @Test
    void partialMatchReceivesOnlySmallGatedBonus() throws Exception {
        givenJob("Python, SQL, AI, ML, API Integration, LLMs", 2);
        givenCandidate(12L, "Python, SQL, Flask", 2);
        ollamaSimilarity(0.7359);

        Map<String, Object> result = matchingService.matchCandidate(3L, 12L);

        assertEquals(33.33, score(result, "matchScore"), 0.001);
        assertEquals(35.78, score(result, "evidenceScore"), 0.001);
        assertEquals(2.45, score(result, "semanticBonus"), 0.001);
        assertEquals(Boolean.TRUE, result.get("experienceEligible"));
    }

    @Test
    void unrelatedProfileGetsNoBonusEvenWithHighSimilarity() throws Exception {
        givenJob("Python, SQL, AI, ML, API Integration, LLMs", 2);
        givenCandidate(13L, "Photoshop, Illustrator, Graphic Design", 3);
        ollamaSimilarity(0.95);

        Map<String, Object> result = matchingService.matchCandidate(3L, 13L);

        assertEquals(0.0, score(result, "matchScore"), 0.001);
        assertEquals(0.0, score(result, "evidenceScore"), 0.001);
        assertEquals(0.0, score(result, "semanticBonus"), 0.001);
    }

    @Test
    void experienceGapRemainsVisibleDespiteStrongSkills() throws Exception {
        givenJob("Python, SQL, AI, ML, API Integration, LLMs", 2);
        givenCandidate(14L, "Python, SQL, AI, ML, API Integration, LLMs", 0);
        ollamaSimilarity(0.9);

        Map<String, Object> result = matchingService.matchCandidate(3L, 14L);

        assertEquals(100.0, score(result, "matchScore"), 0.001);
        assertEquals(Boolean.FALSE, result.get("experienceEligible"));
    }

    @Test
    void ollamaFailureFallsBackToRuleBasedScore() throws Exception {
        givenJob("Python, SQL, AI, ML, API Integration, LLMs", 2);
        givenCandidate(15L, "Python, SQL", 2);
        when(embeddingService.generateEmbedding(anyString()))
                .thenThrow(new IOException("Ollama unavailable"));

        Map<String, Object> result = matchingService.matchCandidate(3L, 15L);

        assertEquals(33.33, score(result, "matchScore"), 0.001);
        assertEquals(33.33, score(result, "evidenceScore"), 0.001);
        assertEquals("UNAVAILABLE", result.get("semanticStatus"));
        assertEquals("RULE_BASED_FALLBACK", result.get("evidenceScoreStatus"));
    }
}
