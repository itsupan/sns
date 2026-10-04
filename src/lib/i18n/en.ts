import { pluralFor } from './plural';

const plural = pluralFor('en');

/** " and 3 others" after a name, or nothing when nobody else is counted. */
const andOthers = (others: number, shown: string) =>
	others > 0 ? plural(others, { one: ` and ${shown} other`, other: ` and ${shown} others` }) : '';

// Common
export const common_loading = () => 'Loading…';
export const common_try_again = () => 'Try again';
export const common_ok = () => 'OK';
export const common_tagline = () => 'A curated visual space for photographers and minimalists.';
export const common_logo_alt = () => 'Kizuna logo';
export const common_avatar_alt = () => 'User avatar';
export const common_and = () => 'and';
export const common_cancel = () => 'Cancel';
export const common_saving = () => 'Saving…';
export const common_unexpected_error = () => 'An unexpected error occurred.';
export const common_add = () => 'Add';
export const common_adding = () => 'Adding…';
export const common_remove = () => 'Remove';
export const common_removing = () => 'Removing…';
export const common_sending = () => 'Sending…';
export const common_delete = () => 'Delete';
export const common_copy = () => 'Copy';
export const common_done = () => 'Done';
export const common_something_wrong = () => 'Something went wrong. Please try again.';
export const common_close = () => 'Close';
export const common_user = () => 'User';
export const common_save = () => 'Save';
export const common_change = () => 'Change';
export const common_deleting = () => 'Deleting…';
export const common_upload_progress = (percent: number) => `Uploading ${percent}%`;
export const common_send = () => 'Send';
export const common_optional = () => '(optional)';
export const common_retry = () => 'Retry';
export const common_something_went_wrong = () => 'Something went wrong';

// Navigation
export const nav_home = () => 'Home';
export const nav_explore = () => 'Explore';
export const nav_create = () => 'Create';
export const nav_activity = () => 'Activity';
export const nav_saved = () => 'Saved';
export const nav_profile = () => 'Profile';
export const nav_loading_page = () => 'Loading page';
export const nav_mobile_label = () => 'Mobile Navigation';
export const nav_main_label = () => 'Main Navigation';
export const nav_create_post = () => 'Create post';
export const nav_new_badge = (count: number) => `, ${count} new`;
export const nav_curated_feed_active = () => 'Curated Feed Active';
export const nav_curated_feed = () => 'Curated Feed';
export const nav_preferences = () => 'Preferences';
export const nav_secondary_label = () => 'Secondary Sidebar';
export const nav_legal = () => 'Legal';
export const nav_search = () => 'Search';
export const nav_close_search = () => 'Close search';
export const nav_messages = () => 'Direct messages';
export const nav_messages_unread = (count: number) => `Direct messages, ${count} unread`;
export const nav_activity_new = (count: number) => `Activity, ${count} new`;

// Time and counts
export const time_just_now = () => 'Just now';
export const time_minutes_ago = (minutes: number) => `${minutes}m ago`;
export const time_hours_ago = (hours: number) => `${hours}h ago`;
export const time_days_ago = (days: number) => `${days}d ago`;
export const time_weeks_ago = (weeks: number) => `${weeks}w ago`;
export const duration_minutes = (minutes: number) =>
	plural(minutes, { one: `${minutes} minute`, other: `${minutes} minutes` });
export const duration_hours = (hours: number) =>
	plural(hours, { one: `${hours} hour`, other: `${hours} hours` });
export const duration_days = (days: number) =>
	plural(days, { one: `${days} day`, other: `${days} days` });
export const count_thousands = (value: string) => `${value}K`;
export const count_millions = (value: string) => `${value}M`;
export const count_billions = (value: string) => `${value}B`;

// Auth
export const auth_password_too_short = (min: number) =>
	`Password must be at least ${min} characters long.`;
export const auth_password_confirm = () => 'Please confirm your password.';
export const auth_password_mismatch = () => 'Passwords do not match.';
export const auth_show_field = (label: string) => `Show ${label.toLowerCase()}`;
export const auth_hide_field = (label: string) => `Hide ${label.toLowerCase()}`;
export const auth_google_failed = () => 'Google authentication failed';
export const auth_fill_required = () => 'Please fill in all required fields.';
export const auth_enter_name = () => 'Please enter your name.';
export const auth_confirm_age = (minAge: number) =>
	`Please confirm you're ${minAge} or older and agree to the Terms to continue.`;
export const auth_invalid_credentials = () => 'Invalid email or password. Please try again.';
export const auth_signed_in = () => 'Signed in successfully! Redirecting...';
export const auth_welcome_back = () => 'Signed in successfully! Welcome back.';
export const auth_signup_failed = () => 'Could not create account. Please try again.';
export const auth_account_created = () => 'Account created! Check your inbox to verify your email.';
export const auth_mode_label = () => 'Authentication Mode';
export const auth_log_in_tab = () => 'Log In';
export const auth_sign_up_tab = () => 'Sign Up';
export const auth_continue_google = () => 'Continue with Google';
export const auth_connecting_google = () => 'Connecting to Google...';
export const auth_divider_sign_in = () => 'OR SIGN IN WITH EMAIL';
export const auth_divider_sign_up = () => 'OR SIGN UP WITH EMAIL';
export const auth_full_name = () => 'Full name';
export const auth_name_placeholder = () => 'Elena Vance';
export const auth_email = () => 'Email address';
export const auth_email_placeholder = () => 'elena.vance@studio.com';
export const auth_password = () => 'Password';
export const auth_forgot_password = () => 'Forgot password?';
export const auth_confirm_password = () => 'Confirm password';
export const auth_remember_me = () => 'Remember me';
export const auth_agree_prefix = (minAge: number) => `I'm ${minAge} or older and agree to the`;
export const auth_sign_in = () => 'Sign In';
export const auth_create_account = () => 'Create Account';
export const auth_no_account = () => "Don't have an account?";
export const auth_sign_up_link = () => 'Sign up';
export const auth_have_account = () => 'Already have an account?';
export const auth_log_in_link = () => 'Log in';
export const auth_disclaimer_prefix = () => "By continuing, you agree to Kizuna's";
export const auth_captcha_failed = () =>
	'The security check could not load. Check your connection and reload the page.';
export const auth_log_in_title = () => 'Log In — Kizuna';
export const auth_log_in_description = () =>
	'Log in to Kizuna, a curated visual space for photographers and minimalists.';
export const auth_sign_up_title = () => 'Sign Up — Kizuna';
export const auth_sign_up_description = () =>
	'Create your Kizuna account, a curated visual space for photographers and minimalists.';
export const auth_enter_email = () => 'Please enter your email address.';
export const auth_reset_email_error = () => 'Could not send the email. Please try again.';
export const auth_forgot_title = () => 'Forgot Password — Kizuna';
export const auth_forgot_description = () => 'Reset the password for your Kizuna account.';
export const auth_forgot_subtitle = () =>
	"Forgot your password? Enter your email and we'll send you a link to reset it.";
export const auth_reset_link_sent = (email: string) =>
	`If an account exists for ${email}, we've sent it a link to reset the password.`;
export const auth_send_reset_link = () => 'Send reset link';
export const auth_back_to_log_in = () => 'Back to log in';
export const auth_reset_error = () => 'Could not reset your password. Please try again.';
export const auth_reset_done = () => 'Your password has been reset. Log in with your new password.';
export const auth_reset_title = () => 'Reset Password — Kizuna';
export const auth_reset_description = () => 'Choose a new password for your Kizuna account.';
export const auth_reset_subtitle = () => 'Choose a new password for your account.';
export const auth_reset_link_invalid = () => 'This reset link is invalid or has expired.';
export const auth_request_new_link = () => 'Request a new link';
export const auth_new_password = () => 'New password';
export const auth_reset_password = () => 'Reset password';
export const auth_2fa_enter_backup = () => 'Please enter one of your backup codes.';
export const auth_2fa_enter_code = () => 'Please enter the 6-digit code from your app.';
export const auth_2fa_expired = () => 'This sign-in has expired. Please log in again.';
export const auth_2fa_wrong_code = () => 'That code is not right. Please try again.';
export const auth_2fa_verify_error = () => 'Could not verify the code. Please try again.';
export const auth_2fa_title = () => 'Two-Factor Authentication — Kizuna';
export const auth_2fa_backup_subtitle = () =>
	'Enter one of the backup codes you saved when you turned on two-factor authentication.';
export const auth_2fa_code_subtitle = () => 'Enter the 6-digit code from your authenticator app.';
export const auth_2fa_backup_code = () => 'Backup code';
export const auth_2fa_code = () => 'Authentication code';
export const auth_2fa_trust_device = () => 'Trust this device for 30 days';
export const auth_2fa_verify = () => 'Verify';
export const auth_2fa_use_app = () => 'Use your authenticator app instead';
export const auth_2fa_use_backup = () => 'Use a backup code instead';

// Feed
export const feed_curators = () => 'Curators to Follow';
export const feed_explore_all = () => 'Explore all';
export const feed_curated_topics = () => 'Curated Topics';
export const feed_load_more_error = () => 'Could not load more posts';
export const feed_title = () => 'Kizuna — Journal & Visual Feed';
export const feed_heading = () => 'Kizuna home feed';
export const feed_load_failed = () => 'Could not load your feed';
export const feed_empty = () => 'No posts yet';
export const feed_empty_hint = () => 'Share the first one, or';
export const feed_find_people = () => 'find people on Explore';
export const feed_caught_up = () => "You're all caught up";
export const feed_caught_up_hint = () => "You've seen all recent posts from your feed.";

// Posts
export const post_liked_by_you = (others: number, shownOthers: string) =>
	`Liked by you${andOthers(others, shownOthers)}`;
export const post_liked_by = (name: string, others: number, shownOthers: string) =>
	`Liked by ${name}${andOthers(others, shownOthers)}`;
export const post_like_count = (count: number, shown: string) =>
	plural(count, { one: `${shown} like`, other: `${shown} likes` });
export const post_edit_error = () => 'Could not save your changes';
export const post_updated = () => 'Post updated';
export const post_edit = () => 'Edit post';
export const post_save_changes = () => 'Save changes';
export const post_quote_error = () => 'Could not publish your quote';
export const post_quote_published = () => 'Quote published';
export const post_quote = () => 'Quote post';
export const post_quoted_by = (name: string) => `Quoted post by ${name}`;
export const post_unavailable = () => 'This post is unavailable.';
export const post_by = (name: string) => `Post by ${name}`;
export const post_save_error = () => 'Could not update saved posts';
export const post_log_in_to_mute = () => 'Please log in to mute accounts';
export const post_log_in_to_report = () => 'Please log in to report posts';
export const post_log_in_to_save = () => 'Please log in to save posts';
export const post_saved = () => 'Saved to your collection';
export const post_unsaved = () => 'Removed from saved';
export const post_log_in_to_repost = () => 'Please log in to repost';
export const post_repost_error = () => 'Could not update your repost';
export const post_reposted = () => 'Reposted';
export const post_repost_removed = () => 'Repost removed';
export const post_link_copied = () => 'Link copied';
export const post_copy_link_error = () => 'Could not copy link';
export const post_delete_error = () => 'Could not delete this post';
export const post_deleted = () => 'Post deleted';
export const post_pin_error = () => 'Could not update pinned posts';
export const post_pinned = () => 'Pinned to your profile';
export const post_unpinned = () => 'Unpinned from your profile';
export const post_pinned_label = () => 'Pinned';
export const post_you_reposted = () => 'You reposted';
export const post_reposted_by_suffix = () => 'reposted';
export const post_view_profile = (name: string) => `View ${name}'s profile`;
export const post_options = () => 'Post options';
export const post_video_fallback = () => 'Video playback fallback';
export const post_video_unsupported = () => 'Video format not supported inline';
export const post_video_unsupported_hint = () =>
	'Your browser could not stream this video directly in the feed.';
export const post_open_video = () => 'Open video in new tab';
export const post_video_tag_unsupported = () => 'Your browser does not support the video tag.';
export const post_photo_alt = (name: string, slide: number) => `Photo by ${name} (Slide ${slide})`;
export const post_slide_of = (slide: number, total: number) => `Slide ${slide} of ${total}`;
export const post_previous_slide = () => 'Previous slide';
export const post_next_slide = () => 'Next slide';
export const post_slide_indicators = () => 'Slide indicators';
export const post_go_to_slide = (slide: number) => `Go to slide ${slide}`;
export const post_like = () => 'Like post';
export const post_repost = () => 'Repost';
export const post_remove_bookmark = () => 'Remove bookmark';
export const post_save_bookmark = () => 'Save bookmark';
export const post_share = () => 'Share post';
export const post_see_less = () => 'See less';
export const post_see_more = () => 'See more';
export const post_view_all_comments = (shownCount: string) => `View all ${shownCount}`;
export const post_unpin = () => 'Unpin';
export const post_pin = () => 'Pin to profile';
export const post_delete = () => 'Delete post';
export const post_remove_from_saved = () => 'Remove from saved';
export const post_share_action = () => 'Share';
export const post_copy_link = () => 'Copy link';
export const post_mute_author = (name: string) => `Mute ${name}`;
export const post_unmute_author = (name: string) => `Unmute ${name}`;
export const post_report = () => 'Report';
export const post_confirm_delete = () => 'Delete post?';
export const post_delete_hint = () =>
	"This removes the post from your profile and everyone's feed. You can't undo this.";
export const post_undo_repost = () => 'Undo repost';
export const post_quote_action = () => 'Quote';
export const post_page_title = (title: string, name: string) => `${title} — ${name} on Kizuna`;
export const post_page_title_untitled = (name: string) => `Post by ${name} on Kizuna`;
export const post_page_description = (name: string) =>
	`Curated visual observation by ${name} on Kizuna.`;
export const post_back_to_feed = () => 'Back to feed';
export const post_journal = () => 'Kizuna Journal';

// Composer
export const composer_format_label = () => 'Text formatting';
export const composer_format_bold = () => 'Bold (Ctrl+B)';
export const composer_format_italic = () => 'Italic (Ctrl+I)';
export const composer_format_underline = () => 'Underline (Ctrl+U)';
export const composer_format_list = () => 'Bulleted list';
export const composer_alt_text = () => 'Alt text';
export const composer_alt_text_for = (n: number) => `for image ${n}`;
export const composer_alt_text_placeholder = () =>
	"Describe this image for people who can't see it";
export const composer_text_preview = () => 'Your text appears here';
export const composer_background = () => 'Background';
export const composer_background_option = (name: string) => `${name} background`;
export const composer_publishing = () => 'Publishing…';
export const composer_publish = () => 'Publish';
export const composer_type_photo = () => 'Photo';
export const composer_type_story = () => 'Story';
export const composer_type_article = () => 'Article';
export const composer_type_text = () => 'Text';
export const composer_ratio_square = () => 'Square';
export const composer_ratio_gallery = () => 'Gallery';
export const composer_ratio_cinema = () => 'Cinema';
export const composer_media_limit = (max: number) =>
	`A post can have at most ${max} photos or videos`;
export const composer_photo_uploaded = () => 'Photo uploaded';
export const composer_video_uploaded = () => 'Video uploaded';
export const composer_upload_failed = () => 'Media upload failed';
export const composer_tag_limit = (max: number) => `A post can have at most ${max} tags`;
export const composer_post_type = () => 'Post type';
export const composer_plate_preview = () => 'Plate preview';
export const composer_remove_plate = () => 'Remove plate';
export const composer_plate_primary = (total: number) => `Primary · 1/${total}`;
export const composer_plate_position = (n: number, total: number) => `${n}/${total}`;
export const composer_add_plate = () => 'Add Plate';
export const composer_canvas_ratio = () => 'Canvas Ratio';
export const composer_article_title = () => 'Article title...';
export const composer_caption = () => 'Caption & Intent';
export const composer_content_placeholder = () =>
	'Share an architectural observation, exhibition note...';
export const composer_content_label = () => 'Post content';
export const composer_location_placeholder = () =>
	'Exhibition Space / Location (e.g. Fondazione Prada)';
export const composer_add_more_media = () => 'Add more stills';
export const composer_attach_media = () => 'Attach Stills / Media';
export const composer_tag_placeholder = () => '#tag (Enter)';
export const composer_people_to_tag = () => 'People to tag';
export const upload_presign_failed = (status: number) =>
	`Failed to get presigned upload URL (${status})`;
export const upload_invalid_type = (type: string, allowed: string) =>
	`Invalid file type "${type}". Allowed types: ${allowed}`;
export const upload_too_large = (maxMb: number) =>
	`File size exceeds maximum allowed limit of ${maxMb}MB`;
export const upload_failed = (status: number, statusText: string) =>
	`Direct R2 upload failed with status ${status}: ${statusText || 'Upload Error'}`;
export const upload_network_error = () => 'Network error during direct upload to Cloudflare R2';
export const upload_aborted = () => 'Upload was aborted';
export const composer_log_in_to_upload = () => 'Please log in to upload media';
export const composer_log_in_to_publish = () => 'Please log in to publish a post';
export const composer_publish_failed = () => 'Failed to publish post';
export const composer_published = () => 'Post published successfully';
export const composer_publish_error = () => 'Could not publish post';
export const composer_prompt = () => 'Share an observation…';
export const composer_add_photo = () => 'Add photo';
export const composer_region = () => 'Create Post';
export const composer_canvas = () => 'Canvas:';
export const composer_ratio_title = (ratio: string, name: string) =>
	`Aspect ratio ${ratio} (${name})`;
export const composer_plate_of = (n: number, total: number) => `Plate ${n} of ${total}`;
export const composer_clear_all = () => 'Clear all';
export const composer_active_plate = () => 'Active plate';
export const composer_plate_badge = (n: string, total: string) => `PLATE ${n} OF ${total}`;
export const composer_remove_media = () => 'Remove media';
export const composer_plate = (n: number) => `Plate ${n}`;
export const composer_add_another_plate = () => 'Add another plate';
export const composer_drop_media = () => 'Drop photos or videos to add as plates';
export const composer_location_example = () =>
	'Exhibition space or location (e.g. Fondazione Prada, Milano)';
export const composer_clear_location = () => 'Clear location';
export const composer_remove_tag = (tag: string) => `Remove tag ${tag}`;
export const composer_tag_input_placeholder = () => 'tag (Enter)';
export const composer_attach_title = () => 'Attach Photos or Videos';
export const composer_add_media = () => 'Add media';
export const composer_location_title = () => 'Add spatial location';
export const composer_add_location = () => 'Add location';
export const composer_add_tags = () => 'Add tags';
export const composer_studio_open = () => 'Open Studio Creation Suite';
export const composer_studio_mode = () => 'Studio mode';
export const composer_studio = () => 'Studio Creation Suite';
export const composer_studio_subtitle = () => 'Curatorial Composition';
export const composer_publish_entry = () => 'Publish Entry';
export const composer_frame_standard = () => 'Frame Standard';
export const composer_active_exhibition_plate = () => 'Active exhibition plate';
export const composer_no_media = () => 'No media attached';
export const composer_select_media = () => 'Select Media Plates';
export const composer_sequence = (count: number) => `Exhibition Sequence (${count} Plates)`;
export const composer_sequence_hint = () => 'Click plate to inspect';
export const composer_add_plate_title = () => 'Add plate';
export const composer_exhibition_title = () => 'EXHIBITION TITLE';
export const composer_exhibition_title_placeholder = () =>
	'Monoliths of Silence: Structural Brutalism...';
export const composer_narrative = () => 'CURATORIAL NARRATIVE';
export const composer_narrative_placeholder = () =>
	'Examining the monolithic concrete structures erected across during the late twentieth century...';
export const composer_spatial_location = () => 'SPATIAL LOCATION / GALLERY CONTEXT';
export const composer_gallery_placeholder = () => 'Fondazione Prada, Milano';
export const composer_descriptors = () => 'CURATED DESCRIPTORS & TAGS';
export const composer_add_tag_placeholder = () => '#add-tag and press Enter';
export const composer_add_tag = () => '+ Add';

// Polls
export const poll_vote_count = (count: number, shown: string) =>
	plural(count, { one: `${shown} vote`, other: `${shown} votes` });
export const poll_summary_final = (votes: string) => `${votes} · Final results`;
export const poll_summary_open = (votes: string, left: string) => `${votes} · ${left} left`;
export const poll_left_minutes = (minutes: number) => `${minutes}m`;
export const poll_left_hours = (hours: number) => `${hours}h`;
export const poll_left_days = (days: number) => `${days}d`;
export const poll_log_in_to_vote = () => 'Please log in to vote';
export const poll_vote_error = () => 'Could not record your vote';
export const poll_results = () => 'Poll results';
export const poll_your_vote = () => '(your vote)';
export const poll_options = () => 'Poll options';
export const poll_vote_for = (option: string) => `Vote for ${option}`;
export const poll_label = () => 'Poll';
export const poll_option = (n: number) => `Option ${n}`;
export const poll_remove_option = (n: number) => `Remove option ${n}`;
export const poll_add_option = () => 'Add option';
export const poll_length = () => 'Poll length';
export const poll_remove = () => 'Remove poll';
export const poll_add = () => 'Add poll';

// Drafts
export const draft_scheduled_for = (when: string) => `Scheduled for ${when}`;
export const draft_saved = () => 'Draft saved';
export const draft_save_error = () => 'Could not save the draft';
export const draft_drafts = () => 'Drafts';
export const draft_save = () => 'Save draft';
export const draft_schedule = () => 'Schedule';
export const draft_publish_at = () => 'Publish at';
export const draft_scheduling = () => 'Scheduling…';
export const draft_schedule_post = () => 'Schedule post';
export const draft_scheduled_notice = (when: string) =>
	`Scheduled for ${when}. Saving it as a draft unschedules it.`;
export const draft_open_error = () => 'Could not open the draft';
export const draft_log_in = () => 'Please log in to save a draft';
export const draft_published = () => 'Post published';
export const draft_deleted = () => 'Draft deleted';
export const draft_page_title = () => 'Drafts · Kizuna';
export const draft_page_hint = () =>
	'Only you can see your drafts. Scheduled ones publish on their own.';
export const draft_empty = () => 'No drafts yet';
export const draft_empty_hint = () =>
	'Use "Save draft" or "Schedule" in the composer to keep a post for later.';
export const draft_edited = (when: string) => `Edited ${when}`;
export const draft_publish_failed = (error: string) => `Could not publish: ${error}`;
export const draft_edit = () => 'Edit';
export const draft_publish_now = () => 'Publish now';
export const draft_confirm_delete = () => 'Delete draft?';
export const draft_delete_hint = () =>
	"This deletes the draft and the photos and videos uploaded for it. You can't undo this.";

// Comments
export const comment_reaction_like = () => 'Like';
export const comment_reaction_love = () => 'Love';
export const comment_reaction_haha = () => 'Haha';
export const comment_reaction_wow = () => 'Wow';
export const comment_reaction_sad = () => 'Sad';
export const comment_reaction_fire = () => 'Fire';
export const comment_load_error = () => 'Could not load comments';
export const comment_replies_load_error = () => 'Could not load replies';
export const comment_log_in = () => 'Please log in to add comments';
export const comment_post_failed = () => 'Failed to post comment';
export const comment_reply_posted = () => 'Reply posted';
export const comment_posted = () => 'Comment posted';
export const comment_post_error = () => 'Could not post comment';
export const comment_log_in_to_react = () => 'Please log in to react to comments';
export const comment_reaction_error = () => 'Could not save your reaction';
export const comment_delete_error = () => 'Could not delete the comment';
export const comment_deleted = () => 'Comment deleted';
export const comment_post_creator = () => 'Post Creator';
export const comment_author = () => 'Author';
export const comment_you = () => 'You';
export const comment_reaction_count = (reaction: string, count: number, mine: boolean) =>
	`${reaction}: ${count}${mine ? ', remove your reaction' : ''}`;
export const comment_reply = () => 'Reply';
export const comment_add_reaction = () => 'Add reaction';
export const comment_react = () => 'React';
export const comment_tap_to_delete = () => 'Tap again to delete';
export const comment_pick_reaction = () => 'Pick a reaction';
export const comment_comments = () => 'Comments';
export const comment_title = (total: number) => `Comments (${total})`;
export const comment_close = () => 'Close comments';
export const comment_loading = () => 'Loading comments…';
export const comment_none = () => 'No comments yet';
export const comment_be_first = () => 'Be the first to share your thoughts.';
export const comment_loading_replies = () => 'Loading replies…';
export const comment_view_more_replies = (count: number) =>
	plural(count, { one: `View ${count} more reply`, other: `View ${count} more replies` });
export const comment_view_replies = (count: number) =>
	plural(count, { one: `View ${count} reply`, other: `View ${count} replies` });
export const comment_hide_replies = () => 'Hide replies';
export const comment_load_more = () => 'Load more comments';
export const comment_replying_to = () => 'Replying to';
export const comment_cancel_reply = () => 'Cancel reply';
export const comment_reply_placeholder = (handle: string) => `Reply to ${handle}...`;
export const comment_add_placeholder = () => 'Add a comment...';
export const comment_add_label = () => 'Add a comment';
export const comment_posting = () => 'Posting…';
export const comment_post = () => 'Post';

// Sharing
export const share_via = () => 'Share via';
export const share_profile = () => 'Share Profile';
export const share_profile_text = (name: string) => `Check out ${name} on Kizuna`;
export const share_profile_text_with_handle = (name: string, handle: string) =>
	`Check out ${name} (@${handle}) on Kizuna`;
export const share_profile_title = (name: string) => `${name} on Kizuna`;
export const share_profile_copied = () => 'Profile link copied to clipboard';
export const share_copy_failed = () => 'Could not copy link to clipboard';
export const share_profile_link = () => 'Profile Link';
export const share_profile_url = () => 'Profile URL';
export const share_copied = () => 'Copied!';
export const share_more_options = () => 'More options...';
export const share_post = () => 'Share Post';
export const share_post_text = (title: string) => `${title} on Kizuna`;
export const share_post_text_with_excerpt = (title: string, excerpt: string) =>
	`${title} — "${excerpt}" on Kizuna`;
export const share_post_copied = () => 'Post link copied to clipboard!';
export const share_copy_link_failed = () => 'Failed to copy link';
export const share_close = () => 'Close share dialog';
export const share_or_copy_link = () => 'Or copy link';
export const share_post_url = () => 'Post URL';
export const share_more_share_options = () => 'More share options';

// Reports
export const report_target_post = () => 'post';
export const report_target_comment = () => 'comment';
export const report_target_user = () => 'account';
export const report_target_message = () => 'message';
export const report_reason_spam = () => 'Spam';
export const report_reason_harassment = () => 'Harassment or bullying';
export const report_reason_hate = () => 'Hate speech or symbols';
export const report_reason_nudity = () => 'Nudity or sexual content';
export const report_reason_violence = () => 'Violence or dangerous content';
export const report_reason_self_harm = () => 'Self-harm or suicide';
export const report_reason_copyright = () => 'Intellectual property violation';
export const report_reason_impersonation = () => 'Impersonation';
export const report_reason_other = () => 'Something else';
export const report_title = (target: string) => `Report ${target}`;
export const report_why = (target: string) => `Why are you reporting this ${target}?`;
export const report_details = () => 'Details';
export const report_details_placeholder = () => 'Add anything that helps us understand the problem';
export const report_error = () => 'Could not send the report';
export const report_sent = () => 'Thanks for reporting. Our team will review it.';
export const report_submit = () => 'Submit';
export const report_log_in = () => 'Please log in to report accounts';

// Stories
export const story_log_in = () => 'Please log in to share a story';
export const story_view_yours = () => 'View your story';
export const story_yours = () => 'Your story';
export const story_add_to_yours = () => 'Add to your story';
export const story_add_yours = () => 'Add your story';
export const story_view_from = (name: string, unseen: boolean, closeFriends: boolean) =>
	`View story from ${name}${unseen ? ', new' : ''}${closeFriends ? ', close friends' : ''}`;
export const story_load_error = () => 'Could not load stories';
export const story_choose_media = () => 'Choose a photo or video';
export const story_upload_failed = () => 'Upload failed';
export const story_share_error = () => 'Could not share your story';
export const story_shared_close_friends = () =>
	'Story shared with close friends · visible for 24 hours';
export const story_shared = () => 'Story shared · visible for 24 hours';
export const story_new = () => 'New story';
export const story_change_media = () => 'Change story media';
export const story_preview = () => 'Story preview';
export const story_caption = () => 'Caption';
export const story_caption_placeholder = () => 'Say something about this moment…';
export const story_caption_label = () => 'Story caption';
export const story_location_placeholder = () => 'Location (optional)';
export const story_location_label = () => 'Story location';
export const story_close_friends = () => 'Close friends';
export const story_close_friends_hint = () =>
	'Only people on your close friends list will see this story.';
export const story_sharing = () => 'Sharing…';
export const story_share = () => 'Share to story';
export const story_delete_error = () => 'Could not delete this story';
export const story_deleted = () => 'Story deleted';
export const story_viewers_error = () => 'Could not load viewers';
export const story_reaction_error = () => 'Could not send your reaction';
export const story_reply_error = () => 'Could not send your reply';
export const story_reply_sent = () => 'Reply sent';
export const story_from = (name: string) => `Stories from ${name}`;
export const story_alt = (name: string) => `Story from ${name}`;
export const story_previous = () => 'Previous story';
export const story_next = () => 'Next story';
export const story_mute = () => 'Mute';
export const story_unmute = () => 'Unmute';
export const story_play = () => 'Play';
export const story_pause = () => 'Pause';
export const story_delete = () => 'Delete story';
export const story_close = () => 'Close stories';
export const story_view_count = (count: number) =>
	plural(count, { one: `${count} view`, other: `${count} views` });
export const story_view_count_label = (count: number) =>
	`${story_view_count(count)}, see who viewed`;
export const story_react_label = () => 'React';
export const story_react = (emoji: string) => `React ${emoji}`;
export const story_reply_placeholder = (name: string) => `Reply to ${name}…`;
export const story_reply_label = (name: string) => `Reply to ${name}`;
export const story_viewers_title = () => 'Story viewers';
export const story_viewers = () => 'Viewers';
export const story_viewer_count = (count: number) =>
	plural(count, { one: `${count} viewer`, other: `${count} viewers` });
export const story_no_viewers = () => 'No one has viewed this story yet.';
export const story_reacted = (emoji: string) => `Reacted ${emoji}`;
export const story_confirm_delete = () => 'Delete this story?';
export const story_delete_hint = () => 'It will disappear for everyone right away.';
export const story_archive_load_error = () => 'Could not load your archive';
export const story_archive_title = () => 'Archive · Kizuna';
export const story_archive_hint = () =>
	'Only you can see your archive. Every story you share stays here after its 24 hours.';
export const story_archive_empty = () => 'No stories yet';
export const story_archive_empty_hint = () =>
	'Stories you share appear here, ready to add to a highlight.';
export const story_archived = (date: string, closeFriends: boolean) =>
	`Story from ${date}${closeFriends ? ', close friends' : ''}`;
export const story_add_to_highlight = (date: string) => `Add story from ${date} to a highlight`;

// Highlights
export const highlight_load_error = () => 'Could not load your highlights';
export const highlight_update_error = () => 'Could not update your highlights';
export const highlight_added_to = (title: string) => `Added to ${title}`;
export const highlight_removed_from = (title: string) => `Removed from ${title}`;
export const highlight_add_to = () => 'Add to highlight';
export const highlight_story_count = (count: number) =>
	plural(count, { one: `${count} story`, other: `${count} stories` });
export const highlight_none_yet = () =>
	'No highlights yet. Name one below to start it with this story.';
export const highlight_new_placeholder = () => 'New highlight';
export const highlight_new_title_label = () => 'New highlight title';
export const highlight_create = () => 'Create';
export const highlight_save_error = () => 'Could not save the highlight';
export const highlight_saved = () => 'Highlight saved';
export const highlight_edit = () => 'Edit highlight';
export const highlight_title = () => 'Title';
export const highlight_pick_cover = () => 'Stories · pick the cover';
export const highlight_cover_from = (date: string) => `Cover: story from ${date}`;
export const highlight_cover = () => 'Cover';
export const highlight_move_earlier = (date: string) => `Move story from ${date} earlier`;
export const highlight_move_later = (date: string) => `Move story from ${date} later`;
export const highlight_remove_story = (date: string) => `Remove story from ${date}`;
export const highlight_no_stories = () => 'No stories left. Add some from your archive.';
export const highlight_delete_error = () => 'Could not delete the highlight';
export const highlight_deleted = () => 'Highlight deleted';
export const highlight_nav = () => 'Highlights';
export const highlight_new_from_archive = () => 'New highlight from your archive';
export const highlight_new = () => 'New';
export const highlight_play = (title: string) => `Play highlight ${title}`;
export const highlight_empty = (title: string) => `${title}, empty`;
export const highlight_options = (title: string) => `Options for highlight ${title}`;
export const highlight_sheet_title = (title: string) => `Highlight ${title}`;
export const highlight_delete = () => 'Delete highlight';
export const highlight_confirm_delete = (title: string) => `Delete ${title}?`;
export const highlight_delete_hint = () =>
	'The highlight leaves your profile. Its stories stay in your archive.';

// Profile
export const block_block = () => 'Block';
export const block_unblock = () => 'Unblock';
export const block_blocking = () => 'Blocking…';
export const block_unblocking = () => 'Unblocking…';
export const block_confirm_block = (name: string) => `Block ${name}?`;
export const block_confirm_unblock = (name: string) => `Unblock ${name}?`;
export const block_block_hint = () =>
	"You won't see each other's posts or comments, and they can't follow or message you. Any follows between you are removed. They aren't told.";
export const block_unblock_hint = () =>
	'They will be able to see your posts, follow you and message you again.';
export const block_blocked = (name: string) => `Blocked ${name}`;
export const block_unblocked = (name: string) => `Unblocked ${name}`;
export const block_error = () => 'Could not update block';
export const profile_tab_grid = () => 'Curated Grid';
export const profile_tab_saved = () => 'Saved';
export const profile_view_grid = () => 'Grid layout';
export const profile_view_feed = () => 'Feed layout';
export const profile_view_compact = () => 'Compact layout';
export const profile_avatar_uploaded = () => 'Avatar uploaded successfully';
export const profile_avatar_upload_failed = () => 'Failed to upload image';
export const profile_avatar_upload_new = () => 'Upload new avatar';
export const profile_avatar_upload = () => 'Upload avatar';
export const profile_avatar_uploading = () => 'Uploading...';
export const profile_avatar_change = () => 'Change Photo';
export const profile_avatar_hint = () =>
	'JPG, PNG, WEBP or GIF up to 10MB. Uploads directly to Cloudflare R2 storage.';
export const profile_avatar_input = () => 'Avatar file input';
export const profile_no_posts = () => 'No posts yet';
export const profile_no_posts_own = () =>
	'When you share photos or architectural studies, they will appear here on your profile.';
export const profile_no_posts_other = (name: string) => `${name} hasn't shared any posts yet.`;
export const profile_this_user = () => 'This user';
export const profile_create_first = () => 'Create your first post';
export const profile_view_post = (title: string, pinned: boolean) =>
	`View ${pinned ? 'pinned ' : ''}post ${title}`;
export const profile_view = () => 'View';
export const profile_no_saved = () => 'No saved posts';
export const profile_no_saved_hint = () =>
	'Save posts to revisit them later in your private archive.';
export const profile_view_saved = (title: string) => `View saved post ${title}`;
export const profile_see_all_saved = () => 'See all saved posts';
export const profile_name_required = () => 'Name is required';
export const profile_name_too_long = () => 'Name cannot exceed 100 characters';
export const profile_handle_invalid = () =>
	'Handle can only contain letters, numbers, dots, and underscores (1-30 chars)';
export const profile_bio_too_long = () => 'Bio cannot exceed 500 characters';
export const profile_title_too_long = () => 'Title cannot exceed 100 characters';
export const profile_website_too_long = () => 'Website URL cannot exceed 255 characters';
export const profile_location_too_long = () => 'Location cannot exceed 100 characters';
export const profile_camera_too_long = () => 'Camera gear cannot exceed 200 characters';
export const profile_user_unknown = () =>
	'User ID could not be identified. Please make sure you are logged in.';
export const profile_update_failed = () => 'Failed to update profile';
export const profile_updated = () => 'Profile updated successfully';
export const profile_update_network_error = () => 'Network error updating profile';
export const profile_form_label = () => 'Profile settings form';
export const profile_edit_title = () => 'Edit Profile';
export const profile_edit_subtitle = () =>
	'Update your public profile, avatar, and personal details.';
export const profile_saved_banner = () => 'Profile updated successfully! All changes are saved.';
export const profile_display_name = () => 'Display Name';
export const profile_name_placeholder = () => 'e.g. Elena Rostova';
export const profile_handle_label = () => 'Username / Handle';
export const profile_handle_placeholder = () => 'elena.rostova';
export const profile_handle_hint = () => 'Your unique handle for mentions and profile links.';
export const profile_title_label = () => 'Title / Profession';
export const profile_title_placeholder = () => 'e.g. Architectural & Film Photographer';
export const profile_bio = () => 'Bio';
export const profile_bio_placeholder = () =>
	'Capturing silence, light, and brutalist geometries across Scandinavia & Japan...';
export const profile_website = () => 'Website';
export const profile_website_placeholder = () => 'elenarostova.com';
export const profile_location = () => 'Location';
export const profile_location_placeholder = () => 'Stockholm & Kyoto';
export const profile_camera = () => 'Camera Gear / Setup';
export const profile_camera_placeholder = () => 'Hasselblad 500C/M • Leica M11';
export const profile_save = () => 'Save Changes';
export const profile_photo_alt = () => 'Profile photo';
export const profile_change_avatar = () => 'Change avatar photo';
export const profile_stat_posts = () => 'posts';
export const profile_stat_followers = () => 'followers';
export const profile_stat_following = () => 'following';
export const profile_stat_impressions = () => 'impressions';
export const profile_add_bio = () => 'Add a bio to your profile...';
export const profile_settings = () => 'Settings';
export const profile_settings_menu = () => 'Settings menu';
export const profile_theme = () => 'Theme';
export const profile_archive = () => 'Archive';
export const profile_settings_privacy = () => 'Settings & privacy';
export const profile_message = () => 'Message';
export const profile_send_message = () => 'Send Message';
export const profile_share = () => 'Share profile';
export const profile_report = () => 'Report profile';
export const profile_mute = () => 'Mute profile';
export const profile_unmute = () => 'Unmute profile';
export const profile_page_title = (name: string, handle: string) => `${name} (${handle}) — Kizuna`;
export const profile_page_title_fallback = () => 'Profile — Kizuna';
export const profile_page_description = (name: string) => `${name}'s profile on Kizuna.`;
export const profile_edit_page_title = () => 'Edit Profile — Kizuna';
export const profile_edit_page_description = () => 'Edit your Kizuna profile, bio, and settings';
export const profile_back = () => 'Back to Profile';
export const profile_page_title_unknown = () => 'Curator Profile — Kizuna';
export const profile_page_description_other = (name: string) =>
	`${name}'s photography and curation profile on Kizuna.`;
export const profile_you_blocked = () => 'You blocked this user. Unblock them to see their posts.';
export const profile_unavailable = () => "This profile isn't available.";
export const profile_private = () => 'This account is private';
export const profile_private_hint = (name: string) => `Follow ${name} to see their posts.`;
export const profile_saved_load_error = () => 'Could not load saved posts';
export const profile_saved_title = () => 'Saved · Kizuna';
export const profile_saved_hint = () => "Only you can see what you've saved.";
export const profile_saved_empty = () => 'No saved posts yet';
export const profile_saved_empty_hint = () => 'Tap the bookmark on any post to keep it here.';

// Follows
export const follow_status_none = () => 'Follow';
export const follow_status_requested = () => 'Requested';
export const follow_status_following = () => 'Following';
export const follow_toast_unfollowed = (name: string) => `Unfollowed ${name}`;
export const follow_toast_requested = (name: string) => `Requested to follow ${name}`;
export const follow_toast_following = (name: string) => `Following ${name}`;
export const follow_action_follow = (name: string) => `Follow ${name}`;
export const follow_action_withdraw = (name: string) => `Withdraw follow request to ${name}`;
export const follow_action_unfollow = (name: string) => `Unfollow ${name}`;
export const follow_error = () => 'Could not update follow';
export const mute_error = () => 'Could not update mute';
export const follow_log_in = () => 'Please log in to follow curators';
export const mute_muted = (name: string) => `Muted ${name}`;
export const mute_unmuted = (name: string) => `Unmuted ${name}`;

// Activity
export const activity_two_actors = (first: string, second: string) => `${first} and ${second}`;
export const activity_actor_and_others = (first: string, others: number) =>
	plural(others, { one: `${first} and ${others} other`, other: `${first} and ${others} others` });
export const activity_verb_like = () => 'liked your post';
export const activity_verb_comment = () => 'commented on your post';
export const activity_verb_reply = () => 'replied to your comment';
export const activity_verb_reaction = () => 'reacted to your comment';
export const activity_verb_follow = () => 'started following you';
export const activity_verb_mention = () => 'tagged you in a post';
export const activity_verb_story_reaction = () => 'reacted to your story';
export const activity_verb_follow_request = () => 'asked to follow you';
export const activity_verb_follow_accepted = () => 'accepted your follow request';
export const activity_verb_repost = () => 'reposted your post';
export const activity_verb_quote = () => 'quoted your post';
export const activity_type_like = () => 'Likes on your posts';
export const activity_type_comment = () => 'Comments on your posts';
export const activity_type_reply = () => 'Replies to your comments';
export const activity_type_reaction = () => 'Reactions to your comments';
export const activity_type_follow = () => 'New followers';
export const activity_type_mention = () => 'Tags in posts';
export const activity_type_story_reaction = () => 'Reactions to your stories';
export const activity_type_follow_request = () => 'Follow requests';
export const activity_type_follow_accepted = () => 'Accepted follow requests';
export const activity_type_repost = () => 'Reposts of your posts';
export const activity_type_quote = () => 'Quotes of your posts';
export const activity_request_error = () => 'Could not update the request';
export const activity_request_approved = (name: string) => `${name} now follows you`;
export const activity_request_declined = () => 'Request declined';
export const activity_requests_load_error = () => 'Could not load follow requests';
export const activity_follow_requests = () => 'Follow requests';
export const activity_approve = () => 'Approve';
export const activity_approve_name = (name: string) => `Approve ${name}`;
export const activity_decline = () => 'Decline';
export const activity_decline_name = (name: string) => `Decline ${name}`;
export const activity_load_error = () => 'Could not load activity';
export const activity_page_title = () => 'Activity · Kizuna';
export const activity_empty = () => 'No activity yet';
export const activity_empty_hint = () =>
	'Likes, comments, tags and new followers will show up here.';
export const activity_new = () => 'New';
export const activity_view_post = () => 'View post';

// Messages
export const chat_load_older_error = () => 'Could not load earlier messages';
export const chat_not_sent_error = () => 'Message not sent';
export const chat_too_long = (max: number) => `Messages can be up to ${max} characters`;
export const chat_conversation_with = (name: string) => `Conversation with ${name}`;
export const chat_back = () => 'Back to messages';
export const chat_typing = () => 'typing…';
export const chat_connecting = () => 'Connecting…';
export const chat_reconnecting = () => 'Reconnecting…';
export const chat_messages_label = () => 'Messages';
export const chat_load_earlier = () => 'Load earlier messages';
export const chat_say_hello = () => 'Say hello 👋';
export const chat_you_replied_story = (name: string) => `You replied to ${name}'s story`;
export const chat_replied_your_story = () => 'Replied to your story';
export const chat_story_expired = () => '· Story expired';
export const chat_not_sent = () => 'Not sent';
export const chat_placeholder = (name: string) => `Message ${name}…`;
export const chat_label = (name: string) => `Message ${name}`;
export const chat_log_in = () => 'Please log in to send messages';
export const chat_open_error = () => 'Could not open the conversation';
export const chat_page_title = (name: string) => `${name} · Messages · Kizuna`;
export const chat_inbox_load_error = () => 'Could not load conversations';
export const chat_preview_mine = (content: string) => `You: ${content}`;
export const chat_inbox_title = () => 'Messages · Kizuna';
export const chat_empty = () => 'No messages yet';
export const chat_empty_hint = () =>
	'Open someone’s profile and tap Message to start a conversation.';
export const chat_unread = (count: number) => `${count} unread`;

// Explore
export const explore_title = () => 'Explore · Kizuna';
export const explore_description = () =>
	'Discover photographers, trending tags and new work on Kizuna.';
export const explore_trending = () => 'Trending tags';
export const explore_creators = () => 'Creators to follow';
export const explore_followed_by = (count: number) => `Followed by ${count} you follow`;
export const explore_followers = (count: number, shown: string) =>
	plural(count, { one: `${shown} follower`, other: `${shown} followers` });
export const explore_posts_label = () => 'Posts to discover';
export const explore_empty = () => 'Nothing new to explore yet';
export const explore_empty_hint = () => "New posts from people you don't follow will show up here.";
export const explore_tag_title = (tag: string) => `#${tag} · Kizuna`;
export const explore_tag_description = (tag: string) => `Posts tagged #${tag} on Kizuna.`;
export const explore_back = () => 'Back to Explore';
export const explore_tag_empty = () => 'No posts with this tag right now.';

// Search
export const search_failed = () => 'Search failed';
export const search_placeholder = () => 'Search creators and posts…';
export const search_label = () => 'Search creators and posts';
export const search_results = () => 'Search results';
export const search_min_chars = (min: number) => `Type at least ${min} characters to search.`;
export const search_no_results = (query: string) => `No results for “${query}”.`;
export const search_users = () => 'Users';
export const search_posts = () => 'Posts';

// Settings
export const settings_unknown_device = () => 'Unknown device';
export const settings_device = (browser: string, platform: string) => `${browser} on ${platform}`;
export const settings_theme_light_mode = () => 'Switch to light mode';
export const settings_theme_dark_mode = () => 'Switch to dark mode';
export const settings_theme_label = () => 'Theme mode';
export const settings_theme_light = () => 'Light';
export const settings_theme_system = () => 'System';
export const settings_theme_dark = () => 'Dark';
export const settings_account = () => 'Account';
export const settings_edit_profile = () => 'Edit profile';
export const settings_appearance = () => 'Appearance';
export const settings_moderation = () => 'Moderation';
export const settings_legal = () => 'About & legal';
export const settings_log_out = () => 'Log out';
export const settings_security = () => 'Security';
export const settings_account_error = () => 'Could not update your account';
export const settings_now_private = () => 'Your account is now private';
export const settings_now_public = () => 'Your account is now public';
export const settings_privacy = () => 'Account privacy';
export const settings_private_account = () => 'Private account';
export const settings_private_hint = () =>
	'Only people you approve can follow you and see your posts. Going public approves everyone waiting.';
export const settings_unblock_error = () => 'Could not unblock';
export const settings_blocked_users = () => 'Blocked users';
export const settings_no_blocked = () => "You haven't blocked anyone.";
export const settings_notifications_error = () => 'Could not update notifications';
export const settings_notifications = () => 'Notifications';
export const settings_notifications_load_failed = () =>
	'Could not load your notification settings.';
export const settings_session_error = () => 'Could not sign out that session';
export const settings_session_signed_out = () => 'Signed out of that session';
export const settings_sessions_error = () => 'Could not sign out your other sessions';
export const settings_sessions_signed_out = () => 'Signed out of all other sessions';
export const settings_active_sessions = () => 'Active sessions';
export const settings_signing_out = () => 'Signing out…';
export const settings_sign_out_others = () => 'Sign out of other sessions';
export const settings_this_device = () => 'This device';
export const settings_session_signed_in = (date: string) => `Signed in ${date}`;
export const settings_session_last_active = (date: string) => `· Last active ${date}`;
export const settings_sign_out_device = (device: string) => `Sign out ${device}`;
export const settings_sign_out = () => 'Sign out';
export const settings_push_error = () => 'Could not update push notifications';
export const settings_push_unsupported = () =>
	'This browser cannot receive push notifications. On iPhone and iPad, add Kizuna to your Home Screen first.';
export const settings_push_denied = () =>
	'Notifications are blocked for this site. Allow them in your browser settings.';
export const settings_push_label = () => 'Push notifications on this device';
export const settings_password_current_required = () => 'Please enter your current password.';
export const settings_password_incorrect = () => 'Your current password is incorrect.';
export const settings_password_error = () => 'Could not change your password';
export const settings_password_changed = () =>
	'Password changed. Your other sessions were signed out.';
export const settings_password = () => 'Password';
export const settings_current_password = () => 'Current password';
export const settings_new_password = () => 'New password';
export const settings_confirm_new_password = () => 'Confirm new password';
export const settings_password_hint = () => 'Changing it signs you out everywhere else.';
export const settings_change_password = () => 'Change password';
export const settings_sign_in_method = () => 'Sign-in method';
export const settings_close_friend_add_error = () => 'Could not add to close friends';
export const settings_close_friend_remove_error = () => 'Could not remove from close friends';
export const settings_close_friends = () => 'Close friends';
export const settings_close_friend_remove = (name: string) => `Remove ${name} from close friends`;
export const settings_no_close_friends = () => "You haven't added any close friends.";
export const settings_add_close_friends = () => 'Add close friends';
export const settings_close_friends_hint = () =>
	'Search by handle. Your close friends stories reach the people here who follow you.';
export const settings_people_to_add = () => 'People to add';
export const settings_close_friend_add = (name: string) => `Add ${name} to close friends`;
export const settings_email_send_error = () => 'Could not send the email';
export const settings_email_verification_sent = (email: string) =>
	`We sent a verification link to ${email}`;
export const settings_email_change_error = () => 'Could not change your email';
export const settings_email_check_approve = (email: string) =>
	`Check ${email} for a link to approve the change`;
export const settings_email_check_confirm = (email: string) =>
	`Check ${email} for a link to confirm it`;
export const settings_email_unverified_notice = () =>
	"Your email address isn't verified yet. Open the link we email you to confirm it's yours.";
export const settings_email_resend = () => 'Resend verification email';
export const settings_email = () => 'Email';
export const settings_email_verified = () => 'Verified';
export const settings_email_not_verified = () => 'Not verified';
export const settings_email_change_verified = (email: string) =>
	`We'll email ${email} to approve the change, then send a link to the new address to finish.`;
export const settings_email_change_unverified = () =>
	"We'll send a link to the new address. Your email changes when you open it.";
export const settings_new_email = () => 'New email';
export const settings_send_link = () => 'Send link';
export const settings_unmute_error = () => 'Could not unmute';
export const settings_mute_word_error = () => 'Could not mute that word';
export const settings_unmute_word_error = () => 'Could not unmute that word';
export const settings_muted = () => 'Muted';
export const settings_unmuting = () => 'Unmuting…';
export const settings_unmute = () => 'Unmute';
export const settings_no_muted = () => "You haven't muted anyone.";
export const settings_muted_words = () => 'Muted words';
export const settings_muted_words_hint = (max: number) =>
	`Posts containing a muted word or phrase stay out of your feed, Explore and tag pages. Up to ${max}.`;
export const settings_muting = () => 'Muting…';
export const settings_mute = () => 'Mute';
export const settings_unmute_word = (word: string) => `Unmute "${word}"`;
export const settings_export_error = () => 'Could not prepare your data';
export const settings_export_started = () => 'Your data is downloading';
export const settings_delete_error = () => 'Could not delete your account';
export const settings_deleted = () => 'Your account has been deleted';
export const settings_data = () => 'Privacy & data';
export const settings_download_data = () => 'Download your data';
export const settings_download_data_hint = () =>
	'Profile, posts, comments, follows and messages as a JSON file';
export const settings_preparing = () => 'Preparing…';
export const settings_download = () => 'Download';
export const settings_delete_account = () => 'Delete account';
export const settings_delete_account_hint = () =>
	'Permanently removes your profile, posts, comments, follows and messages';
export const settings_delete_warning = () =>
	'This cannot be undone. Everything you have posted and your messages will be deleted for good. Download your data first if you want a copy.';
export const settings_delete_confirm_before = () => 'Type';
export const settings_delete_confirm_after = () => 'to confirm';
export const settings_delete_my_account = () => 'Delete my account';
export const settings_2fa = () => 'Two-factor authentication';
export const settings_2fa_continue = () => 'Continue';
export const settings_2fa_turn_off = () => 'Turn off';
export const settings_2fa_turn_on = () => 'Turn on';
export const settings_2fa_new_codes = () => 'Create new codes';
export const settings_2fa_password_incorrect = () => 'Your password is incorrect.';
export const settings_2fa_enter_password = () => 'Please enter your password.';
export const settings_2fa_enable_error = () => 'Could not set up two-factor authentication';
export const settings_2fa_codes_error = () => 'Could not create new backup codes';
export const settings_2fa_codes_created = () =>
	'New backup codes created. The old ones no longer work.';
export const settings_2fa_disable_error = () => 'Could not turn off two-factor authentication';
export const settings_2fa_is_off = () => 'Two-factor authentication is off';
export const settings_2fa_is_on = () => 'Two-factor authentication is on';
export const settings_2fa_code_format = () => 'Enter the 6-digit code from your authenticator app.';
export const settings_2fa_code_wrong = () =>
	'That code is not right. Check your app and try again.';
export const settings_2fa_verify_error = () => 'Could not verify the code';
export const settings_2fa_codes_copied = () => 'Backup codes copied';
export const settings_2fa_copy_error = () =>
	'Could not copy. Select the codes and copy them yourself.';
export const settings_2fa_app = () => 'Authenticator app';
export const settings_2fa_on_hint = () => 'On. Logging in with your password also asks for a code.';
export const settings_2fa_off_hint = () => 'Ask for a code from your phone when you log in';
export const settings_2fa_backup_codes = () => 'Backup codes';
export const settings_2fa_backup_codes_hint = () =>
	'One-time codes for when you cannot use your app';
export const settings_2fa_regenerate = () => 'Regenerate';
export const settings_2fa_confirm_password = () => 'Confirm your password';
export const settings_2fa_regenerate_warning = () => 'Your current backup codes will stop working.';
export const settings_2fa_disable_warning = () => 'Logging in will only ask for your password.';
export const settings_2fa_checking = () => 'Checking…';
export const settings_2fa_scan = () =>
	'Scan this QR code with an authenticator app, such as Google Authenticator, 1Password or Authy, then enter the 6-digit code it shows.';
export const settings_2fa_qr_label = () => 'QR code for your authenticator app';
export const settings_2fa_manual_key = () => "Can't scan it? Enter this key instead:";
export const settings_2fa_code = () => 'Code from the app';
export const settings_2fa_verifying = () => 'Verifying…';
export const settings_2fa_verify = () => 'Verify and turn on';
export const settings_2fa_save_codes = () =>
	'Save these backup codes somewhere safe. Each one logs you in once if you lose your phone. They will not be shown again.';
export const settings_link_expired = () => 'This link has expired. Request a new one.';
export const settings_link_wrong_account = () => 'This link is for a different account.';
export const settings_link_invalid = () => 'This link is invalid.';
export const settings_email_now_verified = () => 'Your email is verified';
export const settings_email_now = (email: string) => `Your email is now ${email}`;
export const settings_email_approved = (email: string) =>
	`Approved. Open the link we sent to ${email} to finish.`;
export const settings_page_title = () => 'Settings · Kizuna';
export const settings_title = () => 'Settings';

// Moderation
export const moderation_suspend_until_lifted = () => 'Until lifted';
export const moderation_title_dismiss = () => 'Dismiss reports';
export const moderation_title_remove = () => 'Remove content';
export const moderation_title_suspend = () => 'Suspend user';
export const moderation_confirm_dismiss = () => 'Dismiss';
export const moderation_confirm_remove = () => 'Remove';
export const moderation_confirm_suspend = () => 'Suspend';
export const moderation_describe_dismiss = (noun: string) =>
	`Close every open report on this ${noun} and leave it up.`;
export const moderation_describe_remove = (noun: string) =>
	`Remove this ${noun} and close every open report on it.`;
export const moderation_describe_suspend = (name: string) =>
	`Sign ${name} out and block them from signing in.`;
export const moderation_this_user = () => 'this user';
export const moderation_resolve_error = () => 'Could not resolve';
export const moderation_resolved = () => 'Resolved';
export const moderation_duration = () => 'Duration';
export const moderation_note = () => 'Note';
export const moderation_note_hint = () => '(optional, kept in the audit log)';
export const moderation_working = () => 'Working…';
export const moderation_reports = () => 'Reports';
export const moderation_moderators = () => 'Moderators';
export const moderation_add_error = () => 'Could not add the moderator';
export const moderation_now_moderator = (name: string) => `${name} is now a moderator`;
export const moderation_revoke_error = () => 'Could not revoke';
export const moderation_no_longer_moderator = (name: string) => `${name} is no longer a moderator`;
export const moderation_lift_error = () => 'Could not lift';
export const moderation_lifted = () => 'Suspension lifted';
export const moderation_lift_suspension_error = () => 'Could not lift the suspension';
export const moderation_moderators_load_error = () => 'Could not load moderators';
export const moderation_moderators_title = () => 'Moderators · Kizuna';
export const moderation_staff = () => 'Moderators and admins';
export const moderation_revoke = () => 'Revoke';
export const moderation_add = () => 'Add a moderator';
export const moderation_user_field = () => 'Handle or user id';
export const moderation_user_placeholder = () => '@handle';
export const moderation_make_moderator = () => 'Make moderator';
export const moderation_lift_title = () => 'Lift a suspension';
export const moderation_lifting = () => 'Lifting…';
export const moderation_lift = () => 'Lift suspension';
export const moderation_revoke_title = () => 'Revoke moderator';
export const moderation_revoke_hint = (name: string) =>
	`${name} will lose access to the moderation queue right away.`;
export const moderation_revoking = () => 'Revoking…';
export const moderation_type_post = () => 'Post';
export const moderation_type_comment = () => 'Comment';
export const moderation_type_user = () => 'Account';
export const moderation_type_message = () => 'Message';
export const moderation_reports_load_error = () => 'Could not load reports';
export const moderation_reports_title = () => 'Reports · Kizuna';
export const moderation_no_reports = () => 'No open reports. All caught up.';
export const moderation_report_count = (count: number) =>
	plural(count, { one: `${count} report`, other: `${count} reports` });
export const moderation_suspended = () => 'suspended';
export const moderation_media_alt = () => 'First media item of the reported post';
export const moderation_already_removed = () => 'Already removed.';
export const moderation_content_gone = () => 'This content no longer exists.';
export const moderation_view = () => 'View';

// Pages
export const legal_terms_label = () => 'Terms';
export const legal_terms_title = () => 'Terms of Service';
export const legal_privacy_label = () => 'Privacy';
export const legal_privacy_title = () => 'Privacy Policy';
export const legal_cookies_label = () => 'Cookies';
export const legal_cookies_title = () => 'Cookie Policy';
export const legal_guidelines_label = () => 'Guidelines';
export const legal_guidelines_title = () => 'Community Guidelines';
export const legal_about_label = () => 'About';
export const legal_about_title = () => 'About Kizuna';
export const cookie_notice_label = () => 'Cookie notice';
export const cookie_notice_text = () => 'Kizuna uses only essential cookies to keep you signed in.';
export const legal_documents = () => 'Legal documents';
export const legal_last_updated = (date: string) => `Last updated ${date}`;
export const error_title_not_found = () => '404: Page Not Found — Kizuna';
export const error_title = (status: number) => `${status}: Something Went Wrong — Kizuna`;
export const error_description_not_found = () => 'The requested page could not be found on Kizuna.';
export const error_description = () => 'An error occurred while loading this page.';
export const error_badge_not_found = () => 'Page Not Found · ページが見つかりません';
export const error_badge = () => 'Application Error · エラー';
export const error_not_found_text = () =>
	"The page you are looking for doesn't exist, has been removed, or the link may be mistyped.";
export const error_unexpected = () =>
	'An unexpected error occurred. Please try again or return home.';
export const error_reference = (id: string) => `Reference: ${id}`;
export const error_return_to_feed = () => 'Return to Feed';
export const error_go_to_profile = () => 'Go to Profile';
export const error_go_back = () => 'Go back to previous page';
export const offline_title = () => 'Offline · Kizuna';
export const offline_heading = () => "You're offline";
export const offline_text = () =>
	'Kizuna needs a connection to load this page. Check your network and try again.';
export const about_title = () => 'About · Kizuna';
export const about_intro = () =>
	'Kizuna (絆) means "bonds". It is a quiet place to share photography and writing, follow people whose work you love, and talk with them directly. There are no ads and no algorithmic tricks. Your home feed shows what the people you follow post.';
export const about_contact = () => 'Contact';
export const about_contact_text = () => 'Questions, privacy requests or copyright complaints:';
export const welcome_title = () => 'Welcome — Kizuna';
export const welcome_handle_title = () => 'Pick your handle';
export const welcome_handle_description = () => 'This is how people find and mention you.';
export const welcome_profile_title = () => 'Add a photo and bio';
export const welcome_profile_description = () => 'Help people recognise you. You can skip this.';
export const welcome_follow_title = () => 'Follow some creators';
export const welcome_follow_description = () => 'Fill your feed with work you like.';
export const welcome_done_title = () => "You're all set";
export const welcome_done_description = () => 'Your profile is ready. Welcome to Kizuna.';
export const welcome_handle_empty = () => 'Choose a handle to continue.';
export const welcome_handle_checking = () => 'Checking availability…';
export const welcome_handle_available = (handle: string) => `@${handle} is available.`;
export const welcome_handle_taken = (handle: string) => `@${handle} is already taken.`;
export const welcome_handle_error = () => 'Could not check this handle. Try again.';
export const welcome_save_error = () => 'Could not save your profile';
export const welcome_network_error = () => 'Network error. Please try again.';
export const welcome_finish_error = () => 'Could not finish setting up';
export const welcome_progress = () => 'Setup progress';
export const welcome_step = (step: number, total: number) => `Step ${step} of ${total}`;
export const welcome_step_done = (title: string) => `${title} (done)`;
export const welcome_handle = () => 'Handle';
export const welcome_bio = () => 'Bio';
export const welcome_continue = () => 'Continue';
export const welcome_back = () => 'Back';
export const welcome_skip = () => 'Skip';
export const welcome_no_suggestions = () =>
	'No suggestions yet. You can find people to follow on Explore later.';
export const welcome_start = () => 'Start exploring';
