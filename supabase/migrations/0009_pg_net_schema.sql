-- pg_net registered itself in public (it is not relocatable, so it cannot be
-- moved); the linter wants extensions out of the API-exposed schema. Its
-- functions live in the net schema either way, and the queue is empty.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
