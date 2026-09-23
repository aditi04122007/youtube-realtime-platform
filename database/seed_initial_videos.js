/**
 * StreamWave / YouTube Realtime Platform
 * Initial Video & Channel Seeder for Cloud Database
 */
const mysql = require('../backend/node_modules/mysql2/promise');
const bcrypt = require('../backend/node_modules/bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER || 'hjgwu4JGMpun6L5.root',
  password: process.env.DB_PASSWORD || 'OkbTdT35RVpQk1Cp',
  database: process.env.DB_NAME || 'video_platform',
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
};

async function seed() {
  console.log('[Seeder] Connecting to Cloud Database...');
  const conn = await mysql.createConnection(dbConfig);
  console.log('[Seeder] Connected successfully!');

  try {
    const passwordHash = await bcrypt.hash('CreatorPass@123', 10);

    // 1. Creators to create
    const creators = [
      {
        username: 'techlead',
        email: 'techlead@streamwave.com',
        displayName: 'Alex Rivera',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        channelName: 'TechLead Academy',
        handle: 'techlead',
        channelDesc: 'Deep-dive software architecture tutorials, real-time distributed systems, and modern web development.',
        bannerUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
        subscribers: 15400,
      },
      {
        username: 'codecraft',
        email: 'codecraft@streamwave.com',
        displayName: 'Sophia Chen',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        channelName: 'CodeCraft Studios',
        handle: 'codecraft',
        channelDesc: 'Hands-on frontend engineering, React mastery, state management, and modern UI/UX design.',
        bannerUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80',
        subscribers: 11200,
      },
      {
        username: 'nexusgaming',
        email: 'nexus@streamwave.com',
        displayName: 'Marcus Vance',
        avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&auto=format&fit=crop&q=80',
        channelName: 'Nexus Gaming Hub',
        handle: 'nexusgaming',
        channelDesc: 'Premier esports tournament coverage, game reviews, competitive walkthroughs, and livestreams.',
        bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
        subscribers: 28900,
      },
      {
        username: 'wanderlust',
        email: 'wanderlust@streamwave.com',
        displayName: 'Elena Rostova',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
        channelName: 'Wanderlust Expeditions',
        handle: 'wanderlust',
        channelDesc: 'Breathtaking 4K nature documentaries, high-altitude alpine trails, and international cultural journeys.',
        bannerUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
        subscribers: 19800,
      },
    ];

    const channelMap = {}; // handle -> { channelId, userId }

    for (const c of creators) {
      // Check existing user
      const [existingUser] = await conn.execute(
        'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
        [c.username, c.email]
      );

      let userId;
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      } else {
        const [uRes] = await conn.execute(
          `INSERT INTO users (username, email, password_hash, role, status, email_verified, failed_login_attempts)
           VALUES (?, ?, ?, 'CREATOR', 'ACTIVE', 1, 0)`,
          [c.username, c.email, passwordHash]
        );
        userId = uRes.insertId;

        await conn.execute(
          `INSERT INTO user_profiles (user_id, display_name, avatar_url, banner_url, bio)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), avatar_url = VALUES(avatar_url)`,
          [userId, c.displayName, c.avatarUrl, c.bannerUrl, c.channelDesc]
        );
      }

      // Check existing channel
      const [existingChan] = await conn.execute(
        'SELECT id FROM channels WHERE handle = ? LIMIT 1',
        [c.handle]
      );

      let channelId;
      if (existingChan.length > 0) {
        channelId = existingChan[0].id;
      } else {
        const [cRes] = await conn.execute(
          `INSERT INTO channels (user_id, channel_name, handle, description, avatar_url, banner_url, subscriber_count, video_count, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE')`,
          [userId, c.channelName, c.handle, c.channelDesc, c.avatarUrl, c.bannerUrl, c.subscribers]
        );
        channelId = cRes.insertId;
      }

      channelMap[c.handle] = { channelId, userId };
    }

    console.log('[Seeder] Channels initialized:', Object.keys(channelMap));

    // 2. Initial Sample Videos with high-speed CDN MP4s & beautiful Unsplash thumbs
    const initialVideos = [
      {
        title: 'Building Modern Full-Stack Real-Time Platforms with WebRTC & WebSockets',
        description: 'Complete masterclass on building ultra-low latency real-time communication systems, audio/video peer mesh connections, and responsive event broadcasting.',
        channelHandle: 'techlead',
        categorySlug: 'technology',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 596,
        viewCount: 28450,
        likeCount: 2190,
        commentCount: 84,
        isPremium: false,
      },
      {
        title: 'React 18 & Vite 6 Masterclass: Zero to Full Production Architecture',
        description: 'Learn modern React patterns, performance optimization with useMemo/useCallback, clean component composition, and blazing-fast Vite builds.',
        channelHandle: 'codecraft',
        categorySlug: 'education',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 653,
        viewCount: 19800,
        likeCount: 1540,
        commentCount: 52,
        isPremium: false,
      },
      {
        title: 'Next-Gen Esports Championship: Grand Finals Highlights & Play Breakdown',
        description: 'Exclusive tournament replay with pro player commentary, tactical analysis of championship matches, and highlight clutch moments.',
        channelHandle: 'nexusgaming',
        categorySlug: 'gaming',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 15,
        viewCount: 42100,
        likeCount: 3820,
        commentCount: 129,
        isPremium: false,
      },
      {
        title: 'Acoustic Sunset Sessions: Lo-Fi Chill Beats & Ambient Acoustic Guitar',
        description: 'Relax, focus, and study with calming ambient melodies recorded live at golden hour. Perfect background audio for programming and creative flow.',
        channelHandle: 'techlead',
        categorySlug: 'music',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 15,
        viewCount: 14700,
        likeCount: 1120,
        commentCount: 38,
        isPremium: false,
      },
      {
        title: 'Deep Space Wonders: James Webb Telescope Cosmic Discoveries',
        description: 'Explore the deepest corners of the observable universe, newly cataloged nebulae, gravitational lensing anomalies, and exoplanet atmospheres.',
        channelHandle: 'wanderlust',
        categorySlug: 'science',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 60,
        viewCount: 38900,
        likeCount: 3150,
        commentCount: 97,
        isPremium: false,
      },
      {
        title: 'Exploring the Majestic Swiss Alps: 4K Cinematic Drone Travel Film',
        description: 'A visual journey soaring through snow-capped peaks, emerald glacial lakes, and secluded mountain valleys in Switzerland.',
        channelHandle: 'wanderlust',
        categorySlug: 'travel',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 15,
        viewCount: 31200,
        likeCount: 2680,
        commentCount: 76,
        isPremium: false,
      },
      {
        title: 'Cybersecurity & Ethical Hacking: Hardening Cloud Deployments & API Gateways',
        description: 'Understand top attack vectors against modern APIs, rate limiting strategies, JWT signature verification, and intrusion prevention.',
        channelHandle: 'codecraft',
        categorySlug: 'technology',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 15,
        viewCount: 22800,
        likeCount: 1940,
        commentCount: 61,
        isPremium: false,
      },
      {
        title: 'Open Source 3D Animated Feature: Sintel Story & Character Art',
        description: 'The award-winning open movie initiative showcasing cutting-edge CGI rendering, physics simulation, and evocative narrative filmmaking.',
        channelHandle: 'techlead',
        categorySlug: 'entertainment',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 888,
        viewCount: 65400,
        likeCount: 5410,
        commentCount: 183,
        isPremium: false,
      },
      {
        title: 'Advanced System Design & Distributed Databases [PREMIUM VIP]',
        description: 'Exclusive tier deep-dive into distributed transactions, Raft consensus, query optimization at scale, and high-availability database clustering.',
        channelHandle: 'techlead',
        categorySlug: 'technology',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 734,
        viewCount: 11400,
        likeCount: 1080,
        commentCount: 42,
        isPremium: true,
        minimumPlanCode: 'BRONZE',
      },
      {
        title: 'Microservices with Node.js & Docker: High-Throughput Message Queues',
        description: 'Design decoupled service architectures, message queue consumers, horizontal scaling patterns, and zero-downtime deployment pipelines.',
        channelHandle: 'codecraft',
        categorySlug: 'technology',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
        durationSeconds: 15,
        viewCount: 17300,
        likeCount: 1390,
        commentCount: 49,
        isPremium: false,
      },
    ];

    // Fetch category map
    const [categories] = await conn.execute('SELECT id, slug FROM video_categories');
    const catMap = {};
    categories.forEach((cat) => {
      catMap[cat.slug] = cat.id;
    });

    // Fetch subscription plan for bronze
    const [bronzePlan] = await conn.execute("SELECT id FROM subscription_plans WHERE code = 'BRONZE' LIMIT 1");
    const bronzePlanId = bronzePlan[0]?.id || 2;

    for (const v of initialVideos) {
      const channelInfo = channelMap[v.channelHandle];
      if (!channelInfo) continue;

      const categoryId = catMap[v.categorySlug] || 1;

      // Check if video with same title already exists
      const [existingVid] = await conn.execute(
        'SELECT id FROM videos WHERE title = ? LIMIT 1',
        [v.title]
      );

      let videoId;
      if (existingVid.length > 0) {
        videoId = existingVid[0].id;
        console.log(`[Seeder] Video already exists: "${v.title}" (id: ${videoId})`);
      } else {
        const [vRes] = await conn.execute(
          `INSERT INTO videos (
            user_id, channel_id, title, description, video_url, thumbnail_url,
            duration_seconds, visibility, status, view_count, like_count, comment_count,
            mime_type, published_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLIC', 'PUBLISHED', ?, ?, ?, 'video/mp4', NOW(), NOW(), NOW())`,
          [
            channelInfo.userId,
            channelInfo.channelId,
            v.title,
            v.description,
            v.videoUrl,
            v.thumbnailUrl,
            v.durationSeconds,
            v.viewCount,
            v.likeCount,
            v.commentCount,
          ]
        );
        videoId = vRes.insertId;
        console.log(`[Seeder] Created video: "${v.title}" (id: ${videoId})`);
      }

      // Map category
      await conn.execute(
        `INSERT INTO video_category_map (video_id, category_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE category_id = VALUES(category_id)`,
        [videoId, categoryId]
      );

      // Map access rule
      if (v.isPremium) {
        await conn.execute(
          `INSERT INTO video_access_rules (video_id, access_type, required_plan_id, minimum_plan_code)
           VALUES (?, 'PREMIUM', ?, 'BRONZE')
           ON DUPLICATE KEY UPDATE access_type = 'PREMIUM', minimum_plan_code = 'BRONZE'`,
          [videoId, bronzePlanId]
        );
      } else {
        await conn.execute(
          `INSERT INTO video_access_rules (video_id, access_type, required_plan_id, minimum_plan_code)
           VALUES (?, 'FREE', NULL, NULL)
           ON DUPLICATE KEY UPDATE access_type = 'FREE'`,
          [videoId]
        );
      }
    }

    // Update channels video counts
    for (const handle of Object.keys(channelMap)) {
      const channelId = channelMap[handle].channelId;
      await conn.execute(
        `UPDATE channels c
         SET video_count = (SELECT COUNT(*) FROM videos WHERE channel_id = c.id AND status = 'PUBLISHED')
         WHERE id = ?`,
        [channelId]
      );
    }

    console.log('[Seeder] All initial starter videos seeded successfully!');
  } catch (err) {
    console.error('[Seeder] Error during seeding:', err);
  } finally {
    await conn.end();
  }
}

seed();
