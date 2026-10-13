-- Private partner document storage. Files live under <auth.uid()>/... and metadata remains review-controlled.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'partner-documents',
  'partner-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "partner_upload_own_documents" on storage.objects;
drop policy if exists "partner_read_own_documents_storage" on storage.objects;
drop policy if exists "partner_replace_own_documents" on storage.objects;
drop policy if exists "partner_delete_own_documents" on storage.objects;

create policy "partner_upload_own_documents" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'partner-documents'
  and split_part(name,'/',1) = auth.uid()::text
);

create policy "partner_read_own_documents_storage" on storage.objects
for select to authenticated
using (
  bucket_id = 'partner-documents'
  and split_part(name,'/',1) = auth.uid()::text
);

create policy "partner_replace_own_documents" on storage.objects
for update to authenticated
using (
  bucket_id = 'partner-documents'
  and split_part(name,'/',1) = auth.uid()::text
)
with check (
  bucket_id = 'partner-documents'
  and split_part(name,'/',1) = auth.uid()::text
);

create policy "partner_delete_own_documents" on storage.objects
for delete to authenticated
using (
  bucket_id = 'partner-documents'
  and split_part(name,'/',1) = auth.uid()::text
);

create or replace function public.register_partner_document_upload(
  p_scope text,
  p_document_type text,
  p_storage_path text,
  p_document_number text default null,
  p_expiry_date date default null,
  p_vehicle_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_scope text := upper(trim(coalesce(p_scope,'')));
  v_type text := upper(trim(coalesce(p_document_type,'')));
  v_vehicle public.partner_vehicles;
  v_partner_doc public.partner_documents;
  v_vehicle_doc public.vehicle_documents;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if v_scope not in ('PARTNER','VEHICLE') then raise exception 'invalid_document_scope' using errcode = '22023'; end if;
  if v_type = '' then raise exception 'document_type_required' using errcode = '22023'; end if;
  if p_storage_path is null or split_part(p_storage_path,'/',1) <> v_uid::text then
    raise exception 'invalid_storage_path' using errcode = '42501';
  end if;

  if v_scope = 'PARTNER' then
    insert into public.partner_documents(
      partner_id,document_type,document_number,storage_path,expiry_date,status,rejection_reason,verified_by,verified_at,updated_at
    ) values (
      v_uid,v_type,nullif(trim(coalesce(p_document_number,'')),''),p_storage_path,p_expiry_date,'PENDING',null,null,null,now()
    )
    on conflict(partner_id,document_type) do update set
      document_number=excluded.document_number,
      storage_path=excluded.storage_path,
      expiry_date=excluded.expiry_date,
      status='PENDING',
      rejection_reason=null,
      verified_by=null,
      verified_at=null,
      updated_at=now()
    returning * into v_partner_doc;

    return jsonb_build_object(
      'scope','PARTNER','id',v_partner_doc.id,'document_type',v_partner_doc.document_type,
      'storage_path',v_partner_doc.storage_path,'status',v_partner_doc.status,'expiry_date',v_partner_doc.expiry_date
    );
  end if;

  if p_vehicle_id is null then
    select * into v_vehicle from public.partner_vehicles
    where partner_id=v_uid order by updated_at desc limit 1;
  else
    select * into v_vehicle from public.partner_vehicles
    where id=p_vehicle_id and partner_id=v_uid;
  end if;

  if not found then raise exception 'partner_vehicle_required' using errcode = 'P0002'; end if;

  insert into public.vehicle_documents(
    vehicle_id,document_type,document_number,storage_path,expiry_date,status,rejection_reason,verified_by,verified_at,updated_at
  ) values (
    v_vehicle.id,v_type,nullif(trim(coalesce(p_document_number,'')),''),p_storage_path,p_expiry_date,'PENDING',null,null,null,now()
  )
  on conflict(vehicle_id,document_type) do update set
    document_number=excluded.document_number,
    storage_path=excluded.storage_path,
    expiry_date=excluded.expiry_date,
    status='PENDING',
    rejection_reason=null,
    verified_by=null,
    verified_at=null,
    updated_at=now()
  returning * into v_vehicle_doc;

  return jsonb_build_object(
    'scope','VEHICLE','id',v_vehicle_doc.id,'vehicle_id',v_vehicle.id,'document_type',v_vehicle_doc.document_type,
    'storage_path',v_vehicle_doc.storage_path,'status',v_vehicle_doc.status,'expiry_date',v_vehicle_doc.expiry_date
  );
end
$$;

revoke all on function public.register_partner_document_upload(text,text,text,text,date,uuid) from public, anon;
grant execute on function public.register_partner_document_upload(text,text,text,text,date,uuid) to authenticated, service_role;
