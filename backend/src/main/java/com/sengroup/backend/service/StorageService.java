package com.sengroup.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class StorageService {

    private final Path imageDir;

    public StorageService(@Value("${app.storage.image-dir}") String imageDir) {
        this.imageDir = Path.of(imageDir);
    }

    public String saveImage(UUID imageId, MultipartFile file) {
        try {
            Files.createDirectories(imageDir);
            Path target = imageDir.resolve(imageId + ".jpg");
            Files.write(target, file.getBytes());
            return target.toString();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to store image", e);
        }
    }

    public byte[] readImage(String path) {
        try {
            return Files.readAllBytes(Path.of(path));
        } catch (IOException e) {
            throw new IllegalStateException("Unable to read image", e);
        }
    }
}
