package com.sengroup.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.UUID;

public record MetricsDTO(UUID id, UUID stageId, BigDecimal accuracy, BigDecimal avgConfidence, JsonNode confusionMatrix) {
}
