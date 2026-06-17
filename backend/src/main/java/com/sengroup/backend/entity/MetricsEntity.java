package com.sengroup.backend.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import java.math.BigDecimal;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "metrics", indexes = @Index(name = "idx_metrics_stage_id", columnList = "stage_id"))
public class MetricsEntity {

    @Id
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "stage_id", nullable = false)
    private AnalysisStageEntity stage;

    @Column(name = "accuracy")
    private BigDecimal accuracy;

    @Column(name = "avg_confidence")
    private BigDecimal avgConfidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "confusion_matrix", columnDefinition = "jsonb")
    private JsonNode confusionMatrix;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public AnalysisStageEntity getStage() {
        return stage;
    }

    public void setStage(AnalysisStageEntity stage) {
        this.stage = stage;
    }

    public BigDecimal getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(BigDecimal accuracy) {
        this.accuracy = accuracy;
    }

    public BigDecimal getAvgConfidence() {
        return avgConfidence;
    }

    public void setAvgConfidence(BigDecimal avgConfidence) {
        this.avgConfidence = avgConfidence;
    }

    public JsonNode getConfusionMatrix() {
        return confusionMatrix;
    }

    public void setConfusionMatrix(JsonNode confusionMatrix) {
        this.confusionMatrix = confusionMatrix;
    }
}
