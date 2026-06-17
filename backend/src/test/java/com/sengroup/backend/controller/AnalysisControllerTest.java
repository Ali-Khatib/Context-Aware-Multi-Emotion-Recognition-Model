package com.sengroup.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AnalysisControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void startAfterUpload_returns200() throws Exception {
        byte[] bytes = Files.readAllBytes(
                Path.of("storage/images").toAbsolutePath().resolve(
                        Files.list(Path.of("storage/images")).findFirst().orElseThrow().getFileName()));
        MvcResult upload = mockMvc.perform(multipart("/images/upload").file(new MockMultipartFile(
                        "file", "t.jpg", "image/jpeg", bytes)))
                .andExpect(status().isOk())
                .andReturn();
        String body = upload.getResponse().getContentAsString();
        String id = body.replaceAll(".*\"id\"\\s*:\\s*\"([^\"]+)\".*", "$1");

        mockMvc.perform(post("/analysis/start/" + id).contentType("application/json").content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisId").exists());
    }
}
