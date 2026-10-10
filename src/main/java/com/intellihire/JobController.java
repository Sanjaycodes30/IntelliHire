package com.intellihire;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final JobRepository jobRepository;

    public JobController(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    // CREATE a new job
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Job createJob(@Valid @RequestBody Job job) {
        job.setId(null);
        return jobRepository.save(job);
    }

    // GET all jobs
    @GetMapping
    public List<Job> getAllJobs() {
        return jobRepository.findAll();
    }

    // GET a job by ID
    @GetMapping("/{id}")
    public Job getJobById(@PathVariable Long id) {
        return jobRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Job not found"));
    }

    // UPDATE an existing job
    @PutMapping("/{id}")
    public Job updateJob(@PathVariable Long id, @Valid @RequestBody Job updatedJob) {

        Job existingJob = jobRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Job not found"));

        existingJob.setTitle(updatedJob.getTitle());
        existingJob.setCompany(updatedJob.getCompany());
        existingJob.setLocation(updatedJob.getLocation());
        existingJob.setDescription(updatedJob.getDescription());
        existingJob.setRequiredSkills(updatedJob.getRequiredSkills());
        existingJob.setMinExperienceYears(updatedJob.getMinExperienceYears());

        return jobRepository.save(existingJob);
    }

    // DELETE a job
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteJob(@PathVariable Long id) {

        if (!jobRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Job not found");
        }

        jobRepository.deleteById(id);
    }
}