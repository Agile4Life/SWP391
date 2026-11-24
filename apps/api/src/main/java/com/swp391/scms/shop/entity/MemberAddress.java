package com.swp391.scms.shop.entity;

import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "member_addresses",
    indexes = @Index(name = "ix_member_addresses_member", columnList = "member_id")
)
public class MemberAddress {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "recipient_name", nullable = false, length = 80)
    private String recipientName;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(name = "province_code", nullable = false, length = 10)
    private String provinceCode;

    @Column(name = "province_name", nullable = false, length = 80)
    private String provinceName;

    @Column(name = "ward_code", nullable = false, length = 10)
    private String wardCode;

    @Column(name = "ward_name", nullable = false, length = 80)
    private String wardName;

    @Column(name = "street_line", nullable = false, length = 200)
    private String streetLine;

    @Column(length = 200)
    private String note;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }

    /** Lấy giá trị trường recipientName. */
    public String getRecipientName() { return recipientName; }
    /** Gán giá trị mới cho trường recipientName. */
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    /** Lấy giá trị trường phone. */
    public String getPhone() { return phone; }
    /** Gán giá trị mới cho trường phone. */
    public void setPhone(String phone) { this.phone = phone; }

    /** Lấy giá trị trường provinceCode. */
    public String getProvinceCode() { return provinceCode; }
    /** Gán giá trị mới cho trường provinceCode. */
    public void setProvinceCode(String provinceCode) { this.provinceCode = provinceCode; }

    /** Lấy giá trị trường provinceName. */
    public String getProvinceName() { return provinceName; }
    /** Gán giá trị mới cho trường provinceName. */
    public void setProvinceName(String provinceName) { this.provinceName = provinceName; }

    /** Lấy giá trị trường wardCode. */
    public String getWardCode() { return wardCode; }
    /** Gán giá trị mới cho trường wardCode. */
    public void setWardCode(String wardCode) { this.wardCode = wardCode; }

    /** Lấy giá trị trường wardName. */
    public String getWardName() { return wardName; }
    /** Gán giá trị mới cho trường wardName. */
    public void setWardName(String wardName) { this.wardName = wardName; }

    /** Lấy giá trị trường streetLine. */
    public String getStreetLine() { return streetLine; }
    /** Gán giá trị mới cho trường streetLine. */
    public void setStreetLine(String streetLine) { this.streetLine = streetLine; }

    /** Lấy giá trị trường note. */
    public String getNote() { return note; }
    /** Gán giá trị mới cho trường note. */
    public void setNote(String note) { this.note = note; }

    /** Cho biết default (trường boolean). */
    public boolean isDefault() { return isDefault; }
    /** Lấy giá trị trường isDefault. */
    public boolean getIsDefault() { return isDefault; }
    /** Gán giá trị mới cho trường default. */
    public void setDefault(boolean aDefault) { this.isDefault = aDefault; }
    /** Gán giá trị mới cho trường isDefault. */
    public void setIsDefault(boolean aDefault) { this.isDefault = aDefault; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
