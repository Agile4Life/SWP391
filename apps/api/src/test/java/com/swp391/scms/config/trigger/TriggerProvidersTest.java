package com.swp391.scms.config.trigger;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;

class TriggerProvidersTest {

    private static BadSqlGrammarException grammar(SQLException cause) {
        return new BadSqlGrammarException("sql", "select", cause);
    }

    @Test
    void classifiesMissingTableForBothVendors() {
        assertTrue(TriggerErrors.isMissingTable(grammar(new SQLException("no table", "42P01"))));
        assertTrue(TriggerErrors.isMissingTable(grammar(new SQLException("Invalid object name", "S0002", 208))));
        assertFalse(TriggerErrors.isMissingTable(grammar(new SQLException("syntax", "42601", 102))));
    }

    @Test
    void postgresFailsStartupWhenMandatoryTablesOrTriggersAreMissing() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PostgreSqlTriggerProvider provider = new PostgreSqlTriggerProvider();

        doThrow(grammar(new SQLException("missing", "42P01"))).when(jdbc).execute(anyString());
        assertThrows(IllegalStateException.class, () -> provider.applyTriggers(jdbc));

        doThrow(grammar(new SQLException("syntax", "42601"))).when(jdbc).execute(anyString());
        assertThrows(IllegalStateException.class, () -> provider.applyTriggers(jdbc));
    }

    @Test
    void sqlServerSkipsMissingTableButFailsOnOtherErrors() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        SqlServerTriggerProvider provider = new SqlServerTriggerProvider();

        doThrow(grammar(new SQLException("Invalid object name", "S0002", 208))).when(jdbc).execute(anyString());
        assertDoesNotThrow(() -> provider.applyTriggers(jdbc));

        doThrow(grammar(new SQLException("syntax", "S0001", 102))).when(jdbc).execute(anyString());
        assertThrows(IllegalStateException.class, () -> provider.applyTriggers(jdbc));
    }
}
