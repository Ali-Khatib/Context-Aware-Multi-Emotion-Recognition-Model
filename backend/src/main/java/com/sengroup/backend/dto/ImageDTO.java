package com.sengroup.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record ImageDTO(UUID id, String filePath, Instant uploadTimestamp) {
}
