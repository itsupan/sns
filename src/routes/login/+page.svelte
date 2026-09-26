<script lang="ts">
	import AuthCard from '$lib/components/auth/AuthCard.svelte';
</script>

<svelte:head>
	<title>Log In — Kizuna</title>
	<meta
		name="description"
		content="Log in to Kizuna, a curated visual space for photographers and minimalists."
	/>
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthCard mode="login" />
	</div>
</main>
