INSERT OR IGNORE INTO `user` (`id`, `name`, `email`, `email_verified`, `image`, `handle`, `bio`, `location`)
VALUES
  ('usr_elena_dev', 'Elena Rostova', 'elena@kizuna.art', 1, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'elena.rostova', 'Architectural & Film Photographer capturing silence, light, and brutalist geometries across Scandinavia & Japan.', 'Copenhagen, Denmark'),
  ('usr_kai_dev', 'Kai Takahashi', 'kai@kizuna.art', 1, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'kai.raw', 'Ceramicist & visual poet exploring wabi-sabi aesthetics and tea culture.', 'Kyoto, Japan'),
  ('usr_sophia_dev', 'Sophia Vane', 'sophia@kizuna.art', 1, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', 'vane.studio', 'Visual curator studying monolithic spaces and tactile interiors.', 'Stockholm, Sweden'),
  ('usr_lars_dev', 'Lars Lindqvist', 'lars@kizuna.art', 1, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', 'lindqvist.nord', 'Landscape & spatial archivist focusing on alpine mineral structures.', 'Oslo, Norway');

INSERT OR REPLACE INTO `post` (`id`, `user_id`, `title`, `content`, `aspect_ratio`, `location`, `camera_meta`, `tags`, `post_type`, `likes_count`, `comments_count`, `shares_count`)
VALUES
  ('post-1', 'usr_elena_dev', 'Quiet Brutalism: Concrete Light & Shadows', 'A study on natural dawn illumination casting geometric shadows across raw exposed concrete in the central atrium. Shot on 35mm f/1.4. The spatial tension transforms throughout the winter solstice.', '4:5', 'Fondazione Prada, Milano', '35mm · ISO 200', '["#MinimalArchitecture", "#LightAndSpace", "#DesignArchive"]', 'photo', 842, 46, 12),
  ('post-2', 'usr_kai_dev', 'Wabi-Sabi Clay & Stoneware Forms', 'Hand-pinched Shigaraki stoneware fired in an anagama kiln over seven days. The ash melt creates an unrepeatable landscape of mineral hues and subtle texture.', '1:1', 'Kyoto, Japan', '50mm · ISO 400', '["#KyotoCeramics", "#WabiSabi", "#JapaneseCraft"]', 'photo', 618, 29, 8),
  ('post-3', 'usr_sophia_dev', 'Nordic Monolith: Timber & Slate Textures', 'Tactile cedar and natural slate slabs balancing acoustic warmth with Nordic brutalist geometry.', '4:5', 'Stockholm, Sweden', '28mm · ISO 100', '["#NordicDesign", "#TimberArchitecture", "#TactileSpaces"]', 'photo', 512, 18, 5),
  ('post-4', 'usr_lars_dev', 'Mineral Azimuth: Fjord Mist & Raw Stone', 'Dolomite rock formations reflected through dawn moisture along the Sognefjord mountain pass.', '1:1', 'Vestland, Norway', '80mm · ISO 200', '["#AlpineMinimalism", "#FjordLandscape", "#RawEarth"]', 'photo', 437, 22, 9),
  ('post-5', 'usr_elena_dev', 'Spiral Concrete: Geometry in Rotation', 'Continuous spiral staircase forming a helical prism through the skylight atrium.', '4:5', 'Helsinki, Finland', '35mm · ISO 400', '["#HelicalForm", "#BrutalistStairs", "#DesignArchive"]', 'photo', 720, 35, 14),
  ('post-6', 'usr_kai_dev', 'Charred Yakisugi Cedar: Fire & Longevity', 'Surface preservation through controlled combustion. The blackened timber absorbs dawn light with velvety depth.', '1:1', 'Nara, Japan', '50mm · ISO 160', '["#Yakisugi", "#KyotoCraft", "#JapaneseWoodwork"]', 'photo', 589, 27, 11);

-- Post media (#32).
INSERT OR REPLACE INTO `post_media` (`id`, `post_id`, `url`, `type`, `position`)
VALUES
  ('media-post-1-0', 'post-1', 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80', 'image', 0),
  ('media-post-1-1', 'post-1', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80', 'image', 1),
  ('media-post-1-2', 'post-1', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80', 'image', 2),
  ('media-post-1-3', 'post-1', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&auto=format&fit=crop&q=80', 'image', 3),
  ('media-post-2-0', 'post-2', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80', 'image', 0),
  ('media-post-3-0', 'post-3', 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=1200&auto=format&fit=crop&q=80', 'image', 0),
  ('media-post-4-0', 'post-4', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80', 'image', 0),
  ('media-post-5-0', 'post-5', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80', 'image', 0),
  ('media-post-6-0', 'post-6', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1200&auto=format&fit=crop&q=80', 'image', 0);

-- Tags (#33). Seeds run after migrations, so the 0007 backfill never sees the JSON above.
-- #DesignArchive is shared by post-1 and post-5 (one tag row, two links).
INSERT OR IGNORE INTO `tag` (`id`, `slug`, `name`)
VALUES
  ('tag-minimalarchitecture', 'minimalarchitecture', 'MinimalArchitecture'),
  ('tag-lightandspace', 'lightandspace', 'LightAndSpace'),
  ('tag-designarchive', 'designarchive', 'DesignArchive'),
  ('tag-kyotoceramics', 'kyotoceramics', 'KyotoCeramics'),
  ('tag-wabisabi', 'wabisabi', 'WabiSabi'),
  ('tag-japanesecraft', 'japanesecraft', 'JapaneseCraft'),
  ('tag-nordicdesign', 'nordicdesign', 'NordicDesign'),
  ('tag-timberarchitecture', 'timberarchitecture', 'TimberArchitecture'),
  ('tag-tactilespaces', 'tactilespaces', 'TactileSpaces'),
  ('tag-alpineminimalism', 'alpineminimalism', 'AlpineMinimalism'),
  ('tag-fjordlandscape', 'fjordlandscape', 'FjordLandscape'),
  ('tag-rawearth', 'rawearth', 'RawEarth'),
  ('tag-helicalform', 'helicalform', 'HelicalForm'),
  ('tag-brutaliststairs', 'brutaliststairs', 'BrutalistStairs'),
  ('tag-yakisugi', 'yakisugi', 'Yakisugi'),
  ('tag-kyotocraft', 'kyotocraft', 'KyotoCraft'),
  ('tag-japanesewoodwork', 'japanesewoodwork', 'JapaneseWoodwork');

-- Link by slug (not id) so re-seeding works even when 0007 backfilled these tags with other ids.
INSERT OR REPLACE INTO `post_tag` (`post_id`, `tag_id`, `position`)
SELECT v.column1, t.`id`, v.column3
FROM (VALUES
  ('post-1', 'minimalarchitecture', 0), ('post-1', 'lightandspace', 1), ('post-1', 'designarchive', 2),
  ('post-2', 'kyotoceramics', 0), ('post-2', 'wabisabi', 1), ('post-2', 'japanesecraft', 2),
  ('post-3', 'nordicdesign', 0), ('post-3', 'timberarchitecture', 1), ('post-3', 'tactilespaces', 2),
  ('post-4', 'alpineminimalism', 0), ('post-4', 'fjordlandscape', 1), ('post-4', 'rawearth', 2),
  ('post-5', 'helicalform', 0), ('post-5', 'brutaliststairs', 1), ('post-5', 'designarchive', 2),
  ('post-6', 'yakisugi', 0), ('post-6', 'kyotocraft', 1), ('post-6', 'japanesewoodwork', 2)
) v
JOIN `tag` t ON t.`slug` = v.column2;

INSERT OR IGNORE INTO `post_comment` (`id`, `post_id`, `user_id`, `content`)
VALUES
  ('cmt-1', 'post-1', 'usr_kai_dev', 'The texture gradation is immaculate. Concrete takes light like velvet here.'),
  ('cmt-2', 'post-2', 'usr_elena_dev', 'The natural wood ash glaze turned out breathtaking.'),
  ('cmt-3', 'post-3', 'usr_lars_dev', 'The timber grain balances the cold slate impeccably.');

-- Soft-deleted post (#31): must never appear in feed, profile or /post/[id].
INSERT OR REPLACE INTO `post` (`id`, `user_id`, `title`, `content`, `aspect_ratio`, `post_type`, `deleted_at`)
VALUES
  ('post-deleted', 'usr_elena_dev', 'Deleted draft', 'This post was deleted and should stay hidden.', '1:1', 'photo', cast(unixepoch('subsecond') * 1000 as integer));
