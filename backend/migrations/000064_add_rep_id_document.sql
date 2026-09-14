-- Rep applicants may upload a copy of their SA ID / passport. The file itself
-- lives in the PRIVATE "rep-documents" Supabase Storage bucket; this column
-- holds only the stored object filename, resolved to a short-lived signed URL
-- for admins on demand (see auth.RepIDDocument). NULL/'' means none on file.
alter table users add column if not exists id_document_path text;
