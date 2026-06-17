package com.sengroup.backend.service;

import com.sengroup.backend.client.RemotePipelineClient;
import com.sengroup.backend.dto.AnalysisStatusDTO;
import com.sengroup.backend.dto.MetricsDTO;
import com.sengroup.backend.dto.StageDTO;
import com.sengroup.backend.entity.AnalysisJobEntity;
import com.sengroup.backend.entity.AnalysisStageEntity;
import com.sengroup.backend.entity.EmotionResultEntity;
import com.sengroup.backend.entity.FaceEntity;
import com.sengroup.backend.entity.ImageEntity;
import com.sengroup.backend.entity.MetricsEntity;
import com.sengroup.backend.repository.AnalysisJobRepository;
import com.sengroup.backend.repository.AnalysisStageRepository;
import com.sengroup.backend.repository.EmotionResultRepository;
import com.sengroup.backend.repository.FaceRepository;
import com.sengroup.backend.repository.ImageRepository;
import com.sengroup.backend.repository.MetricsRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AnalysisService {

    private final ImageRepository imageRepository;
    private final AnalysisJobRepository analysisJobRepository;
    private final AnalysisStageRepository analysisStageRepository;
    private final MetricsRepository metricsRepository;
    private final FaceRepository faceRepository;
    private final EmotionResultRepository emotionResultRepository;
    private final StorageService storageService;
    private final RemotePipelineClient remotePipelineClient;
    private final TaskExecutor analysisExecutor;
    private final ObjectMapper objectMapper;

    public AnalysisService(
            ImageRepository imageRepository,
            AnalysisJobRepository analysisJobRepository,
            AnalysisStageRepository analysisStageRepository,
            MetricsRepository metricsRepository,
            FaceRepository faceRepository,
            EmotionResultRepository emotionResultRepository,
            StorageService storageService,
            RemotePipelineClient remotePipelineClient,
            @Qualifier("analysisExecutor") TaskExecutor analysisExecutor,
            ObjectMapper objectMapper
    ) {
        this.imageRepository = imageRepository;
        this.analysisJobRepository = analysisJobRepository;
        this.analysisStageRepository = analysisStageRepository;
        this.metricsRepository = metricsRepository;
        this.faceRepository = faceRepository;
        this.emotionResultRepository = emotionResultRepository;
        this.storageService = storageService;
        this.remotePipelineClient = remotePipelineClient;
        this.analysisExecutor = analysisExecutor;
        this.objectMapper = objectMapper;
    }

    public UUID start(UUID imageId) {
        ImageEntity image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found"));

        AnalysisJobEntity job = new AnalysisJobEntity();
        job.setId(UUID.randomUUID());
        job.setImage(image);
        job.setStatus(AnalysisJobEntity.Status.PENDING);
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        analysisJobRepository.saveAndFlush(job);

        UUID jobId = job.getId();
        analysisExecutor.execute(() -> runPipeline(jobId));
        return jobId;
    }

    private void runPipeline(UUID analysisId) {
        try {
            AnalysisJobEntity job = analysisJobRepository.findById(analysisId)
                    .orElseThrow(() -> new IllegalStateException("Analysis job not found: " + analysisId));
            updateStatus(job, AnalysisJobEntity.Status.RUNNING, null);
            ImageEntity image = job.getImage();
            String imageBase64 = Base64.getEncoder().encodeToString(storageService.readImage(image.getFilePath()));

            JsonNode stage0 = remotePipelineClient.detectFaces(imageBase64);
            AnalysisStageEntity s0 = saveStage(image, "stage0", stage0);
            Map<Integer, FaceEntity> faces = persistFaces(image, stage0);
            saveMetricIfPresent(s0, stage0);

            ObjectNode stage1Request = objectMapper.createObjectNode();
            stage1Request.put("image_base64", imageBase64);
            stage1Request.set("stage0", stage0);
            JsonNode stage1 = remotePipelineClient.stage1(stage1Request);
            AnalysisStageEntity s1 = saveStage(image, "stage1", stage1);
            persistEmotionResults(faces, s1, stage1);
            saveMetricIfPresent(s1, stage1);

            ObjectNode stage2Request = objectMapper.createObjectNode();
            stage2Request.put("image_base64", imageBase64);
            stage2Request.set("stage1", stage1);
            JsonNode stage2 = remotePipelineClient.stage2(stage2Request);
            AnalysisStageEntity s2 = saveStage(image, "stage2", stage2);
            persistEmotionResults(faces, s2, stage2);
            saveMetricIfPresent(s2, stage2);

            ObjectNode stage3Request = objectMapper.createObjectNode();
            stage3Request.put("image_base64", imageBase64);
            stage3Request.set("stage2", stage2);
            JsonNode stage3 = remotePipelineClient.stage3(stage3Request);
            AnalysisStageEntity s3 = saveStage(image, "stage3", stage3);
            persistEmotionResults(faces, s3, stage3);
            saveMetricIfPresent(s3, stage3);

            updateStatus(job, AnalysisJobEntity.Status.COMPLETED, null);
        } catch (Exception e) {
            analysisJobRepository.findById(analysisId).ifPresent(j ->
                    updateStatus(j, AnalysisJobEntity.Status.FAILED, e.getMessage()));
        }
    }

    private void updateStatus(AnalysisJobEntity job, AnalysisJobEntity.Status status, String error) {
        job.setStatus(status);
        job.setErrorMessage(error);
        job.setUpdatedAt(Instant.now());
        analysisJobRepository.save(job);
    }

    private AnalysisStageEntity saveStage(ImageEntity image, String stageName, JsonNode payload) {
        AnalysisStageEntity stage = new AnalysisStageEntity();
        stage.setId(UUID.randomUUID());
        stage.setImage(image);
        stage.setStageName(stageName);
        stage.setPayload(payload);
        return analysisStageRepository.save(stage);
    }

    private Map<Integer, FaceEntity> persistFaces(ImageEntity image, JsonNode stage0) {
        JsonNode facesNode = stage0.path("faces");
        if (!facesNode.isArray()) {
            return Map.of();
        }
        return java.util.stream.StreamSupport.stream(facesNode.spliterator(), false)
                .map(faceNode -> {
                    FaceEntity face = new FaceEntity();
                    face.setId(UUID.randomUUID());
                    face.setImage(image);
                    face.setFaceIndex(faceNode.path("face_id").asInt());
                    face.setBbox(faceNode.get("bbox"));
                    return faceRepository.save(face);
                })
                .collect(Collectors.toMap(FaceEntity::getFaceIndex, f -> f));
    }

    private void persistEmotionResults(Map<Integer, FaceEntity> faces, AnalysisStageEntity stage, JsonNode payload) {
        JsonNode predictions = payload.path("predictions");
        if (!predictions.isArray()) {
            return;
        }
        for (JsonNode prediction : predictions) {
            int faceId = prediction.path("face_id").asInt(-1);
            FaceEntity face = faces.get(faceId);
            if (face == null) {
                continue;
            }
            EmotionResultEntity result = new EmotionResultEntity();
            result.setId(UUID.randomUUID());
            result.setFace(face);
            result.setStage(stage);
            result.setEmotionLabel(prediction.path("emotion_label").asText(null));
            JsonNode confidence = prediction.get("confidence");
            result.setConfidence(confidence == null || confidence.isNull() ? null : confidence.decimalValue());
            emotionResultRepository.save(result);
        }
    }

    private void saveMetricIfPresent(AnalysisStageEntity stage, JsonNode stagePayload) {
        JsonNode metrics = stagePayload.path("metrics");
        if (metrics.isMissingNode() || metrics.isNull()) {
            return;
        }
        MetricsEntity entity = new MetricsEntity();
        entity.setId(UUID.randomUUID());
        entity.setStage(stage);
        entity.setAccuracy(readDecimal(metrics.get("accuracy")));
        entity.setAvgConfidence(readDecimal(metrics.get("avg_confidence")));
        entity.setConfusionMatrix(metrics.get("confusion_matrix"));
        metricsRepository.save(entity);
    }

    private BigDecimal readDecimal(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        return node.decimalValue();
    }

    public AnalysisStatusDTO status(UUID analysisId) {
        AnalysisJobEntity job = analysisJobRepository.findById(analysisId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis not found"));
        return new AnalysisStatusDTO(job.getId(), job.getStatus().name(), job.getErrorMessage(), job.getUpdatedAt());
    }

    public List<StageDTO> stages(UUID analysisId) {
        AnalysisJobEntity job = analysisJobRepository.findById(analysisId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis not found"));
        return analysisStageRepository.findByImageOrderByStageNameAsc(job.getImage()).stream()
                .map(s -> new StageDTO(s.getId(), s.getStageName(), s.getPayload()))
                .toList();
    }

    public List<MetricsDTO> metrics(UUID analysisId) {
        AnalysisJobEntity job = analysisJobRepository.findById(analysisId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis not found"));
        List<AnalysisStageEntity> stages = analysisStageRepository.findByImageOrderByStageNameAsc(job.getImage());
        return metricsRepository.findByStageIn(stages).stream()
                .map(m -> new MetricsDTO(
                        m.getId(),
                        m.getStage().getId(),
                        m.getAccuracy(),
                        m.getAvgConfidence(),
                        m.getConfusionMatrix()))
                .toList();
    }

    public Map<String, Object> fullResults(UUID analysisId) {
        return Map.of(
                "analysis", status(analysisId),
                "stages", stages(analysisId),
                "metrics", metrics(analysisId));
    }

    public String exportCsv(UUID analysisId) {
        List<StageDTO> stageRows = stages(analysisId);
        String header = "stage_id,stage_name,payload\n";
        String body = stageRows.stream()
                .map(s -> s.id() + "," + s.stageName() + ",\"" + s.payload().toString().replace("\"", "\"\"") + "\"")
                .collect(Collectors.joining("\n"));
        return header + body;
    }
}
