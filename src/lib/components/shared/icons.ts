import type { LucideIcon } from '@lucide/svelte';
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import AtSign from '@lucide/svelte/icons/at-sign';
import BadgeCheck from '@lucide/svelte/icons/badge-check';
import Ban from '@lucide/svelte/icons/ban';
import Bell from '@lucide/svelte/icons/bell';
import Bookmark from '@lucide/svelte/icons/bookmark';
import Camera from '@lucide/svelte/icons/camera';
import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Circle from '@lucide/svelte/icons/circle';
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import CircleX from '@lucide/svelte/icons/circle-x';
import Compass from '@lucide/svelte/icons/compass';
import Copy from '@lucide/svelte/icons/copy';
import Crop from '@lucide/svelte/icons/crop';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import Eye from '@lucide/svelte/icons/eye';
import EyeOff from '@lucide/svelte/icons/eye-off';
import FileText from '@lucide/svelte/icons/file-text';
import Flag from '@lucide/svelte/icons/flag';
import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
import Hash from '@lucide/svelte/icons/hash';
import Heart from '@lucide/svelte/icons/heart';
import House from '@lucide/svelte/icons/house';
import Image from '@lucide/svelte/icons/image';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import Link from '@lucide/svelte/icons/link';
import Lock from '@lucide/svelte/icons/lock';
import LogOut from '@lucide/svelte/icons/log-out';
import Mail from '@lucide/svelte/icons/mail';
import MapPin from '@lucide/svelte/icons/map-pin';
import Maximize from '@lucide/svelte/icons/maximize';
import Menu from '@lucide/svelte/icons/menu';
import MessageCircle from '@lucide/svelte/icons/message-circle';
import MessageSquareText from '@lucide/svelte/icons/message-square-text';
import Pause from '@lucide/svelte/icons/pause';
import Pencil from '@lucide/svelte/icons/pencil';
import Pin from '@lucide/svelte/icons/pin';
import PinOff from '@lucide/svelte/icons/pin-off';
import Play from '@lucide/svelte/icons/play';
import Plus from '@lucide/svelte/icons/plus';
import Repeat from '@lucide/svelte/icons/repeat';
import Reply from '@lucide/svelte/icons/reply';
import Search from '@lucide/svelte/icons/search';
import Send from '@lucide/svelte/icons/send';
import Settings from '@lucide/svelte/icons/settings';
import Share2 from '@lucide/svelte/icons/share-2';
import Smile from '@lucide/svelte/icons/smile';
import SquarePlay from '@lucide/svelte/icons/square-play';
import Sun from '@lucide/svelte/icons/sun';
import Trash2 from '@lucide/svelte/icons/trash-2';
import TrendingUp from '@lucide/svelte/icons/trending-up';
import Type from '@lucide/svelte/icons/type';
import Upload from '@lucide/svelte/icons/upload';
import User from '@lucide/svelte/icons/user';
import UserPlus from '@lucide/svelte/icons/user-plus';
import Volume2 from '@lucide/svelte/icons/volume-2';
import VolumeX from '@lucide/svelte/icons/volume-x';
import X from '@lucide/svelte/icons/x';

/**
 * Every icon the app draws, by the name `Icon` takes. Each glyph is its own import, so the
 * bundle carries only these and an unknown name fails type checking.
 */
export const ICONS = {
	'angle-down': ChevronDown,
	'angle-left': ChevronLeft,
	'angle-right': ChevronRight,
	apps: LayoutGrid,
	'arrow-left': ArrowLeft,
	'arrow-right': ArrowRight,
	'arrow-trend-up': TrendingUp,
	'arrows-repeat': Repeat,
	at: AtSign,
	'badge-check': BadgeCheck,
	ban: Ban,
	bell: Bell,
	bookmark: Bookmark,
	'border-all': Grid2x2,
	camera: Camera,
	check: Check,
	'check-circle': CircleCheck,
	circle: Circle,
	comment: MessageCircle,
	'comment-alt': MessageSquareText,
	'compass-alt': Compass,
	copy: Copy,
	crop: Crop,
	cross: X,
	'cross-circle': CircleX,
	document: FileText,
	envelope: Mail,
	exclamation: CircleAlert,
	expand: Maximize,
	eye: Eye,
	'eye-crossed': EyeOff,
	flag: Flag,
	hashtag: Hash,
	heart: Heart,
	home: House,
	link: Link,
	lock: Lock,
	'map-marker': MapPin,
	'menu-burger': Menu,
	'menu-dots': Ellipsis,
	'paper-plane': Send,
	pause: Pause,
	pencil: Pencil,
	picture: Image,
	pin: Pin,
	'pin-off': PinOff,
	play: Play,
	'play-alt': SquarePlay,
	plus: Plus,
	reply: Reply,
	search: Search,
	settings: Settings,
	share: Share2,
	'sign-out-alt': LogOut,
	smile: Smile,
	sun: Sun,
	text: Type,
	trash: Trash2,
	upload: Upload,
	user: User,
	'user-add': UserPlus,
	volume: Volume2,
	'volume-mute': VolumeX
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Filling these would cover their inner strokes and leave a solid disc, so solid draws them bolder. */
export const OUTLINE_ONLY: ReadonlySet<IconName> = new Set<IconName>([
	'at',
	'compass-alt',
	'smile'
]);
