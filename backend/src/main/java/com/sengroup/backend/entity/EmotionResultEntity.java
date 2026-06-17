package com.sengroup.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(
        name = "emotion_results",
        indexes = {
                @Index(name = "idx_emotion_results_face_id", columnList = "face_id"),
                @Index(name = "idx_emotion_results_stage_id", columnList = "stage_id")
        })
public class EmotionResultEntity {

    @Id
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "face_id", nullable = false)
    private FaceEntity face;

    @ManyToOne(optional = false)
    @JoinColumn(name = "stage_id", nullable = false)
    private AnalysisStageEntity stage;

    @Column(name = "emotion_label")
    private String emotionLabel;

    @Column(name = "confidence")
    private BigDecimal confidence;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public FaceEntity getFace() {
        return face;
    }

    public void setFace(FaceEntity face) {
        this.face = face;
    }

    public AnalysisStageEntity getStage() {
        return stage;
    }

    public void setStage(AnalysisStageEntity stage) {
        this.stage = stage;
    }

    public String getEmotionLabel() {
        return emotionLabel;
    }

    public void setEmotionLabel(String emotionLabel) {
        this.emotionLabel = emotionLabel;
    }

    public BigDecimal getConfidence() {
        return confidence;
    }

    public void setConfidence(BigDecimal confidence) {
        this.confidence = confidence;
    }
}
