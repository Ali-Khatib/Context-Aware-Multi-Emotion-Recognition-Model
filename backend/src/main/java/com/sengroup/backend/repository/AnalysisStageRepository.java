package com.sengroup.backend.repository;

import com.sengroup.backend.entity.AnalysisStageEntity;
import com.sengroup.backend.entity.ImageEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisStageRepository extends JpaRepository<AnalysisStageEntity, UUID> {
    List<AnalysisStageEntity> findByImageOrderByStageNameAsc(ImageEntity image);
}
