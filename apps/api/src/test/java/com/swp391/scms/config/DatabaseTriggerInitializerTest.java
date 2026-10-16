package com.swp391.scms.config;

import com.swp391.scms.config.trigger.DatabaseTriggerProvider;
import com.swp391.scms.config.trigger.PostgreSqlTriggerProvider;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DatabaseTriggerInitializerTest {
    @Test
    void refusesUnsupportedDatabasesRatherThanStartingWithoutMandatoryTriggers() throws Exception {
        DataSource source = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn("Unsupported database");

        assertThrows(IllegalStateException.class, () -> new DatabaseTriggerInitializer(source, jdbc,
                List.of(new PostgreSqlTriggerProvider())).run(new DefaultApplicationArguments()));

        verifyNoInteractions(jdbc);
        verify(connection).close();
    }

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
