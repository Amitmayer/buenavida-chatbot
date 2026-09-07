import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Email } from "@/lib/db/types";
import { getMessage, resolveInlineImages } from "@/lib/email/gmail";
import { rewriteCidImages, wrapMailDocument } from "@/lib/email/html";
import { captureError } from "@/lib/sentry";

type Client = SupabaseClient<Database>;

export async function hydrateMailHtml(
  supabase: Client,
  args: { accessToken: string; mail: Email },
): Promise<string> {
  let stored = args.mail.body_html?.trim() ?? "";
  let images = new Map<string, string>();
  if (args.mail.gmail_id.startsWith("draft-") || args.mail.gmail_id.startsWith("sent-")) {
    return stored ? wrapMailDocument(stored) : "";
  }
  try {
    const parsed = await getMessage(args.accessToken, args.mail.gmail_id);
    if (parsed.html && parsed.html !== stored) {
      stored = parsed.html;
      await supabase
        .from("emails")
        .update({
          body_html: parsed.html,
          body_text: parsed.body || args.mail.body_text,
        })
        .eq("id", args.mail.id);
    }
    if (parsed.inlineImages.length > 0) {
      images = await resolveInlineImages(args.accessToken, parsed.gmailId, parsed.inlineImages);
    }
  } catch (error) {
    captureError(error, { where: "email.hydrate" });
  }
  if (!stored) return "";
  return wrapMailDocument(rewriteCidImages(stored, images));
}
