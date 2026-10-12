package com.swp391.scms.config;

import com.swp391.scms.users.entity.User;
import com.swp391.scms.users.entity.Role;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.Metamodel;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PostgreSqlDataSecurityInitializerTest {
    @SuppressWarnings("unchecked")
    private EntityManagerFactory entities() {
        EntityManagerFactory factory = mock(EntityManagerFactory.class);
        Metamodel model = mock(Metamodel.class);
        EntityType<User> user = mock(EntityType.class);
        EntityType<Role> role = mock(EntityType.class);
        when(user.getJavaType()).thenReturn(User.class);
        when(role.getJavaType()).thenReturn(Role.class);
        when(model.getEntities()).thenReturn(Set.of(user, role));
        when(factory.getMetamodel()).thenReturn(model);
        return factory;
    }

    @Test
    void refusesToEnableRlsWhenBackendWouldLoseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("select current_schema()", String.class)).thenReturn("public");
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(), any())).thenReturn(false);
        var initializer = new PostgreSqlDataSecurityInitializer(entities(), jdbc);
        assertThrows(IllegalStateException.class,
                () -> initializer.run(new DefaultApplicationArguments()));
        verify(jdbc, never()).execute(anyString());
    }

    @Test
    void enablesRlsOnlyForEntityTablesInTheConnectedSchema() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("select current_schema()", String.class)).thenReturn("public");
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(), any())).thenReturn(true);
        new PostgreSqlDataSecurityInitializer(entities(), jdbc).run(new DefaultApplicationArguments());
        verify(jdbc).execute("alter table \"public\".\"users\" enable row level security");
        verify(jdbc).execute("alter table \"public\".\"roles\" enable row level security");
        verify(jdbc).execute("alter table \"public\".\"role_permissions\" enable row level security");
        verify(jdbc, times(3)).execute(anyString());
    }
}
