package com.swp391.scms.shop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Danh mục hành chính 2 cấp (sau 01/07/2025) nạp một lần từ resource đóng gói; không gọi dịch vụ ngoài lúc chạy. */
@Service
public class GeoService {
    /** Một đơn vị hành chính: mã và tên. */
    public record Region(String code, String name) {}
    /** Kết quả tra cứu tỉnh + phường hợp lệ: mã và tên của cả hai. */
    public record ResolvedRegion(String provinceCode, String provinceName, String wardCode, String wardName) {}

    private final List<Region> provinces;
    private final Map<String, List<Region>> wardsByProvince;

    /** Nạp danh sách tỉnh/phường từ file geo/vn-admin-units.json khi khởi tạo. */
    public GeoService(ObjectMapper mapper) {
        try (var in = new ClassPathResource("geo/vn-admin-units.json").getInputStream()) {
            JsonNode root = mapper.readTree(in);
            List<Region> list = new ArrayList<>();
            Map<String, List<Region>> wards = new HashMap<>();
            for (JsonNode p : root.get("provinces")) {
                Region province = new Region(p.get("code").asText(), p.get("name").asText());
                list.add(province);
                List<Region> ws = new ArrayList<>();
                for (JsonNode w : p.get("wards")) {
                    ws.add(new Region(w.get("code").asText(), w.get("name").asText()));
                }
                wards.put(province.code(), List.copyOf(ws));
            }
            this.provinces = List.copyOf(list);
            this.wardsByProvince = Map.copyOf(wards);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load geo/vn-admin-units.json", e);
        }
    }

    /** Danh sách tỉnh/thành. */
    public List<Region> provinces() {
        return provinces;
    }

    /** Danh sách phường/xã của một tỉnh (mã không tồn tại thì rỗng). */
    public List<Region> wards(String provinceCode) {
        return wardsByProvince.getOrDefault(provinceCode, List.of());
    }

    /** Kiểm tra cặp mã tỉnh–phường hợp lệ và trả về tên tương ứng; không hợp lệ thì rỗng. */
    public Optional<ResolvedRegion> resolve(String provinceCode, String wardCode) {
        return provinces.stream()
                .filter(p -> p.code().equals(provinceCode))
                .findFirst()
                .flatMap(p -> wards(p.code()).stream()
                        .filter(w -> w.code().equals(wardCode))
                        .findFirst()
                        .map(w -> new ResolvedRegion(p.code(), p.name(), w.code(), w.name())));
    }
}
