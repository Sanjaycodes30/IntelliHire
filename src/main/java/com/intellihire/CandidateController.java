package com.intellihire;

import jakarta.validation.Valid;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/candidates")
public class CandidateController {

    private final CandidateRepository candidateRepository;

    public CandidateController(
            CandidateRepository candidateRepository) {

        this.candidateRepository = candidateRepository;
    }

    private String normalizeEmail(String email) {

        if (email == null) {
            return null;
        }

        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void checkDuplicateEmail(
            String email,
            Long excludeCandidateId) {

        boolean duplicate;

        if (excludeCandidateId == null) {

            duplicate = candidateRepository.existsByEmailIgnoreCase(
                    email);

        } else {

            duplicate = candidateRepository
                    .existsByEmailIgnoreCaseAndIdNot(
                            email,
                            excludeCandidateId);
        }

        if (duplicate) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A candidate with this email already exists.");
        }
    }

    // CREATE a candidate
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Candidate createCandidate(
            @Valid @RequestBody Candidate candidate) {

        candidate.setId(null);

        String normalizedEmail = normalizeEmail(candidate.getEmail());

        candidate.setEmail(normalizedEmail);

        checkDuplicateEmail(normalizedEmail, null);

        try {
            return candidateRepository.saveAndFlush(candidate);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Candidate registration conflicts with an existing record.",
                    e);
        }
    }

    // GET all candidates
    @GetMapping
    public List<Candidate> getAllCandidates() {

        return candidateRepository.findAll();
    }

    // GET candidate by ID
    @GetMapping("/{id}")
    public Candidate getCandidateById(
            @PathVariable Long id) {

        return candidateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Candidate not found"));
    }

    // UPDATE candidate
    @PutMapping("/{id}")
    public Candidate updateCandidate(
            @PathVariable Long id,
            @Valid @RequestBody Candidate updatedCandidate) {

        Candidate existingCandidate = candidateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Candidate not found"));

        String normalizedEmail = normalizeEmail(updatedCandidate.getEmail());

        checkDuplicateEmail(normalizedEmail, id);

        existingCandidate.setName(
                updatedCandidate.getName());

        existingCandidate.setEmail(normalizedEmail);

        existingCandidate.setPhone(
                updatedCandidate.getPhone());

        existingCandidate.setSkills(
                updatedCandidate.getSkills());

        existingCandidate.setExperienceYears(
                updatedCandidate.getExperienceYears());

        existingCandidate.setCurrentLocation(
                updatedCandidate.getCurrentLocation());

        try {
            return candidateRepository.saveAndFlush(
                    existingCandidate);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Candidate update conflicts with an existing record.",
                    e);
        }
    }

    // DELETE candidate
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCandidate(
            @PathVariable Long id) {

        if (!candidateRepository.existsById(id)) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Candidate not found");
        }

        candidateRepository.deleteById(id);
    }
}