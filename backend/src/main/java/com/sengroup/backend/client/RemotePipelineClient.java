package com.sengroup.backend.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
public class RemotePipelineClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public RemotePipelineClient(
            @Value("${app.pipeline.remote-base-url}") String baseUrl,
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
    }

    public JsonNode detectFaces(String imageBase64) {
        return post("/detect-faces", Map.of("image_base64", imageBase64));
    }

    public JsonNode stage1(JsonNode payload) {
        return post("/stage1/predict", payload);
    }

    public JsonNode stage2(JsonNode payload) {
        return post("/stage2/refine", payload);
    }

    public JsonNode stage3(JsonNode payload) {
        return post("/stage3/reason", payload);
    }

    private JsonNode post(String path, Object body) {
        final String json;
        try {
            json = objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Pipeline request encoding failed", e);
        }
        try {
            return restClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(json)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            String detail = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            throw new IllegalStateException(
                    "Pipeline " + path + " failed (" + e.getStatusCode().value() + "): " + detail,
                    e);
        }
    }
}
