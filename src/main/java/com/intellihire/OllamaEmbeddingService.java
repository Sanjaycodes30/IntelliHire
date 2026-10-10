package com.intellihire;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import tools.jackson.databind.ObjectMapper;

@Service
public class OllamaEmbeddingService {

    private static final String OLLAMA_URL = "http://localhost:11434/api/embed";

    private static final String MODEL = "nomic-embed-text";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OllamaEmbeddingService(ObjectMapper objectMapper) {

        this.objectMapper = objectMapper;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public double[] generateEmbedding(String text)
            throws IOException, InterruptedException {

        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException(
                    "Text cannot be empty");
        }

        String requestBody = objectMapper.writeValueAsString(
                Map.of(
                        "model", MODEL,
                        "input", text));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OLLAMA_URL))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException(
                    "Ollama API returned HTTP "
                            + response.statusCode());
        }

        EmbeddingResponse embeddingResponse = objectMapper.readValue(
                response.body(),
                EmbeddingResponse.class);

        if (embeddingResponse.embeddings() == null
                || embeddingResponse.embeddings().isEmpty()) {

            throw new IOException(
                    "Ollama returned no embeddings");
        }

        double[] embedding = embeddingResponse.embeddings().get(0);

        if (embedding == null || embedding.length == 0) {
            throw new IOException(
                    "Ollama returned an empty embedding");
        }

        return embedding;
    }

    public double cosineSimilarity(
            double[] vectorA,
            double[] vectorB) {

        if (vectorA == null || vectorB == null
                || vectorA.length == 0
                || vectorA.length != vectorB.length) {

            throw new IllegalArgumentException(
                    "Embedding vectors must have equal nonzero dimensions");
        }

        double dotProduct = 0.0;
        double magnitudeA = 0.0;
        double magnitudeB = 0.0;

        for (int i = 0; i < vectorA.length; i++) {

            dotProduct += vectorA[i] * vectorB[i];

            magnitudeA += vectorA[i] * vectorA[i];

            magnitudeB += vectorB[i] * vectorB[i];
        }

        if (magnitudeA == 0.0 || magnitudeB == 0.0) {
            return 0.0;
        }

        return dotProduct /
                (Math.sqrt(magnitudeA)
                        * Math.sqrt(magnitudeB));
    }

    private record EmbeddingResponse(
            List<double[]> embeddings) {
    }
}