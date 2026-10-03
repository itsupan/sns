import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createEmailSender,
	emailChangeEmail,
	passwordResetEmail,
	verificationEmail
} from './email';

const LINK =
	'https://sns.ecoapsara.com/api/auth/reset-password/tok3n?callbackURL=%2Freset-password';
const KEY = 're_secret_key';
const env = {
	RESEND_API_KEY: KEY,
	EMAIL_FROM: 'Kizuna <no-reply@sns.ecoapsara.com>',
	BETTER_AUTH_URL: 'https://sns.ecoapsara.com'
} as Pick<Env, 'RESEND_API_KEY' | 'EMAIL_FROM' | 'BETTER_AUTH_URL'>;

function stubFetch(response: () => Response | Promise<Response>) {
	const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
		response()
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>) {
	return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, string>;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('createEmailSender', () => {
	it('posts the email to Resend with the API key', async () => {
		const fetchMock = stubFetch(() => Response.json({ id: 'email-1' }));

		await createEmailSender(env)(passwordResetEmail('ada@example.com', LINK));

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({
			Authorization: `Bearer ${KEY}`,
			'Content-Type': 'application/json'
		});
		const body = sentBody(fetchMock);
		expect(body).toMatchObject({
			from: env.EMAIL_FROM,
			to: 'ada@example.com',
			subject: 'Reset your Kizuna password'
		});
		expect(body.text).toContain(`Reset password: ${LINK}`);
		expect(body.html).toContain('<html lang="en">');
		expect(body.html).toContain(`href="${LINK.replaceAll('&', '&amp;')}"`);
	});

	it('escapes what it puts into the HTML', async () => {
		const fetchMock = stubFetch(() => Response.json({ id: 'email-1' }));

		await createEmailSender(env)(
			emailChangeEmail('ada@example.com', '"><script>x</script>@example.com', `${LINK}&a="b"`)
		);

		const { html, text } = sentBody(fetchMock);
		expect(html).not.toContain('<script>');
		expect(html).toContain('&quot;&gt;&lt;script&gt;x&lt;/script&gt;@example.com');
		expect(html).toContain('&amp;a=&quot;b&quot;');
		expect(text).toContain('"><script>x</script>@example.com');
	});

	it('logs a rejected send with its status, but not the key, the link or the address', async () => {
		stubFetch(() =>
			Response.json(
				{ name: 'validation_error', message: 'Invalid `to` field: ada@example.com' },
				{ status: 422 }
			)
		);
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			createEmailSender(env)(verificationEmail('ada@example.com', LINK))
		).resolves.toBeUndefined();

		expect(error).toHaveBeenCalledOnce();
		const logged = String(error.mock.calls[0][0]);
		expect(logged).toContain('422');
		expect(logged).toContain('validation_error');
		for (const secret of [KEY, LINK, 'tok3n', 'ada@example.com']) {
			expect(logged).not.toContain(secret);
		}
	});

	it('logs when Resend cannot be reached and still resolves', async () => {
		stubFetch(() => Promise.reject(new TypeError('fetch failed')));
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			createEmailSender(env)(verificationEmail('ada@example.com', LINK))
		).resolves.toBeUndefined();
		expect(String(error.mock.calls[0][0])).toContain('Could not reach Resend');
	});

	it('prints the email instead of sending it on a local run without a key', async () => {
		const fetchMock = stubFetch(() => Response.json({}));
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});

		await createEmailSender({
			...env,
			RESEND_API_KEY: '',
			BETTER_AUTH_URL: 'http://localhost:5173'
		})(verificationEmail('ada@example.com', LINK));

		expect(fetchMock).not.toHaveBeenCalled();
		const printed = String(info.mock.calls[0][0]);
		expect(printed).toContain('ada@example.com');
		expect(printed).toContain('Verify your email for Kizuna');
		expect(printed).toContain(LINK);
	});

	it('drops the email with an error that leaves out the link when deployed without a key', async () => {
		const fetchMock = stubFetch(() => Response.json({}));
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});

		await createEmailSender({ ...env, RESEND_API_KEY: '' })(
			passwordResetEmail('ada@example.com', LINK)
		);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(info).not.toHaveBeenCalled();
		const logged = String(error.mock.calls[0][0]);
		expect(logged).toContain('RESEND_API_KEY is not set');
		expect(logged).not.toContain('tok3n');
		expect(logged).not.toContain('ada@example.com');
	});
});
