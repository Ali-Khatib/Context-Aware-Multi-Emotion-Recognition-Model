package com.sengroup.backend.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "faces", indexes = @Index(name = "idx_faces_image_id", columnList = "image_id"))
public class FaceEntity {

    @Id
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "image_id", nullable = false)
    private ImageEntity image;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "bbox", columnDefinition = "jsonb")
    private JsonNode bbox;

    @Column(name = "face_index", nullable = false)
    private Integer faceIndex;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public ImageEntity getImage() {
        return image;
    }

    public void setImage(ImageEntity image) {
        this.image = image;
    }

    public JsonNode getBbox() {
        return bbox;
    }

    public void setBbox(JsonNode bbox) {
        this.bbox = bbox;
    }

    public Integer getFaceIndex() {
        return faceIndex;
    }

    public void setFaceIndex(Integer faceIndex) {
        this.faceIndex = faceIndex;
    }
}
