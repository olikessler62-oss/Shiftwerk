-- Vergangene Schichten mit unbeantworteter Bestätigungsanfrage → Status „unresolved“ (Ungeklärt).

do $$
begin
  alter type public.shift_confirmation_status add value 'unresolved';
exception
  when duplicate_object then null;
end $$;
