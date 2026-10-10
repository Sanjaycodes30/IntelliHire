package com.intellihire;

import java.util.List;

public record ResumeCandidateDTO(
        String name,
        String email,
        String phone,
        String skills,
        Integer experienceYears,
        String currentLocation,
        List<String> detectedSkills) {
}