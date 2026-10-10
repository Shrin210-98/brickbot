-- Runs once, on first init of the pgdata volume.
-- atlas_dev: clean scratch DB that Atlas uses to compute migration diffs (database-scoped, so
--            extensions diff correctly). Never put data here.
-- brickbot_test: target for `make test` integration tests.
CREATE DATABASE atlas_dev;
CREATE DATABASE brickbot_test;
