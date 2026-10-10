
package com.intellihire;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class SkillNormalizer {

    private static final Map<String, String> ALIASES = new HashMap<>();

    static {

        // JavaScript
        ALIASES.put("js", "javascript");
        ALIASES.put("java script", "javascript");
        ALIASES.put("javascript", "javascript");

        // Spring Boot
        ALIASES.put("springboot", "spring boot");
        ALIASES.put("spring-boot", "spring boot");

        // PostgreSQL
        ALIASES.put("postgres", "postgresql");
        ALIASES.put("postgre sql", "postgresql");

        // REST APIs
        ALIASES.put("rest api", "rest apis");
        ALIASES.put("restful api", "rest apis");
        ALIASES.put("restful apis", "rest apis");
        ALIASES.put("restful services", "rest apis");

        // API Integration
        ALIASES.put("api integrations", "api integration");
        ALIASES.put("api connectivity", "api integration");
        ALIASES.put("api integrations development", "api integration");
        ALIASES.put("third party api integration", "api integration");
        ALIASES.put("third-party api integration", "api integration");

        // Artificial Intelligence
        ALIASES.put("artificial intelligence", "ai");
        ALIASES.put("artificial-intelligence", "ai");

        // Machine Learning
        ALIASES.put("ml", "machine learning");
        ALIASES.put("machine-learning", "machine learning");

        // Large Language Models
        ALIASES.put("llm", "llms");
        ALIASES.put("large language model", "llms");
        ALIASES.put("large language models", "llms");
        ALIASES.put("large-language-models", "llms");

        // Generative AI
        ALIASES.put("gen ai", "generative ai");
        ALIASES.put("genai", "generative ai");
        ALIASES.put("generative artificial intelligence", "generative ai");

        // Natural Language Processing
        ALIASES.put("natural language processing", "nlp");
        ALIASES.put("natural-language-processing", "nlp");

        // Node.js
        ALIASES.put("nodejs", "node.js");
        ALIASES.put("node js", "node.js");

        // React
        ALIASES.put("reactjs", "react");
        ALIASES.put("react.js", "react");

        // Scikit-learn
        ALIASES.put("sklearn", "scikit-learn");
        ALIASES.put("scikit learn", "scikit-learn");

        // TensorFlow
        ALIASES.put("tensor flow", "tensorflow");

        // PyTorch
        ALIASES.put("py torch", "pytorch");

        // GitHub
        ALIASES.put("git hub", "github");

        // Docker
        ALIASES.put("docker containers", "docker");

        // Hibernate
        ALIASES.put("hibernate orm", "hibernate");

        // Java Persistence API
        ALIASES.put("java persistence api", "jpa");

        // JSON Web Tokens
        ALIASES.put("json web token", "jwt");
        ALIASES.put("json web tokens", "jwt");
        ALIASES.put("jwts", "jwt");

        // Structured Query Language
        ALIASES.put("structured query language", "sql");
    }

    public String normalize(String skill) {

        if (skill == null || skill.isBlank()) {
            return "";
        }

        String normalized = skill
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ");

        return ALIASES.getOrDefault(normalized, normalized);
    }
}
