# Base image: PostGIS on Postgres 16
FROM postgis/postgis:16-3.4

# Install h3-pg: Uber H3 Postgres extension
# Package name: postgresql-16-h3 from PGDG repos (pre-configured on PostGIS image)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-16-h3 \
        postgresql-16-h3-postgis \
    && rm -rf /var/lib/apt/lists/*

# Init script enables extensions on DB creation
COPY init.sql /docker-entrypoint-initdb.d/10-extensions.sql
