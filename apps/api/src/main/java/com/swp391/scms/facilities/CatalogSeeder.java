package com.swp391.scms.facilities;

import com.swp391.scms.facilities.dto.CatalogRequests.DisciplineRequest;
import com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest;
import com.swp391.scms.facilities.dto.CatalogRequests.RoomRequest;
import com.swp391.scms.facilities.service.DisciplineService;
import com.swp391.scms.facilities.service.PackageService;
import com.swp391.scms.facilities.service.RoomService;
import java.math.BigDecimal;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Seeds sample disciplines, rooms and packages into empty catalogs (idempotent). */
@Component
public class CatalogSeeder implements ApplicationRunner {

    private final DisciplineService disciplines;
    private final RoomService rooms;
    private final PackageService packages;

    public CatalogSeeder(DisciplineService disciplines, RoomService rooms, PackageService packages) {
        this.disciplines = disciplines;
        this.rooms = rooms;
        this.packages = packages;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(ApplicationArguments args) {
        if (disciplines.list().isEmpty()) {
            disciplines.create(new DisciplineRequest("Reformer Pilates", "Core strength and spine recovery on Reformer machines"));
            disciplines.create(new DisciplineRequest("Olympic Strength", "Explosive strength with Olympic barbells"));
            disciplines.create(new DisciplineRequest("Mindful Yoga", "Breathwork, deep stretching and meditation"));
            disciplines.create(new DisciplineRequest("Boxing & Kickfit", "Combat tactics, reflexes and high-intensity fat burn"));
            disciplines.create(new DisciplineRequest("Thermal Aquatics", "Hydrodynamic swimming and warm-water recovery"));
        }
        if (rooms.list().isEmpty()) {
            rooms.create(new RoomRequest("Studio 01", "Level 2 - North Wing", 12, "available"));
            rooms.create(new RoomRequest("Arena 02 (Strength)", "Level 1 - Main Floor", 25, "available"));
            rooms.create(new RoomRequest("Zen Garden Studio", "Penthouse", 18, "available"));
            rooms.create(new RoomRequest("Ring Arena 01", "Level 1 - East Wing", 14, "maintenance"));
            rooms.create(new RoomRequest("Oasis Lap Pool", "Sub-level Oasis", 20, "available"));
        }
        if (packages.list().isEmpty()) {
            packages.create(new PackageRequest("The Essential", "8 classes per month", new BigDecimal("299000"), 30, 8, "active"));
            packages.create(new PackageRequest("The Sanctuary VIP", "Unlimited classes", new BigDecimal("499000"), 90, null, "active"));
            packages.create(new PackageRequest("The Sovereign Annual", "Unlimited classes + 24 PT sessions", new BigDecimal("999000"), 365, null, "active"));
        } else {
            // One-time correction of the original catalog only. Manager edits are never overwritten.
            for (var pkg : packages.list()) {
                String original = switch (pkg.name()) {
                    case "The Essential" -> "2800000";
                    case "The Sanctuary VIP" -> "7500000";
                    case "The Sovereign Annual" -> "26000000";
                    default -> null;
                };
                if (original == null || pkg.price().compareTo(new BigDecimal(original)) != 0) continue;
                String revised = switch (original) {
                    case "2800000" -> "299000";
                    case "7500000" -> "499000";
                    default -> "999000";
                };
                packages.update(pkg.id(), new PackageRequest(pkg.name(), pkg.description(), new BigDecimal(revised),
                        pkg.durationDays(), pkg.classCreditLimit(), pkg.status()));
            }
        }
    }
}
