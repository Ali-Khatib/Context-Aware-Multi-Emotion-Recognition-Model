package com.sengroup.backend.repository;

import com.sengroup.backend.entity.AnalysisStageEntity;
import com.sengroup.backend.entity.MetricsEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetricsRepository extends JpaRepository<MetricsEntity, UUID> {
    List<MetricsEntity> findByStageIn(List<AnalysisStageEntity> stages);
}
