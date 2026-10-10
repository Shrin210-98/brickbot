# Declarative source of truth: db/schema.sql. Versioned files: db/migrations.
# The dev database is a clean, database-scoped scratch DB (created by postgres/init) so that
# extensions such as pg_trgm are diffed correctly.

env "local" {
  src = "file://db/schema.sql"
  url = getenv("DATABASE_URL")
  dev = getenv("ATLAS_DEV_URL")
  migration {
    dir = "file://db/migrations"
  }
}

env "test" {
  src = "file://db/schema.sql"
  url = getenv("TEST_DATABASE_URL")
  dev = getenv("ATLAS_DEV_URL")
  migration {
    dir = "file://db/migrations"
  }
}
