package com.swp391.scms.shop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(
    name = "products",
    uniqueConstraints = @UniqueConstraint(name = "uq_products_slug", columnNames = "slug"),
    indexes = @Index(name = "ix_products_active_created", columnList = "active, created_at")
)
/**
 * Entity sản phẩm thực phẩm bổ sung (bảng products): danh mục, tên, slug, dạng bào chế, mô tả, khẩu phần, hướng
 * dẫn, cảnh báo, mục tiêu, biến thể và thành phần dinh dưỡng.
 */
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private ProductCategory category;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, length = 180)
    private String slug;

    @Column(length = 80)
    private String brand;

    @Column(nullable = false, length = 20)
    private String form = ProductForm.powder.name();

    @Column(name = "short_description", nullable = false, length = 300)
    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "serving_size", nullable = false, length = 60)
    private String servingSize;

    @Column(name = "usage_instructions", columnDefinition = "TEXT")
    private String usageInstructions;

    @Column(columnDefinition = "TEXT")
    private String warnings;

    @Column(name = "registration_number", length = 60)
    private String registrationNumber;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private boolean featured = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "product_goals", joinColumns = @JoinColumn(name = "product_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "goal", length = 30, nullable = false)
    private Set<ProductGoal> goals = new LinkedHashSet<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProductVariant> variants = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProductNutrient> nutrients = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProductImage> images = new ArrayList<>();

    /** Tự cập nhật updatedAt trước mỗi lần cập nhật. */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường category. */
    public ProductCategory getCategory() { return category; }
    /** Gán giá trị mới cho trường category. */
    public void setCategory(ProductCategory category) { this.category = category; }

    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }

    /** Lấy giá trị trường slug. */
    public String getSlug() { return slug; }
    /** Gán giá trị mới cho trường slug. */
    public void setSlug(String slug) { this.slug = slug; }

    /** Lấy giá trị trường brand. */
    public String getBrand() { return brand; }
    /** Gán giá trị mới cho trường brand. */
    public void setBrand(String brand) { this.brand = brand; }

    /** Lấy giá trị trường form. */
    public String getForm() { return form; }
    /** Gán giá trị mới cho trường form. */
    public void setForm(String form) { this.form = form; }
    /** Gán dạng bào chế (lưu tên enum dạng chuỗi, null giữ null). */
    public void setForm(ProductForm form) { this.form = form == null ? null : form.name(); }

    /** Lấy giá trị trường shortDescription. */
    public String getShortDescription() { return shortDescription; }
    /** Gán giá trị mới cho trường shortDescription. */
    public void setShortDescription(String shortDescription) { this.shortDescription = shortDescription; }

    /** Lấy giá trị trường description. */
    public String getDescription() { return description; }
    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) { this.description = description; }

    /** Lấy giá trị trường servingSize. */
    public String getServingSize() { return servingSize; }
    /** Gán giá trị mới cho trường servingSize. */
    public void setServingSize(String servingSize) { this.servingSize = servingSize; }

    /** Lấy giá trị trường usageInstructions. */
    public String getUsageInstructions() { return usageInstructions; }
    /** Gán giá trị mới cho trường usageInstructions. */
    public void setUsageInstructions(String usageInstructions) { this.usageInstructions = usageInstructions; }

    /** Lấy giá trị trường warnings. */
    public String getWarnings() { return warnings; }
    /** Gán giá trị mới cho trường warnings. */
    public void setWarnings(String warnings) { this.warnings = warnings; }

    /** Lấy giá trị trường registrationNumber. */
    public String getRegistrationNumber() { return registrationNumber; }
    /** Gán giá trị mới cho trường registrationNumber. */
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

    /** Cho biết active (trường boolean). */
    public boolean isActive() { return active; }
    /** Gán giá trị mới cho trường active. */
    public void setActive(boolean active) { this.active = active; }

    /** Cho biết featured (trường boolean). */
    public boolean isFeatured() { return featured; }
    /** Gán giá trị mới cho trường featured. */
    public void setFeatured(boolean featured) { this.featured = featured; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    /** Lấy giá trị trường goals. */
    public Set<ProductGoal> getGoals() { return goals; }
    /** Gán giá trị mới cho trường goals. */
    public void setGoals(Set<ProductGoal> goals) { this.goals = goals; }

    /** Lấy giá trị trường variants. */
    public List<ProductVariant> getVariants() { return variants; }
    /** Gán giá trị mới cho trường variants. */
    public void setVariants(List<ProductVariant> variants) { this.variants = variants; }

    /** Lấy giá trị trường nutrients. */
    public List<ProductNutrient> getNutrients() { return nutrients; }
    /** Gán giá trị mới cho trường nutrients. */
    public void setNutrients(List<ProductNutrient> nutrients) { this.nutrients = nutrients; }

    /** Lấy giá trị trường images. */
    public List<ProductImage> getImages() { return images; }
    /** Gán giá trị mới cho trường images. */
    public void setImages(List<ProductImage> images) { this.images = images; }
}
