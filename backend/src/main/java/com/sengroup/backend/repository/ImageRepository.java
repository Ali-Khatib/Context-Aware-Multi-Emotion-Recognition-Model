package com.sengroup.backend.repository;

import com.sengroup.backend.entity.ImageEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageRepository extends JpaRepository<ImageEntity, UUID> {
}
