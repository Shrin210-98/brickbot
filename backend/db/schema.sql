-- Source of truth for the database. Edit, then:
--   make migrate-diff name=<x> && make migrate && make sqlc
-- No triggers: every UPDATE query sets updated_at = now() explicitly.

-- The one salesman. Singleton row (id = 1). Locale defaults are India / INR / sqft.
CREATE TABLE salesman_profile (
  id                  smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name                text        NOT NULL,
  phone               text        NOT NULL,                -- E.164, e.g. +919876543210
  whatsapp_number     text        NOT NULL DEFAULT '',     -- digits only, for wa.me links, e.g. 919876543210
  email               text        NOT NULL DEFAULT '',
  bio                 text        NOT NULL DEFAULT '',
  service_areas       text[]      NOT NULL DEFAULT '{}',   -- free text, e.g. {"Andheri West", "Bandra"}
  photo_path          text,                                -- relative to /media/
  country_code        text        NOT NULL DEFAULT 'IN',
  currency            text        NOT NULL DEFAULT 'INR',
  area_unit           text        NOT NULL DEFAULT 'sqft' CHECK (area_unit IN ('sqft', 'sqm')),
  admin_email         text        NOT NULL DEFAULT '',     -- login email, set by seed from ADMIN_EMAIL; not shown publicly
  admin_password_hash text        NOT NULL,                -- bcrypt
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        NOT NULL UNIQUE,
  title         text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  listing_type  text        NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  property_type text        NOT NULL CHECK (property_type IN ('apartment', 'house', 'villa', 'plot', 'commercial', 'other')),
  status        text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold', 'rented')),
  price         bigint      NOT NULL CHECK (price >= 0), -- whole units of the profile currency (rent: per month)
  bedrooms      smallint    CHECK (bedrooms >= 0),
  bathrooms     smallint    CHECK (bathrooms >= 0),
  area          integer     CHECK (area > 0),            -- in the profile area_unit
  city          text        NOT NULL,
  locality      text        NOT NULL DEFAULT '',
  address       text        NOT NULL DEFAULT '',
  featured      boolean     NOT NULL DEFAULT false,
  deleted_at    timestamptz,                             -- soft delete; every query filters deleted_at IS NULL
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listings_status_created_at_idx ON listings (status, created_at DESC);

CREATE TABLE listing_media (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid        NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  path       text        NOT NULL,                       -- relative to /media/
  media_type text        NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listing_media_listing_id_position_idx ON listing_media (listing_id, position);

-- One chatbot conversation, bound to the browser's visitor_id. See docs/chatbot.md.
CREATE TABLE chat_sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only history: one row per Anthropic API turn, never updated or deleted.
-- content is the raw content-block array as sent to / received from the API.
CREATE TABLE chat_messages (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid        NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    jsonb       NOT NULL CHECK (jsonb_typeof(content) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_session_id_id_idx ON chat_messages (session_id, id);

-- Leads from the public inquiry form (source = 'form') and the chatbot (source = 'chat').
CREATE TABLE inquiries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid        REFERENCES listings (id) ON DELETE SET NULL,
  name            text        NOT NULL,
  phone           text        NOT NULL DEFAULT '',
  email           text        NOT NULL DEFAULT '',
  message         text        NOT NULL DEFAULT '',
  source          text        NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'chat')),
  status          text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed', 'spam')),
  admin_note      text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  chat_session_id uuid        REFERENCES chat_sessions (id) ON DELETE SET NULL, -- set when source = 'chat'
  CONSTRAINT inquiries_contact_check CHECK (phone <> '' OR email <> '')
);

CREATE INDEX inquiries_status_created_at_idx ON inquiries (status, created_at DESC);
CREATE INDEX inquiries_listing_id_idx ON inquiries (listing_id);
-- At most one chatbot lead per conversation.
CREATE UNIQUE INDEX inquiries_chat_session_id_key ON inquiries (chat_session_id) WHERE chat_session_id IS NOT NULL;
