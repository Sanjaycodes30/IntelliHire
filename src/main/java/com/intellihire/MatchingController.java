
package com.intellihire;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/match")
public class MatchingController {

    private final MatchingService matchingService;

    public MatchingController(MatchingService matchingService) {
        this.matchingService = matchingService;
    }

    // Match an existing candidate with a job
    @GetMapping("/jobs/{jobId}/candidates/{candidateId}")
    public Map<String, Object> matchCandidate(
            @PathVariable Long jobId,
            @PathVariable Long candidateId) {

        return matchingService.matchCandidate(jobId, candidateId);
    }

    // Match an uploaded PDF resume with a job
    @PostMapping("/jobs/{jobId}/resume")
    public Map<String, Object> matchResume(
            @PathVariable Long jobId,
            @RequestParam("file") MultipartFile file) {

        try {
            return matchingService.matchResume(jobId, file);

        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage());

        } catch (IOException e) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Unable to read the PDF resume");
        }
    }
}
