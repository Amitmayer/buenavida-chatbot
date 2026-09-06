import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import { refreshAccessToken } from "@/lib/email/gmail";

type Client = SupabaseClient<Database>;

export type ConnectedAccount = {
  id: string;
  email: string;
  user_id: string;
  canModify: boolean;
};

type AccountRow = Database["public"]["Tables"]["email_accounts"]["Row"];

export async function loadAccount(supabase: Client, userId: string): Promise<AccountRow | null> {
  const { data } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .maybeSingle();
  return data;
}

export async function publicAccount(
  supabase: Client,
  userId: string,
): Promise<ConnectedAccount | null> {
  const row = await loadAccount(supabase, userId);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    user_id: row.user_id,
    canModify: (row.scope ?? "").includes("gmail.modify"),
  };
}

export async function accessTokenFor(supabase: Client, userId: string): Promise<{
  account: AccountRow;
  accessToken: string;
} | null> {
  const account = await loadAccount(supabase, userId);
  if (!account) return null;
  const freshEnough =
    account.access_token_enc &&
    account.access_expires_at &&
    new Date(account.access_expires_at).getTime() > Date.now() + 60_000;
  if (freshEnough && account.access_token_enc) {
    return { account, accessToken: decryptSecret(account.access_token_enc) };
  }
  const refreshed = await refreshAccessToken(decryptSecret(account.refresh_token_enc));
  const accessEnc = encryptSecret(refreshed.access_token);
  const expires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("email_accounts")
    .update({
      access_token_enc: accessEnc,
      access_expires_at: expires,
      refresh_token_enc: refreshed.refresh_token
        ? encryptSecret(refreshed.refresh_token)
        : account.refresh_token_enc,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  return { account, accessToken: refreshed.access_token };
}
