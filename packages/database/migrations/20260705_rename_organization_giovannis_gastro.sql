-- Organisationsname „OKE Medicare“ → „Giovanni's Gastro“ (bestehende Daten).

update public.organizations
set name = 'Giovanni''s Gastro'
where name = 'OKE Medicare';
