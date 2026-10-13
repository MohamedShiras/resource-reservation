ALTER TYPE resource_kind ADD VALUE IF NOT EXISTS 'amenities';

CREATE TABLE IF NOT EXISTS amenity_resources (
  resource_id BIGINT PRIMARY KEY,
  kind resource_kind NOT NULL DEFAULT 'amenities',
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  CONSTRAINT amenity_resources_kind_check CHECK (kind = 'amenities'),
  CONSTRAINT amenity_resources_resource_id_kind_fkey
    FOREIGN KEY (resource_id, kind) REFERENCES resources(id, kind) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION trg_resource_has_subtype()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM facilities WHERE resource_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM equipment WHERE resource_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM amenity_resources WHERE resource_id = NEW.id) THEN
    RAISE EXCEPTION 'Resource % needs a facilities, equipment, or amenity_resources row', NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;
