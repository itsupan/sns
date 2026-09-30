<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Cookie Policy · Kizuna</title></svelte:head>

<h1>Cookie Policy</h1>
<p class="lede">
	Kizuna uses only what it needs to work. There are no advertising cookies, no analytics and no
	third-party trackers.
</p>

<h2>What we store on your device</h2>
<div class="table-wrap">
	<table>
		<thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead>
		<tbody>
			<tr
				><td><code>better-auth.session_token</code></td><td>Cookie, essential</td><td
					>Keeps you signed in and protects your account</td
				><td>Until you sign out or the session expires</td></tr
			>
			<tr
				><td><code>better-auth.dont_remember</code></td><td>Cookie, essential</td><td
					>Set only when you untick "Remember me", so the session ends with the browser</td
				><td>Browser session</td></tr
			>
			<tr
				><td><code>better-auth.state</code></td><td>Cookie, essential</td><td
					>Only during "Continue with Google", to finish the sign-in securely</td
				><td>A few minutes</td></tr
			>
			<tr
				><td><code>kizuna-theme</code></td><td>Local storage, preference</td><td
					>Remembers light, dark or system theme</td
				><td>Until you clear it</td></tr
			>
			<tr
				><td><code>kizuna-cookie-notice</code></td><td>Local storage, preference</td><td
					>Remembers that you closed the cookie notice</td
				><td>Until you clear it</td></tr
			>
		</tbody>
	</table>
</div>

<p>
	On secure connections, cookie names start with <code>__Secure-</code>.
</p>

<h2>Why there is no consent popup</h2>
<p>
	Privacy laws such as the ePrivacy Directive allow storage that is strictly necessary for a service
	you asked for, like staying signed in, without consent. The preference items only store choices
	you made. If we ever add optional cookies, we will ask first.
</p>

<h2>Controlling cookies</h2>
<p>
	You can block or delete cookies in your browser settings. If you block the session cookie, you
	will not be able to sign in.
</p>

<p>
	For more about how we handle data, see the <a href={resolve('/legal/privacy')}>Privacy Policy</a>.
</p>
