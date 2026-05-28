import { NextResponse } from 'next/server';
import { fetchSubredditPosts, selectRandomPosts, fetchRedditPost } from '@/lib/reddit';
import { analyzeCommentSentiment, calcCommentInfluenceScore } from '@/lib/sentiment';
import { getPosts } from '@/lib/store';

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

// 竞品品牌配置
const COMPETITOR_BRANDS: CompetitorBrand[] = [
  { name: 'TCL', keywords: ['TCL', 'tcl'] },
  { name: 'Samsung', keywords: ['Samsung', 'samsung', '三星'] },
  { name: 'Sony', keywords: ['Sony', 'sony', '索尼'] },
];

// 海信品牌关键词
const HISENSE_KEYWORDS = ['Hisense', 'hisense', '海信'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');
    const postsPerBrand = parseInt(searchParams.get('postsPerBrand') || '5');

    if (!subreddit) {
      return NextResponse.json({ error: 'Missing subreddit parameter' }, { status: 400 });
    }

    console.log(`[Competitor Analysis] Starting analysis for r/${subreddit}`);

    // 1. 获取板块最新帖子（抓取更多以确保有足够的数据）
    const allPosts = await fetchSubredditPosts(subreddit, 200, 'new');
    
    if (allPosts.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch posts from subreddit' }, { status: 500 });
    }

    console.log(`[Competitor Analysis] Fetched ${allPosts.length} posts from r/${subreddit}`);

    // 2. 获取已管理的海信帖子（不限制时间和评论数）
    const managedPosts = getPosts().filter(p => p.subreddit === subreddit);
    console.log(`[Competitor Analysis] Found ${managedPosts.length} managed Hisense posts`);

    // 3. 过滤竞品帖子：最近 3 天 且 评论数 > 5
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const competitorCandidatePosts = allPosts.filter(post => {
      const postDate = new Date(post.createdAt);
      return postDate >= threeDaysAgo && post.commentCount > 5;
    });

    console.log(`[Competitor Analysis] Filtered to ${competitorCandidatePosts.length} competitor posts (recent 3 days, comments > 5)`);

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

    // 对 Reddit API 获取的帖子进行品牌分类（仅用于竞品）
    for (const post of competitorCandidatePosts) {
      const titleLower = post.title.toLowerCase();
      const textLower = post.selftext.toLowerCase();
      const content = `${titleLower} ${textLower}`;

      // 跳过已管理的帖子（避免重复）
      const isManaged = managedPosts.some(mp => mp.redditUrl.includes(post.id) || mp.id === post.id);
      if (isManaged) continue;

      // 检查是否提到竞品品牌
      let matched = false;
      for (const brand of COMPETITOR_BRANDS) {
        if (brand.keywords.some(kw => content.includes(kw.toLowerCase()))) {
          brandPosts[brand.name].push(post);
          matched = true;
          break;
        }
      }

      // 其他帖子（不统计）
    }

    console.log('[Competitor Analysis] Brand distribution:', {
      Hisense: brandPosts['Hisense'].length,
      TCL: brandPosts['TCL'].length,
      Samsung: brandPosts['Samsung'].length,
      Sony: brandPosts['Sony'].length,
      Other: brandPosts['Other'].length,
    });

    // 5. 对每个品牌随机选择 N 个帖子并分析
    const brandAnalysis: Record<string, BrandAnalysis> = {};

    for (const [brand, posts] of Object.entries(brandPosts)) {
      if (brand === 'Other' || posts.length === 0) continue;

      // 随机选择帖子
      const selectedPosts = selectRandomPosts(posts, postsPerBrand);
      
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Competitor Analysis] Error:', error);
    return NextResponse.json({ error: 'Failed to perform competitor analysis' }, { status: 500 });
  }
}
