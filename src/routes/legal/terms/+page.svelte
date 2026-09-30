<script lang="ts">
	import { resolve } from '$app/paths';
	import { CONTACT_EMAIL, MIN_AGE, OPERATOR_NAME } from '$lib/constants/legal';
</script>

<svelte:head><title>Terms of Service · Kizuna</title></svelte:head>

<h1>Terms of Service</h1>
<p class="lede">
	These terms are an agreement between you and {OPERATOR_NAME} about using Kizuna. By creating an account
	or using the service, you accept them.
</p>

<h2>1. Who can use Kizuna</h2>
<p>
	You must be at least {MIN_AGE} years old, and old enough to agree to these terms where you live. If
	you are under the age of majority, your parent or guardian must agree to them for you. You may not use
	Kizuna if we have previously removed your account.
</p>

<h2>2. Your account</h2>
<ul>
	<li>Give accurate information and keep your password secret.</li>
	<li>You are responsible for what happens under your account.</li>
	<li>Handles must not impersonate other people or brands.</li>
	<li>
		You can delete your account at any time in <strong>Settings</strong>.
	</li>
</ul>

<h2>3. Your content</h2>
<p>
	You own the photos, text and messages you post. To run the service, you give us a worldwide,
	non-exclusive, royalty-free licence to host, store, copy, resize and display your content to the
	people you share it with. This licence ends when you delete the content or your account, except
	for copies other people already shared or that we must keep by law.
</p>
<p>
	Only post content you have the right to share. Do not upload someone else's photos without
	permission.
</p>

<h2>4. Acceptable use</h2>
<p>
	Follow the <a href={resolve('/legal/guidelines')}>Community Guidelines</a>. In particular, do not:
</p>
<ul>
	<li>break the law or help others to break it;</li>
	<li>harass, threaten or bully people, or post hate speech;</li>
	<li>post sexual content involving minors, non-consensual intimate images or graphic violence;</li>
	<li>spam, scrape, automate accounts or interfere with the service or its security;</li>
	<li>infringe copyright, trademarks or other rights.</li>
</ul>

<h2>5. Moderation</h2>
<p>
	You can report posts, comments, messages and accounts. We may remove content or restrict or close
	accounts that break these terms. Where we can, we will tell you why. If you think we made a
	mistake, email <span class="font-medium">{CONTACT_EMAIL}</span>.
</p>

<h2>6. Copyright complaints</h2>
<p>
	If you believe content on Kizuna infringes your copyright, send the details (the work, the URL of
	the content, and your contact details) to <span class="font-medium">{CONTACT_EMAIL}</span>.
</p>

<h2>7. The service</h2>
<p>
	Kizuna is provided "as is". We work to keep it available and secure, but we cannot promise it will
	always be error free or uninterrupted. We may change or stop features. To the extent the law
	allows, {OPERATOR_NAME} is not liable for indirect or consequential losses. Nothing in these terms limits
	rights you have under consumer law.
</p>

<h2>8. Changes</h2>
<p>
	If we change these terms in a meaningful way, we will tell you in the app before the changes take
	effect. If you keep using Kizuna afterwards, you accept the new terms.
</p>

<h2>9. Contact</h2>
<p>Questions about these terms: <span class="font-medium">{CONTACT_EMAIL}</span>.</p>
