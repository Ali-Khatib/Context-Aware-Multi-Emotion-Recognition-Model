package com.sengroup.backend.repository;

import com.sengroup.backend.entity.FaceEntity;
import com.sengroup.backend.entity.ImageEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FaceRepository extends JpaRepository<FaceEntity, UUID> {
    List<FaceEntity> findByImage(ImageEntity image);
}
