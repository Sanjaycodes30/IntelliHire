package com.intellihire;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resumes")
public class ResumeController {

    private final ResumeParserService resumeParserService;
    private final SkillExtractionService skillExtractionService;

    public ResumeController(
            ResumeParserService resumeParserService,
            SkillExtractionService skillExtractionService) {

        this.resumeParserService = resumeParserService;
        this.skillExtractionService = skillExtractionService;
    }

    @PostMapping("/upload")
    public Map<String, Object> uploadResume(
            @RequestParam("file") MultipartFile file) {

        try {

            String extractedText = resumeParserService.extractText(file);

            List<String> detectedSkills = skillExtractionService.extractSkills(
                    extractedText);

            return Map.of(
                    "message",
                    "Resume uploaded and analyzed successfully",
                    "extractedText",
                    extractedText,
                    "detectedSkills",
                    detectedSkills,
                    "totalSkillsDetected",
                    detectedSkills.size());

        } catch (IllegalArgumentException e) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage());

        } catch (IOException e) {

            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Unable to read the PDF file");
        }
    }

    @PostMapping("/parse")
    public ResumeCandidateDTO parseResume(
            @RequestParam("file") MultipartFile file) {

        try {

            String extractedText = resumeParserService.extractText(file);

            String name = resumeParserService.extractName(
                    extractedText);

            String email = resumeParserService.extractEmail(
                    extractedText);

            String phone = resumeParserService.extractPhone(
                    extractedText);

            List<String> detectedSkills = skillExtractionService.extractSkills(
                    extractedText);

            String skills = String.join(", ", detectedSkills);

            return new ResumeCandidateDTO(
                    name,
                    email,
                    phone,
                    skills,
                    null,
                    null,
                    detectedSkills);

        } catch (IllegalArgumentException e) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage());

        } catch (IOException e) {

            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Unable to read the PDF file");
        }
    }
}