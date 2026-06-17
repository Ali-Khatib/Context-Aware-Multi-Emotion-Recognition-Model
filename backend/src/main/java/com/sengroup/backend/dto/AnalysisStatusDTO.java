package com.sengroup.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record AnalysisStatusDTO(UUID analysisId, String status, String errorMessage, Instant updatedAt) {
}
