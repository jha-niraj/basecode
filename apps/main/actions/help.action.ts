"use server"

/**
 * /help's contact form. Sends a transactional email to SUPPORT_EMAIL with the person's address as reply-to. Read at call
 * time; unset (or whitespace) = not sent, and the answer says so - never a fake "sent".
 */
import { requireSession } from "@repo/auth/next"
import { esc, heading, layout, paragraph, sendEmail } from "@repo/email"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"

export async function sendSupportMessage(input: { subject: string; message: string }): Promise<ActionResult<{ status: "sent" | "skipped" }>> {
    try {
        const session = await requireSession()
        const subject = typeof input.subject === "string" ? input.subject.trim() : ""
        const message = typeof input.message === "string" ? input.message.trim() : ""
        if (!subject) return failWith("validation", "Add a subject.")
        if (subject.length > 150) return failWith("validation", "Keep the subject under 150 characters.")
        if (message.length < 10) return failWith("validation", "Tell us a little more - at least a sentence.")
        if (message.length > 5000) return failWith("validation", "Keep the message under 5,000 characters.")

        const to = process.env.SUPPORT_EMAIL?.trim()
        if (!to) {
            console.warn("[help] SUPPORT_EMAIL is not set - support message not sent")
            return ok({ status: "skipped" })
        }

        const { name, email } = session.user
        const html = layout({
            preheader: subject,
            body: [
                heading(subject),
                paragraph(`From ${esc(name)} (${esc(email)})`),
                paragraph(esc(message).replace(/\n/g, "<br />")),
            ].join(""),
            footnote: "Sent from the Help page. Reply to answer them directly.",
        })
        const res = await sendEmail({ kind: "transactional", to, subject: `Support: ${subject}`, html, replyTo: email })
        if (res.status === "failed") return failWith("network", "The message did not go through. Try again in a minute.")
        return ok({ status: res.status === "sent" ? "sent" : "skipped" })
    } catch (err) {
        return fail(err, "help.contact")
    }
}
