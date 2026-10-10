
package com.intellihire;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/applications")
public class JobApplicationController {

    private final JobApplicationService service;

    public JobApplicationController(
            JobApplicationService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JobApplication createApplication(
            @RequestParam Long jobId,
            @RequestParam Long candidateId) {
        return service.createApplication(
                jobId,
                candidateId);
    }

    @GetMapping
    public List<JobApplication> getAllApplications() {
        return service.getAllApplications();
    }

    @GetMapping("/job/{jobId}")
    public List<JobApplication> getByJob(
            @PathVariable Long jobId) {
        return service.getApplicationsByJob(jobId);
    }

    @GetMapping("/candidate/{candidateId}")
    public List<JobApplication> getByCandidate(
            @PathVariable Long candidateId) {
        return service.getApplicationsByCandidate(
                candidateId);
    }

    public record StatusUpdate(
            ApplicationStatus status) {
    }

    @PutMapping("/{id}/status")
    public JobApplication updateStatus(
            @PathVariable Long id,
            @RequestBody StatusUpdate request) {
        if (request.status() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Status is required");
        }

        return service.updateStatus(
                id,
                request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteApplication(
            @PathVariable Long id) {
        service.deleteApplication(id);
    }
}
