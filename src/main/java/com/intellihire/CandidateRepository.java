package com.intellihire;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CandidateRepository
        extends JpaRepository<Candidate, Long> {

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(
            String email,
            Long id);
}