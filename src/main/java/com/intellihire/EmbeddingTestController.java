package com.intellihire;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test/embeddings")
public class EmbeddingTestController {

    private final OllamaEmbeddingService embeddingService;

    public EmbeddingTestController(
            OllamaEmbeddingService embeddingService) {

        this.embeddingService = embeddingService;
    }

    @GetMapping
    public Map<String, Object> testEmbeddings() {

        String jobRequirement = "Java Spring Boot backend development";

        String candidateQualification = "Developed backend applications using Java and Spring Boot";

        try {

            double[] jobEmbedding = embeddingService.generateEmbedding(jobRequirement);

            double[] candidateEmbedding = embeddingService.generateEmbedding(candidateQualification);

            double similarity = embeddingService.cosineSimilarity(
                    jobEmbedding,
                    candidateEmbedding);

            Map<String, Object> result = new LinkedHashMap<>();

            result.put("status", "SUCCESS");
            result.put("model", "nomic-embed-text");
            result.put("jobRequirement", jobRequirement);
            result.put("candidateQualification", candidateQualification);
            result.put("embeddingDimensions", jobEmbedding.length);
            result.put("cosineSimilarity",
                    Math.round(similarity * 10000.0) / 10000.0);

            return result;

        } catch (InterruptedException e) {

            Thread.currentThread().interrupt();

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Embedding request interrupted",
                    e);

        } catch (IOException e) {

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Unable to communicate with Ollama",
                    e);
        }
    }
}