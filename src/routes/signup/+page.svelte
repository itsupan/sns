<script lang="ts">
	import AuthCard from '$lib/components/auth/AuthCard.svelte';
</script>

<svelte:head>
	<title>Sign Up — Kizuna</title>
	<meta
		name="description"
		content="Create your Kizuna account, a curated visual space for photographers and minimalists."
	/>
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center p-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthCard mode="signup" />
	</div>
</main>
