
package com.intellihire;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobApplicationRepository
        extends JpaRepository<JobApplication, Long> {

    boolean existsByJob_IdAndCandidate_Id(
            Long jobId,
            Long candidateId);

    List<JobApplication> findByJob_Id(Long jobId);

    List<JobApplication> findByCandidate_Id(
            Long candidateId);
}
