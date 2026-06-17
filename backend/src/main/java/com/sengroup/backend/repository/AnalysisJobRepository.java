package com.sengroup.backend.repository;

import com.sengroup.backend.entity.AnalysisJobEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisJobRepository extends JpaRepository<AnalysisJobEntity, UUID> {
}
