<script lang="ts">
	import { resolve } from '$app/paths';
	import { CONTACT_EMAIL, MIN_AGE, OPERATOR_NAME } from '$lib/constants/legal';
</script>

<svelte:head><title>Privacy Policy · Kizuna</title></svelte:head>

<h1>Privacy Policy</h1>
<p class="lede">
	This policy explains what {OPERATOR_NAME} collects when you use Kizuna, why, and the choices you have.
	We do not sell your data and we do not show ads.
</p>

<h2>What we collect</h2>
<div class="table-wrap">
	<table>
		<thead><tr><th>Data</th><th>Why</th></tr></thead>
		<tbody>
			<tr
				><td>Account: name, email, password (stored hashed), Google sign-in ID</td><td
					>To create your account and sign you in</td
				></tr
			>
			<tr
				><td>Profile: handle, photo, bio, title, website, location, camera gear</td><td
					>To show your public profile</td
				></tr
			>
			<tr
				><td>Posts, photos, stories, captions, tags, location and camera details you add</td><td
					>To publish what you share</td
				></tr
			>
			<tr
				><td>Comments, likes, saves, follows and shares</td><td
					>To run the feed and your activity</td
				></tr
			>
			<tr
				><td>Direct messages</td><td
					>To deliver them to the people in the conversation. Staff do not read them unless they are
					reported or the law requires it</td
				></tr
			>
			<tr><td>Notifications</td><td>To tell you about activity on your posts</td></tr>
			<tr
				><td>Sessions: IP address, browser and device type, sign-in time</td><td
					>To keep you signed in, secure accounts and prevent abuse</td
				></tr
			>
			<tr><td>Reports and blocks you make</td><td>To keep the community safe</td></tr>
		</tbody>
	</table>
</div>

<h2>Who can see it</h2>
<ul>
	<li>
		Your profile, posts, comments and follows are public. Anyone, including people who are not
		signed in, can see them.
	</li>
	<li>Messages are visible only to the members of the conversation.</li>
	<li>Your email address and sessions are private.</li>
</ul>

<h2>Service providers</h2>
<p>We share data only with the providers that run the service for us:</p>
<ul>
	<li>
		<strong>Cloudflare</strong>: hosting, database (D1), photo storage (R2), caching and rate limits
		(KV), and real-time chat.
	</li>
	<li><strong>Google</strong>: only if you choose "Continue with Google".</li>
</ul>
<p>
	We may also disclose data when the law requires it, or to protect people from harm. Your data may
	be processed outside your country. Where it is, our providers use appropriate safeguards.
</p>

<h2>How long we keep it</h2>
<ul>
	<li>Your account and content stay until you delete them or your account.</li>
	<li>Sessions end when you sign out, or expire after a period of inactivity.</li>
	<li>
		When you delete your account, we remove your profile, posts, photos, comments, likes, follows
		and messages. Backups are overwritten within 30 days.
	</li>
	<li>We may keep reports and records we must retain by law for longer.</li>
</ul>

<h2>Your rights</h2>
<p>
	Depending on where you live (for example, under the GDPR in the EU and UK, or the CCPA in
	California), you have the right to access, correct, download, delete or restrict the use of your
	data, and to object to how we use it.
</p>
<ul>
	<li>Edit your profile at any time.</li>
	<li>
		<strong>Download your data</strong> or <strong>delete your account</strong> in
		<strong>Settings</strong>.
	</li>
	<li>
		For anything else, email <span class="font-medium">{CONTACT_EMAIL}</span>. You can also complain
		to your local data protection authority.
	</li>
</ul>
<p>
	Our legal bases are: performing our contract with you (running your account), our legitimate
	interests (security and preventing abuse), and meeting legal obligations.
</p>

<h2>Children</h2>
<p>
	Kizuna is not for children under {MIN_AGE}. If we learn that a child under {MIN_AGE} has an account,
	we delete it. Parents can contact us at <span class="font-medium">{CONTACT_EMAIL}</span>.
</p>

<h2>Cookies</h2>
<p>
	We use only essential cookies. See the <a href={resolve('/legal/cookies')}>Cookie Policy</a>.
</p>

<h2>Changes and contact</h2>
<p>
	If we make meaningful changes, we will tell you in the app. Questions: <span class="font-medium"
		>{CONTACT_EMAIL}</span
	>.
</p>
