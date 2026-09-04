-- Directory card for search: name, role, and email from auth.users.
-- Email is not a profiles column; this is the one allowed read of auth.users,
-- scoped to a signed-in caller and a single person.

create or replace function public.profile_directory(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then null
    else (
      select jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'title', p.title,
        'role', p.role,
        'email', u.email
      )
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.id = p_id
    )
  end;
$$;

revoke all on function public.profile_directory(uuid) from public;
grant execute on function public.profile_directory(uuid) to authenticated;
