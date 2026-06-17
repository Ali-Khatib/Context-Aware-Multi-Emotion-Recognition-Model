package com.sengroup.backend.controller;

import com.sengroup.backend.dto.AnalysisStatusDTO;
import com.sengroup.backend.dto.MetricsDTO;
import com.sengroup.backend.dto.StageDTO;
import com.sengroup.backend.service.AnalysisService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping("/start/{imageId}")
    public Map<String, UUID> start(@PathVariable("imageId") UUID imageId) {
        return Map.of("analysisId", analysisService.start(imageId));
    }

    @GetMapping("/{id}/status")
    public AnalysisStatusDTO status(@PathVariable("id") UUID id) {
        return analysisService.status(id);
    }

    @GetMapping("/{id}/results")
    public Map<String, Object> results(@PathVariable("id") UUID id) {
        return analysisService.fullResults(id);
    }

    @GetMapping("/{id}/metrics")
    public List<MetricsDTO> metrics(@PathVariable("id") UUID id) {
        return analysisService.metrics(id);
    }

    @GetMapping("/{id}/stages")
    public List<StageDTO> stages(@PathVariable("id") UUID id) {
        return analysisService.stages(id);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable("id") UUID id) {
        String csv = analysisService.exportCsv(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=analysis-" + id + ".csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
