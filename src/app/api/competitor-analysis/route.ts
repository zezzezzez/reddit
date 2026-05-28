import { NextResponse } from 'next/server';
import { fetchSubredditPosts, selectRandomPosts, fetchRedditPost } from '@/lib/reddit';
import { analyzeCommentSentiment, calcCommentInfluenceScore } from '@/lib/sentiment';
import { getPosts, getComments } from '@/lib/store';
import { getLocalProxyConfig, isLocalDevelopment } from '@/lib/local-proxy';

const isVercel = !!process.env.VERCEL;

// 初始化本地代理
let proxyInitialized = false;
async function ensureLocalProxyInitialized() {
  if (proxyInitialized || !isLocalDevelopment()) {
    return;
  }
  
  const proxyConfig = getLocalProxyConfig();
  if (!proxyConfig) {
    proxyInitialized = true;
    return;
  }

  try {
    console.log('[Competitor Analysis] Initializing local proxy:', `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`);
    const undici = await import('undici');
    const proxyUrl = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
    const proxyAgent = new undici.ProxyAgent(proxyUrl);
    undici.setGlobalDispatcher(proxyAgent);
    console.log('[Competitor Analysis] Local proxy configured successfully');
  } catch (error) {
    console.error('[Competitor Analysis] Failed to configure local proxy:', error);
  } finally {
    proxyInitialized = true;
  }
}

interface CompetitorBrand {
  name: string;
  keywords: string[];
}

interface BrandAnalysis {
  brand: string;
  posts: any[];
  totalComments: number;
  flaggedComments: number;
  avgSentiment: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalInfluenceScore: number;
  keywords: Record<string, number>;
}

// 海信品牌关键词
const HISENSE_KEYWORDS = ['Hisense', 'hisense', '海信'];

export async function GET(request: Request) {
  try {
    // 初始化本地代理
    await ensureLocalProxyInitialized();
    
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');
    const postsPerBrand = parseInt(searchParams.get('postsPerBrand') || '5');
    const brandsParam = searchParams.get('brands') || 'tcl,samsung,sony';
    const selectedBrands = brandsParam.split(',').filter(b => b);

    // 构建竞品品牌列表
    const COMPETITOR_BRANDS = [
      { name: 'TCL', keywords: ['tcl'] },
      { name: 'Samsung', keywords: ['samsung', '三星'] },
      { name: 'Sony', keywords: ['sony', '索尼'] },
    ].filter(b => selectedBrands.includes(b.name.toLowerCase()));

    if (!subreddit) {
      return NextResponse.json({ error: 'Missing subreddit parameter' }, { status: 400 });
    }

    console.log(`[Competitor Analysis] Starting analysis for r/${subreddit}, brands: ${selectedBrands.join(', ')}`);
    console.log(`[Competitor Analysis] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Competitor Analysis] isLocalDevelopment: ${isLocalDevelopment()}`);
    const proxyConfig = getLocalProxyConfig();
    console.log(`[Competitor Analysis] proxyConfig: ${JSON.stringify(proxyConfig)}`);

    // 1. 获取板块最新帖子（抓取更多以确保有足够的数据）
    const allPosts = await fetchSubredditPosts(subreddit, 500, 'new');
    
    console.log(`[Competitor Analysis] Fetched ${allPosts.length} posts from Reddit`);
    
    if (allPosts.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch posts from subreddit' }, { status: 500 });
    }

    console.log(`[Competitor Analysis] Fetched ${allPosts.length} posts from r/${subreddit}`);

    // 2. 获取已管理的海信帖子（不限制时间和评论数）
    const managedPosts = getPosts().filter(p => p.subreddit === subreddit);
    console.log(`[Competitor Analysis] Found ${managedPosts.length} managed Hisense posts`);

    // 2.5 获取已管理海信帖子中有恶意评论的帖子
    const hisenseFlaggedPosts = [];
    for (const post of managedPosts) {
      if (post.lastScanned && post.alertLevel && post.alertLevel !== 'safe' && post.alertLevel !== 'low') {
        // 获取该帖子的恶意评论
        const comments = getComments(post.id);
        const flaggedComments = comments.filter(c => c.isFlagged);
        
        if (flaggedComments.length > 0) {
          hisenseFlaggedPosts.push({
            id: post.id,
            title: post.title,
            subreddit: post.subreddit,
            alertLevel: post.alertLevel,
            alertReasons: post.alertReasons || [],
            commentCount: post.commentCount || 0,
            flaggedCommentCount: flaggedComments.length,
            totalInfluenceScore: (post as any)._totalInfluenceScore || 0,
            redditUrl: post.redditUrl,
            createdAt: post.createdAt,
            flaggedComments: flaggedComments.map(c => ({
              id: c.id,
              author: c.author,
              body: c.body,
              score: c.score,
              sentimentScore: c.sentimentScore,
              isFlagged: c.isFlagged,
              flagReasons: c.flagReasons || [],
              influenceScore: c.influenceScore,
            })),
          });
        }
      }
    }
    console.log(`[Competitor Analysis] Found ${hisenseFlaggedPosts.length} Hisense posts with flagged comments`);

    // 3. 过滤竞品帖子：只看标题是否包含品牌关键词
    // 竞品数量 = 海信帖子数量
    const hisenseCount = managedPosts.length;
    
    const competitorCandidatePosts = allPosts.filter(post => {
      const titleLower = post.title.toLowerCase();
      // 只看标题
      return COMPETITOR_BRANDS.some(brand => 
        brand.keywords.some(kw => titleLower.includes(kw.toLowerCase()))
      );
    });


    console.log(`[Competitor Analysis] Found ${competitorCandidatePosts.length} competitor posts (title match)`);

    // 4. 按品牌分类帖子
    const brandPosts: Record<string, typeof allPosts> = {
      'Hisense': [],
      'TCL': [],
      'Samsung': [],
      'Sony': [],
      'Other': [],
    };

    // 先添加已管理的海信帖子（不管是否在 Reddit API 结果中）
    for (const managedPost of managedPosts) {
      brandPosts['Hisense'].push({
        id: managedPost.id,
        title: managedPost.title,
        author: managedPost.author || 'unknown',
        score: managedPost.score || 0,
        commentCount: managedPost.commentCount || 0,
        subreddit: managedPost.subreddit,
        createdAt: managedPost.createdAt,
        permalink: managedPost.redditUrl,
        selftext: '',
      });
    }

    // 对 Reddit API 获取的帖子进行品牌分类（仅用于竞品，只看标题）
    for (const post of competitorCandidatePosts) {
      const titleLower = post.title.toLowerCase();

      // 跳过已管理的帖子（避免重复）
      const isManaged = managedPosts.some(mp => mp.redditUrl.includes(post.id) || mp.id === post.id);
      if (isManaged) continue;

      // 只看标题是否包含品牌关键词
      for (const brand of COMPETITOR_BRANDS) {
        if (brand.keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
          brandPosts[brand.name].push(post);
          break;
        }
      }
    }

    console.log('[Competitor Analysis] Brand distribution:', {
      Hisense: brandPosts['Hisense'].length,
      TCL: brandPosts['TCL'].length,
      Samsung: brandPosts['Samsung'].length,
      Sony: brandPosts['Sony'].length,
      Other: brandPosts['Other'].length,
    });

    // 打印前几条竞品帖子标题用于调试
    const allCompetitorPosts = [
      ...brandPosts['TCL'],
      ...brandPosts['Samsung'],
      ...brandPosts['Sony'],
    ];
    console.log('[Competitor Analysis] First 5 competitor post titles:');
    allCompetitorPosts.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title}`);
    });

    // 5. 对每个品牌选择帖子（竞品数量 = 海信帖子数量）
    const brandAnalysis: Record<string, BrandAnalysis> = {};

    for (const [brand, posts] of Object.entries(brandPosts)) {
      if (brand === 'Other' || posts.length === 0) continue;

      // 竞品品牌：数量 = 海信帖子数量；海信品牌：使用全部已管理帖子
      const numToSelect = brand === 'Hisense' ? posts.length : Math.min(hisenseCount, posts.length);
      const selectedPosts = selectRandomPosts(posts, numToSelect);
      
      console.log(`[Competitor Analysis] Analyzing ${selectedPosts.length} posts for ${brand}`);

      // 分析每个帖子
      const analyzedPosts: any[] = [];
      let totalComments = 0;
      let flaggedComments = 0;
      let totalSentiment = 0;
      let positiveCount = 0;
      let neutralCount = 0;
      let negativeCount = 0;
      let totalInfluenceScore = 0;
      const keywordCount: Record<string, number> = {};

      for (const post of selectedPosts) {
        try {
          // 获取帖子评论
          const redditData = await fetchRedditPost(post.permalink);
          
          if (!redditData) continue;

          const comments = redditData.comments;
          totalComments += comments.length;

          // 分析每条评论
          let postFlagged = 0;
          let postSentiment = 0;
          let postInfluence = 0;

          for (const comment of comments) {
            const analysis = analyzeCommentSentiment(comment);
            comment.sentimentScore = analysis.score;
            comment.isFlagged = analysis.isFlagged;
            comment.flagReasons = analysis.flagReasons || [];

            postSentiment += analysis.score;
            
            if (analysis.score > 0.1) positiveCount++;
            else if (analysis.score < -0.1) negativeCount++;
            else neutralCount++;

            if (analysis.isFlagged) {
              postFlagged++;
              // 计算影响力分数
              const influenceScore = calcCommentInfluenceScore(comment.score, analysis.score);
              totalInfluenceScore += influenceScore;
              
              // 统计关键词
              for (const reason of (analysis.flagReasons || [])) {
                keywordCount[reason] = (keywordCount[reason] || 0) + 1;
              }
            }
          }

          flaggedComments += postFlagged;
          totalInfluenceScore += postInfluence;

          analyzedPosts.push({
            ...post,
            commentCount: comments.length,
            flaggedComments: postFlagged,
            avgSentiment: comments.length > 0 ? postSentiment / comments.length : 0,
          });

          // 限速：每个帖子之间等待 2 秒
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`[Competitor Analysis] Error analyzing post ${post.id}:`, error);
        }
      }

      brandAnalysis[brand] = {
        brand,
        posts: analyzedPosts,
        totalComments,
        flaggedComments,
        avgSentiment: totalComments > 0 ? totalSentiment / totalComments : 0,
        positiveCount,
        neutralCount,
        negativeCount,
        totalInfluenceScore,
        keywords: keywordCount,
      };
    }

    return NextResponse.json({
      subreddit,
      brands: brandAnalysis,
      hisenseFlaggedPosts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Competitor Analysis] Error:', error);
    return NextResponse.json({ error: 'Failed to perform competitor analysis' }, { status: 500 });
  }
}
