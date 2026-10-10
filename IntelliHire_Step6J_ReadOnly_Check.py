
#!/usr/bin/env python3

import json
import math
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "http://localhost:8080"
TIMEOUT = 90

passed = 0
failed = 0
warnings = 0


def get_json(path):
    url = BASE_URL + path

    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json"},
        method="GET"
    )

    with urllib.request.urlopen(
        request, timeout=TIMEOUT
    ) as response:
        return json.load(response)


def check(condition, message):
    global passed, failed

    if condition:
        passed += 1
        print(f"  [PASS] {message}")
    else:
        failed += 1
        print(f"  [FAIL] {message}")


def warn(message):
    global warnings
    warnings += 1
    print(f"  [WARN] {message}")


def number(value):
    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        value = float(value)
        return value if math.isfinite(value) else None

    return None


def skills_from_job(job):
    raw = job.get("requiredSkills") or ""
    mandatory = set()
    preferred = set()

    for part in raw.split(","):
        skill = part.strip()
        is_preferred = skill.startswith("?")

        if skill.startswith(("?", "!")):
            skill = skill[1:].strip()

        skill = skill.lower()

        if not skill:
            continue

        if is_preferred:
            if skill not in mandatory:
                preferred.add(skill)
        else:
            mandatory.add(skill)
            preferred.discard(skill)

    return mandatory, preferred


def validate_match(job, candidate, result):
    label = (
        f"{candidate.get('name', 'Unknown')} "
        f"vs {job.get('title', 'Unknown')}"
    )

    print(f"\n--- {label} ---")

    mandatory, preferred = skills_from_job(job)

    mandatory_matched = result.get(
        "matchedMandatorySkills", []
    )
    preferred_matched = result.get(
        "matchedPreferredSkills", []
    )

    mandatory_missing = result.get(
        "missingMandatorySkills", []
    )
    preferred_missing = result.get(
        "missingPreferredSkills", []
    )

    check(
        result.get("jobId") == job.get("id"),
        "Correct job ID"
    )

    check(
        result.get("candidateId") == candidate.get("id"),
        "Correct candidate ID"
    )

    check(
        len(mandatory_matched) +
        len(mandatory_missing) ==
        len(mandatory),
        "Mandatory skill counts are consistent"
    )

    check(
        len(preferred_matched) +
        len(preferred_missing) ==
        len(preferred),
        "Preferred skill counts are consistent"
    )

    mandatory_coverage = number(
        result.get("mandatoryCoverage")
    )

    preferred_coverage = number(
        result.get("preferredCoverage")
    )

    expected_mandatory = (
        round(
            len(mandatory_matched) * 100 /
            len(mandatory), 2
        )
        if mandatory else 0.0
    )

    expected_preferred = (
        round(
            len(preferred_matched) * 100 /
            len(preferred), 2
        )
        if preferred else 0.0
    )

    check(
        mandatory_coverage is not None
        and abs(
            mandatory_coverage - expected_mandatory
        ) < 0.02,
        "Mandatory coverage calculation"
    )

    check(
        preferred_coverage is not None
        and abs(
            preferred_coverage - expected_preferred
        ) < 0.02,
        "Preferred coverage calculation"
    )

    score = number(result.get("matchScore"))

    check(
        score is not None and 0 <= score <= 100,
        "Rule-based score is within 0–100"
    )

    evidence = number(result.get("evidenceScore"))

    check(
        evidence is not None and 0 <= evidence <= 100,
        "Evidence-aware score is within 0–100"
    )

    if score is not None and evidence is not None:
        check(
            evidence + 0.02 >= score,
            "Evidence score does not reduce skill coverage"
        )

    semantic_status = result.get("semanticStatus")

    check(
        semantic_status in {
            "SUCCESS",
            "UNAVAILABLE",
            "INSUFFICIENT_DATA"
        },
        "Semantic status is valid"
    )

    if semantic_status == "SUCCESS":
        similarity = number(
            result.get("semanticSimilarity")
        )

        check(
            similarity is not None
            and -1 <= similarity <= 1,
            "Cosine similarity is within -1 to 1"
        )
    else:
        warn(
            f"Semantic similarity status: "
            f"{semantic_status}"
        )

    required_experience = number(
        result.get("requiredExperienceYears")
    )

    candidate_experience = number(
        result.get("candidateExperienceYears")
    )

    eligible = result.get("experienceEligible")

    if (
        required_experience is not None
        and candidate_experience is not None
    ):
        expected_eligible = (
            required_experience <= 0
            or candidate_experience >= required_experience
        )

        check(
            eligible == expected_eligible,
            "Experience eligibility is correct"
        )

    check(
        isinstance(
            result.get("matchExplanation"), str
        )
        and bool(result["matchExplanation"].strip()),
        "Match explanation is present"
    )

    check(
        isinstance(
            result.get("matchEvidence"), list
        ),
        "Supporting evidence is a list"
    )

    check(
        isinstance(
            result.get("matchGaps"), list
        ),
        "Missing evidence is a list"
    )

    check(
        result.get("matchExplanationStatus")
        == "RULE_DERIVED",
        "Explanation is identified as rule-derived"
    )

    print(
        "  Scores:",
        f"mandatory={mandatory_coverage}",
        f"preferred={preferred_coverage}",
        f"skill={score}",
        f"evidence={evidence}",
        f"semantic={result.get('semanticSimilarity')}"
    )


def main():
    print("=" * 60)
    print("INTELLIHIRE STEP 6J - READ-ONLY INTEGRATION TEST")
    print("=" * 60)

    try:
        jobs = get_json("/api/jobs")
        candidates = get_json("/api/candidates")

    except (
        urllib.error.URLError,
        TimeoutError,
        ValueError
    ) as error:
        print(f"\n[ERROR] Cannot connect to backend: {error}")
        print(
            "Start Spring Boot using: "
            "mvn spring-boot:run"
        )
        return 1

    print(f"\nJobs found: {len(jobs)}")
    print(f"Candidates found: {len(candidates)}")

    if not jobs or not candidates:
        print(
            "\n[SKIP] At least one existing job and "
            "candidate are needed."
        )
        return 0

    total_matches = 0

    for job in jobs:
        for candidate in candidates:
            job_id = urllib.parse.quote(
                str(job["id"]), safe=""
            )

            candidate_id = urllib.parse.quote(
                str(candidate["id"]), safe=""
            )

            path = (
                f"/api/match/jobs/{job_id}"
                f"/candidates/{candidate_id}"
            )

            try:
                result = get_json(path)

                validate_match(
                    job, candidate, result
                )

                total_matches += 1

            except Exception as error:
                check(
                    False,
                    f"API request failed: {error}"
                )

    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print("=" * 60)

    print(f"Matches tested: {total_matches}")
    print(f"Checks passed:  {passed}")
    print(f"Checks failed:  {failed}")
    print(f"Warnings:       {warnings}")

    if failed == 0:
        print("\nRESULT: ALL CHECKS PASSED")
        return 0

    print("\nRESULT: SOME CHECKS FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
