package com.sengroup.backend.repository;

import com.sengroup.backend.entity.EmotionResultEntity;
import com.sengroup.backend.entity.FaceEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmotionResultRepository extends JpaRepository<EmotionResultEntity, UUID> {
    List<EmotionResultEntity> findByFace(FaceEntity face);
}
