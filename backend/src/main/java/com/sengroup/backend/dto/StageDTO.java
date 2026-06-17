package com.sengroup.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

public record StageDTO(UUID id, String stageName, JsonNode payload) {
}
