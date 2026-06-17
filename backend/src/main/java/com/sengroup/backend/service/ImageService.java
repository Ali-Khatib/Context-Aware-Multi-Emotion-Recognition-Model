package com.sengroup.backend.service;

import com.sengroup.backend.dto.ImageDTO;
import com.sengroup.backend.entity.ImageEntity;
import com.sengroup.backend.repository.ImageRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageService {

    private final ImageRepository imageRepository;
    private final StorageService storageService;

    public ImageService(ImageRepository imageRepository, StorageService storageService) {
        this.imageRepository = imageRepository;
        this.storageService = storageService;
    }

    public ImageDTO upload(MultipartFile file) {
        UUID id = UUID.randomUUID();
        String path = storageService.saveImage(id, file);
        ImageEntity image = new ImageEntity();
        image.setId(id);
        image.setFilePath(path);
        image.setUploadTimestamp(Instant.now());
        imageRepository.save(image);
        return new ImageDTO(image.getId(), image.getFilePath(), image.getUploadTimestamp());
    }
}
