package com.sengroup.backend.controller;

import com.sengroup.backend.dto.ImageDTO;
import com.sengroup.backend.service.ImageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/images")
public class ImageController {

    private static final long MAX_SIZE = 10 * 1024 * 1024;
    private static final String PNG = "image/png";
    private static final String JPG = "image/jpeg";

    private final ImageService imageService;

    public ImageController(ImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageDTO> upload(@RequestPart("file") MultipartFile file) {
        if (file.getSize() > MAX_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "File too large. Maximum upload size is 10 MB.");
        }
        String contentType = file.getContentType();
        if (!PNG.equals(contentType) && !JPG.equals(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PNG/JPG allowed");
        }
        return ResponseEntity.ok(imageService.upload(file));
    }
}
