DROP DATABASE IF EXISTS knex;
DROP USER IF EXISTS knex;

CREATE DATABASE knex
       ENCODING = 'UTF8'
       TABLESPACE = pg_default
       LC_COLLATE = 'en_GB.UTF-8'
       LC_CTYPE = 'en_GB.UTF-8'
       CONNECTION LIMIT = -1;

\c knex;


CREATE USER knex WITH PASSWORD 'knex';

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON tables TO knex;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, USAGE ON sequences TO knex;

DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS managers;

CREATE TABLE managers
(
  id serial NOT NULL,
  name character varying(255) NOT NULL,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  CONSTRAINT managers_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE teams
(
  id serial NOT NULL,
  name character varying(255),
  CONSTRAINT teams_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE results
(
  id serial NOT NULL,
  "time" timestamp with time zone NOT NULL,
  scored integer NOT NULL,
  conceded integer NOT NULL,
  result character varying(1) NOT NULL,
  "position" integer NOT NULL,
  team_id integer,
  location character varying(1) NOT NULL,
  manager_id integer,
  CONSTRAINT results_pkey PRIMARY KEY (id),
  CONSTRAINT results_manager_id_foreign FOREIGN KEY (manager_id)
      REFERENCES managers (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT results_team_id_foreign FOREIGN KEY (team_id)
      REFERENCES teams (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);
