
package com.intellihire;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class SkillExtractionService {

    private static final Map<String, List<String>> SKILL_ALIASES = new LinkedHashMap<>();

    static {

        // Programming Languages

        SKILL_ALIASES.put("Java", List.of(
                "Java"));

        SKILL_ALIASES.put("Python", List.of(
                "Python"));

        SKILL_ALIASES.put("JavaScript", List.of(
                "JavaScript",
                "Java Script",
                "JS"));

        SKILL_ALIASES.put("SQL", List.of(
                "SQL",
                "Structured Query Language"));

        // Backend Frameworks and APIs

        SKILL_ALIASES.put("Spring Boot", List.of(
                "Spring Boot",
                "SpringBoot",
                "Spring-Boot"));

        SKILL_ALIASES.put("REST APIs", List.of(
                "REST APIs",
                "REST API",
                "RESTful API",
                "RESTful APIs",
                "RESTful Services"));

        SKILL_ALIASES.put("API Integration", List.of(
                "API Integration",
                "API Integrations",
                "Third-party API Integration",
                "Third Party API Integration",
                "API Connectivity"));

        SKILL_ALIASES.put("Flask", List.of(
                "Flask"));

        SKILL_ALIASES.put("Node.js", List.of(
                "Node.js",
                "NodeJS",
                "Node JS"));

        // Databases

        SKILL_ALIASES.put("PostgreSQL", List.of(
                "PostgreSQL",
                "Postgres",
                "Postgre SQL"));

        SKILL_ALIASES.put("MySQL", List.of(
                "MySQL"));

        SKILL_ALIASES.put("MongoDB", List.of(
                "MongoDB"));

        SKILL_ALIASES.put("Redis", List.of(
                "Redis"));

        // Frontend Technologies

        SKILL_ALIASES.put("HTML", List.of(
                "HTML"));

        SKILL_ALIASES.put("CSS", List.of(
                "CSS"));

        SKILL_ALIASES.put("React", List.of(
                "React",
                "ReactJS",
                "React.js"));

        // Artificial Intelligence

        SKILL_ALIASES.put("AI", List.of(
                "Artificial Intelligence",
                "Artificial-Intelligence"));

        SKILL_ALIASES.put("Machine Learning", List.of(
                "Machine Learning",
                "Machine-Learning",
                "ML"));

        SKILL_ALIASES.put("LLMs", List.of(
                "LLM",
                "LLMs",
                "Large Language Model",
                "Large Language Models",
                "Large-Language-Models"));

        SKILL_ALIASES.put("Generative AI", List.of(
                "Generative AI",
                "Gen AI",
                "GenAI",
                "Generative Artificial Intelligence"));

        SKILL_ALIASES.put("NLP", List.of(
                "NLP",
                "Natural Language Processing",
                "Natural-Language-Processing"));

        // AI / ML Libraries

        SKILL_ALIASES.put("TensorFlow", List.of(
                "TensorFlow",
                "Tensor Flow"));

        SKILL_ALIASES.put("PyTorch", List.of(
                "PyTorch",
                "Py Torch"));

        SKILL_ALIASES.put("Scikit-learn", List.of(
                "Scikit-learn",
                "Scikit Learn",
                "Sklearn"));

        SKILL_ALIASES.put("Pandas", List.of(
                "Pandas"));

        SKILL_ALIASES.put("NumPy", List.of(
                "NumPy"));

        // Development Tools

        SKILL_ALIASES.put("Docker", List.of(
                "Docker",
                "Docker Containers"));

        SKILL_ALIASES.put("Git", List.of(
                "Git"));

        SKILL_ALIASES.put("GitHub", List.of(
                "GitHub",
                "Git Hub"));

        // Security and Persistence

        SKILL_ALIASES.put("JWT", List.of(
                "JWT",
                "JWTs",
                "JSON Web Token",
                "JSON Web Tokens"));

        SKILL_ALIASES.put("Hibernate", List.of(
                "Hibernate",
                "Hibernate ORM"));

        SKILL_ALIASES.put("JPA", List.of(
                "JPA",
                "Java Persistence API"));
    }

    public List<String> extractSkills(String resumeText) {

        List<String> detectedSkills = new ArrayList<>();

        if (resumeText == null || resumeText.isBlank()) {
            return detectedSkills;
        }

        for (Map.Entry<String, List<String>> entry : SKILL_ALIASES.entrySet()) {

            String canonicalSkill = entry.getKey();

            for (String alias : entry.getValue()) {

                String pattern = "(?i)(?<![\\p{L}\\p{N}])"
                        + Pattern.quote(alias)
                        + "(?![\\p{L}\\p{N}])";

                if (Pattern.compile(pattern)
                        .matcher(resumeText)
                        .find()) {

                    detectedSkills.add(canonicalSkill);
                    break;
                }
            }
        }

        return detectedSkills;
    }
}
