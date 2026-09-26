<script lang="ts">
	import SidebarNav from '$lib/components/shared/SidebarNav.svelte';
	import StoriesBar from '$lib/components/feed/StoriesBar.svelte';
	import CreatePostBox from '$lib/components/feed/CreatePostBox.svelte';
	import PostCard from '$lib/components/feed/PostCard.svelte';
	import RightSidebar from '$lib/components/feed/RightSidebar.svelte';
	import type { PostData } from '$lib/components/feed/PostCard.svelte';

	let posts = $state<PostData[]>([
		{
			id: 'post-1',
			author: {
				name: 'Elena Rostova',
				handle: '@elena.rostova',
				avatar:
					'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
				location: 'Copenhagen, Denmark',
				timeAgo: '3h ago'
			},
			title: 'Quiet Brutalism: Concrete Light & Shadows',
			description:
				'A study on natural dawn illumination casting geometric shadows across raw exposed concrete in the central atrium. Shot on 35mm f/1.4. The spatial tension transforms throughout the winter solstice.',
			image:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
			cameraMeta: '35mm · ISO 200',
			tags: ['#MinimalArchitecture', '#LightAndSpace', '#DesignArchive'],
			likes: 842,
			commentsCount: 46,
			repostsCount: 12,
			commentPreview: {
				author: 'marcus_k',
				content: 'The texture gradation is immaculate. Concrete takes light like velvet here.'
			}
		},
		{
			id: 'post-2',
			author: {
				name: 'Kai Takahashi',
				handle: '@kai.raw',
				avatar:
					'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
				location: 'Kyoto, Japan',
				timeAgo: '5h ago'
			},
			title: 'Wabi-Sabi Clay & Stoneware Forms',
			description:
				'Hand-pinched Shigaraki stoneware fired in an anagama kiln over seven days. The ash melt creates an unrepeatable landscape of mineral hues and subtle texture.',
			image:
				'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
			cameraMeta: '50mm · ISO 400',
			tags: ['#KyotoCeramics', '#WabiSabi', '#JapaneseCraft'],
			likes: 618,
			commentsCount: 29,
			repostsCount: 8,
			commentPreview: {
				author: 'sophia_v',
				content: 'The natural wood ash glaze turned out breathtaking.'
			}
		}
	]);

	function handlePublish(content: string, type: 'photo' | 'story' | 'article') {
		const newPost: PostData = {
			id: `post-${Date.now()}`,
			author: {
				name: 'Julian Vance',
				handle: '@jvance',
				avatar:
					'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
				location: 'Tokyo, Japan',
				timeAgo: 'Just now'
			},
			title: type === 'article' ? 'Architectural Field Notes' : '',
			description: content,
			image:
				'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
			cameraMeta: '28mm · ISO 100',
			tags: ['#FieldNotes', '#DesignArchive'],
			likes: 0,
			commentsCount: 0,
			repostsCount: 0
		};
		posts = [newPost, ...posts];
	}
</script>

<svelte:head>
	<title>Kizuna — Journal & Visual Feed</title>
	<meta name="description" content="A curated visual space for photographers and minimalists." />
</svelte:head>

<!-- Hidden H1 for accessibility and test suites -->
<h1 class="sr-only">sns</h1>

<div
	class="max-w-7xl mx-auto px-2 sm:px-6 w-full flex justify-center md:justify-between gap-0 md:gap-6 xl:gap-8"
>
	<!-- Left Navigation Column (Desktop only) -->
	<SidebarNav class="hidden md:flex" />

	<!-- Center Main Feed Column (Full width on mobile, centered on desktop) -->
	<main class="flex-1 max-w-2xl min-w-0 py-4 sm:py-6 mx-auto w-full">
		<StoriesBar />
		<CreatePostBox onPublish={handlePublish} />
		<div class="feed-posts flex flex-col">
			{#each posts as post (post.id)}
				<PostCard {post} />
			{/each}
		</div>
	</main>

	<!-- Right Sidebar Column (Desktop only) -->
	<RightSidebar class="hidden lg:flex" />
</div>
