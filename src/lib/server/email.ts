import { escapeHtml } from '../formatting';

/** A transactional email built around one link: verify an address, reset a password, … */
export interface Email {
	to: string;
	subject: string;
	/** Why the recipient is getting this email. */
	intro: string;
	action: { label: string; url: string };
	/** What to do if the recipient did not ask for it. */
	note: string;
}

/** Never rejects: a failed send is logged, so no response reveals whether an email went out. */
export type SendEmail = (email: Email) => Promise<void>;

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function verificationEmail(to: string, url: string): Email {
	return {
		to,
		subject: 'Verify your email for Kizuna',
		intro: 'Confirm that you want to use this email address for your Kizuna account.',
		action: { label: 'Verify email', url },
		note: "If you didn't ask for this, you can ignore this email."
	};
}

export function passwordResetEmail(to: string, url: string): Email {
	return {
		to,
		subject: 'Reset your Kizuna password',
		intro: 'We received a request to reset the password for your Kizuna account.',
		action: { label: 'Reset password', url },
		note: "If you didn't ask for this, you can ignore this email. Your password won't change."
	};
}

/** Sent to the current address of a verified account before its email can change. */
export function emailChangeEmail(to: string, newEmail: string, url: string): Email {
	return {
		to,
		subject: 'Approve your new Kizuna email',
		intro: `We received a request to change the email for your Kizuna account to ${newEmail}. If you approve, we'll send a link to that address to finish.`,
		action: { label: 'Approve change', url },
		note: "If you didn't ask for this, ignore this email and change your password."
	};
}

function renderHtml({ subject, intro, action, note }: Email): string {
	const url = escapeHtml(action.url);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div role="article" aria-label="${escapeHtml(subject)}" style="max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
<p style="margin:0 0 24px;font-size:15px;font-weight:700">Kizuna</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(subject)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#020617;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#475569">If the button doesn't work, paste this link into your browser:<br><a href="${url}" style="color:#1d4ed8;word-break:break-all">${url}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#475569">${escapeHtml(note)}</p>
</div>
</body>
</html>`;
}

function renderText({ intro, action, note }: Email): string {
	return `${intro}\n\n${action.label}: ${action.url}\n\n${note}\n\nKizuna`;
}

/**
 * Sends email through Resend's REST API. Without `RESEND_API_KEY` nothing is sent: when the app
 * runs on a loopback address each email is printed instead, since its link opens nowhere but this
 * machine. Anywhere else the email is dropped with an error that keeps the link (and its token)
 * out of the logs.
 */
export function createEmailSender(
	env: Pick<Env, 'RESEND_API_KEY' | 'EMAIL_FROM' | 'BETTER_AUTH_URL'>
): SendEmail {
	const local = LOOPBACK_HOSTS.has(URL.parse(env.BETTER_AUTH_URL)?.hostname ?? '');

	return async (email) => {
		if (!env.RESEND_API_KEY) {
			if (local) {
				console.info(
					`[email] Not sent (no RESEND_API_KEY)\n  To: ${email.to}\n  Subject: ${email.subject}\n  ${email.action.label}: ${email.action.url}`
				);
			} else {
				console.error(`[email] RESEND_API_KEY is not set; dropped "${email.subject}"`);
			}
			return;
		}
		try {
			const res = await fetch(RESEND_ENDPOINT, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.RESEND_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: env.EMAIL_FROM,
					to: email.to,
					subject: email.subject,
					html: renderHtml(email),
					text: renderText(email)
				})
			});
			if (!res.ok) {
				// Resend's error `name` (e.g. `validation_error`); its message may echo addresses.
				const body = (await res.json().catch(() => null)) as { name?: unknown } | null;
				console.error(
					`[email] Resend rejected "${email.subject}": ${res.status} ${String(body?.name ?? '')}`.trimEnd()
				);
			}
		} catch (err) {
			console.error(`[email] Could not reach Resend for "${email.subject}":`, err);
		}
	};
}
