package com.sengroup.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

public record FaceDTO(UUID id, Integer faceIndex, JsonNode bbox) {
}
