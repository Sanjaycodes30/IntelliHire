package com.intellihire;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real-model exploratory evaluation. No Spring context, database, or candidate
 * writes.
 * Requires Ollama at localhost:11434 with nomic-embed-text installed.
 * This prints observed similarities; it does not assert a subjective ranking as
 * truth.
 */
class OllamaRelevanceEvaluationTest {

    @Test
    void compareSyntheticProfilesWithRealEmbeddings() throws Exception {
        OllamaEmbeddingService embeddings = new OllamaEmbeddingService(new ObjectMapper());

        String job = """
                Job title: AI Developer.
                Required technical skills: python, sql, ai, machine learning, api integration, llms.
                Minimum experience: 2 years.
                """;

        Map<String, String> profiles = new LinkedHashMap<>();
        profiles.put("Strong AI engineer", """
                Technical skills: python, sql, ai, machine learning, api integration, llms.
                Professional experience: 3 years.
                Builds and deploys machine learning and language model applications.
                """);
        profiles.put("Partial Python developer", """
                Technical skills: python, sql, flask.
                Professional experience: 2 years.
                Develops Python web services and database-backed applications.
                """);
        profiles.put("Java backend developer", """
                Technical skills: java, spring boot, rest apis, postgresql.
                Professional experience: 4 years.
                Builds enterprise backend services.
                """);
        profiles.put("Graphic designer", """
                Technical skills: photoshop, illustrator, visual design, typography.
                Professional experience: 3 years.
                Creates brand identities and marketing artwork.
                """);
        profiles.put("AI engineer, experience gap", """
                Technical skills: python, sql, ai, machine learning, api integration, llms.
                Professional experience: 0 years.
                Has completed student projects using language models and machine learning.
                """);

        double[] jobVector;
        try {
            jobVector = embeddings.generateEmbedding(job);
        } catch (IOException e) {
            fail("Cannot reach Ollama. Start it and confirm the model is available: " + e.getMessage());
            return;
        }

        System.out.println("\n=== INTELLIHIRE REAL OLLAMA RELEVANCE EVALUATION ===");
        System.out.println("Model: nomic-embed-text | Job: AI Developer");
        System.out.println("Raw cosine similarities are not qualification probabilities.");
        for (Map.Entry<String, String> entry : profiles.entrySet()) {
            double[] candidateVector = embeddings.generateEmbedding(entry.getValue());
            double similarity = embeddings.cosineSimilarity(jobVector, candidateVector);
            assertTrue(Double.isFinite(similarity), "Similarity must be finite: " + entry.getKey());
            assertTrue(similarity >= -1.000001 && similarity <= 1.000001,
                    "Cosine similarity must be between -1 and 1: " + entry.getKey());
            System.out.printf("%-31s  %.4f%n", entry.getKey(), similarity);
        }
        System.out.println("=== END EVALUATION ===\n");
    }
}
