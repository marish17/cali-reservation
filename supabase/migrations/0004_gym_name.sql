-- Nome della palestra: Calisthenics Academy.
-- La condizione evita di sovrascrivere un nome scelto dal pannello:
-- tocca solo la riga rimasta al valore predefinito iniziale.
update public.settings
   set gym_name = 'Calisthenics Academy', updated_at = now()
 where id and gym_name = 'Calisthenics Club';
