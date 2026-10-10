
package com.intellihire;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class JobApplicationService {

    private final JobApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final CandidateRepository candidateRepository;

    public JobApplicationService(
            JobApplicationRepository applicationRepository,
            JobRepository jobRepository,
            CandidateRepository candidateRepository) {
        this.applicationRepository = applicationRepository;
        this.jobRepository = jobRepository;
        this.candidateRepository = candidateRepository;
    }

    @Transactional
    public JobApplication createApplication(
            Long jobId,
            Long candidateId) {

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Job not found"));

        Candidate candidate = candidateRepository
                .findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Candidate not found"));

        boolean alreadyExists = applicationRepository
                .existsByJob_IdAndCandidate_Id(
                        jobId,
                        candidateId);

        if (alreadyExists) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Candidate has already applied for this job");
        }

        JobApplication application = new JobApplication();

        application.setJob(job);
        application.setCandidate(candidate);
        application.setStatus(
                ApplicationStatus.APPLIED);

        return applicationRepository.save(application);
    }

    @Transactional(readOnly = true)
    public List<JobApplication> getAllApplications() {
        return applicationRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<JobApplication> getApplicationsByJob(
            Long jobId) {
        return applicationRepository.findByJob_Id(jobId);
    }

    @Transactional(readOnly = true)
    public List<JobApplication> getApplicationsByCandidate(
            Long candidateId) {
        return applicationRepository
                .findByCandidate_Id(candidateId);
    }

    @Transactional
    public JobApplication updateStatus(
            Long applicationId,
            ApplicationStatus status) {
        JobApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Application not found"));

        application.setStatus(status);

        return applicationRepository.save(application);
    }

    @Transactional
    public void deleteApplication(Long applicationId) {
        if (!applicationRepository.existsById(applicationId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Application not found");
        }

        applicationRepository.deleteById(applicationId);
    }
}
