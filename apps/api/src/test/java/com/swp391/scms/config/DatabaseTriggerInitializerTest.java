package com.swp391.scms.config;

import com.swp391.scms.config.trigger.DatabaseTriggerProvider;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.List;

import static org.mockito.Mockito.*;

class DatabaseTriggerInitializerTest {
    @Test
    void releasesMetadataConnectionBeforeInstallingTriggersSoOneConnectionPoolWorks() throws Exception {
        DataSource source = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        DatabaseTriggerProvider provider = mock(DatabaseTriggerProvider.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(provider.supports("PostgreSQL")).thenReturn(true);
        doAnswer(invocation -> {
            verify(connection).close();
            return null;
        }).when(provider).applyTriggers(jdbc);
        new DatabaseTriggerInitializer(source, jdbc, List.of(provider)).run(new DefaultApplicationArguments());
        verify(provider).applyTriggers(jdbc);
    }
}
