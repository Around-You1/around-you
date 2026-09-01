-- Partner invoices give 3 days to pay (due date = invoice date + 3). Align the
-- invoice footer wording with that: change the default payment-terms text, and
-- update any existing settings row still holding the old default so it isn't
-- left saying "due immediately". A custom, admin-edited terms string is left
-- untouched (only the exact old default is replaced).
alter table invoice_settings
  alter column payment_terms set default 'Payment due within 3 days of the invoice date.';

update invoice_settings
set    payment_terms = 'Payment due within 3 days of the invoice date.'
where  payment_terms = 'Payment due immediately.'
   or  coalesce(trim(payment_terms), '') = '';
