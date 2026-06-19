-- Schicht-Absage / Stornierung: Status canceled (Spec 008 Appendix A)

do $$
begin
  alter type public.shift_confirmation_status add value 'canceled';
exception
  when duplicate_object then null;
end $$;
