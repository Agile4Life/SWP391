package com.swp391.scms.facilities.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Persistent marker preventing initial room data from being recreated after deletion. */
@Entity
@Table(name = "catalog_initialization")
public class CatalogInitialization {
    @Id
    private String id;

    protected CatalogInitialization() {}

    public CatalogInitialization(String id) { this.id = id; }
}
