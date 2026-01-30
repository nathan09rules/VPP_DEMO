<script>
	import favicon from "$lib/assets/favicon.png";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Virtual Power Plant</title>
</svelte:head>

{@render children()}
