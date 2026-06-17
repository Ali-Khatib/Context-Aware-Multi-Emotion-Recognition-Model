package com.sengroup.backend.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record EmotionResultDTO(UUID id, UUID faceId, UUID stageId, String emotionLabel, BigDecimal confidence) {
}
