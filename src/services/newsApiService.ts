// 뉴스 메타 파일 메모리 캐시를 관리한다.
let newsMetaFileCache: NewsMetaFile | null = null;
// 뉴스 메타 생성시각 기준 캐시 버전을 관리한다.
let newsMetaGeneratedAtCache: string = "";
// 언론사별 기사 shard 메모리 캐시를 관리한다.
const newsArticleShardCacheByPressId = new Map<string, NewsArticleShardFile>();

const NEWS_META_FILE_PATH = "/api/last/news/meta.json";
const NEWS_ARTICLE_PRESS_FILE_BASE_PATH = "/api/last/news/articles";

export interface Press {
  id: string;
  name: string;
  sortSeq?: number;
  useYn?: string;
}

export interface Category {
  id: string;
  name: string;
  sortSeq?: number;
  useYn?: string;
  sourceNm?: string;
  rssUrl?: string;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  publishedDt?: string;
  thumbnailUrl?: string;
}

export interface NewsMetaFileMeta {
  generatedAt: string;
  schemaVersion: string;
  source: string;
  targetCount: number;
  successTargetCount: number;
  failedTargetCount: number;
}

export interface NewsMetaFile {
  meta: NewsMetaFileMeta;
  pressList: Press[];
  categoryListByPressId: Record<string, Category[]>;
  defaultSelection: {
    defaultPressId: string;
    defaultCategoryIdByPressId: Record<string, string>;
  };
  articleFileByPressId: Record<string, string>;
}

export interface NewsArticleShardFile {
  meta: {
    generatedAt: string;
    schemaVersion: string;
    pressId: string;
  };
  articleListByCategoryId: Record<string, Article[]>;
  categoryOrder: string[];
}

export interface CategoryArticleSection {
  categoryId: string;
  categoryName: string;
  articleList: Article[];
}

function decodeHtmlEntities(value: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  return doc.documentElement.textContent || "";
}

function decodeArticleTitleList(articleList: Article[]): Article[] {
  if (!Array.isArray(articleList)) {
    return articleList;
  }
  return articleList.map((article) => ({
    ...article,
    title: decodeHtmlEntities(article?.title),
  }));
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function resetNewsArticleShardCache() {
  newsArticleShardCacheByPressId.clear();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNewsMetaFile(metaFile: any): NewsMetaFile {
  if (!metaFile || typeof metaFile !== "object") {
    return {
      meta: {
        generatedAt: "",
        schemaVersion: "",
        source: "",
        targetCount: 0,
        successTargetCount: 0,
        failedTargetCount: 0,
      },
      pressList: [],
      categoryListByPressId: {},
      defaultSelection: {
        defaultPressId: "",
        defaultCategoryIdByPressId: {},
      },
      articleFileByPressId: {},
    };
  }

  const resolvedMeta =
    metaFile.meta && typeof metaFile.meta === "object" ? metaFile.meta : {};
  const resolvedPressList = Array.isArray(metaFile.pressList)
    ? metaFile.pressList
    : [];
  const resolvedCategoryListByPressId =
    metaFile.categoryListByPressId &&
    typeof metaFile.categoryListByPressId === "object"
      ? metaFile.categoryListByPressId
      : {};
  const resolvedDefaultSelection =
    metaFile.defaultSelection && typeof metaFile.defaultSelection === "object"
      ? metaFile.defaultSelection
      : {};
  const resolvedArticleFileByPressId =
    metaFile.articleFileByPressId &&
    typeof metaFile.articleFileByPressId === "object"
      ? metaFile.articleFileByPressId
      : {};

  return {
    meta: {
      generatedAt: normalizeString(resolvedMeta.generatedAt),
      schemaVersion: normalizeString(resolvedMeta.schemaVersion),
      source: normalizeString(resolvedMeta.source),
      targetCount: Number.isFinite(resolvedMeta.targetCount)
        ? resolvedMeta.targetCount
        : 0,
      successTargetCount: Number.isFinite(resolvedMeta.successTargetCount)
        ? resolvedMeta.successTargetCount
        : 0,
      failedTargetCount: Number.isFinite(resolvedMeta.failedTargetCount)
        ? resolvedMeta.failedTargetCount
        : 0,
    },
    pressList: resolvedPressList,
    categoryListByPressId: resolvedCategoryListByPressId,
    defaultSelection: {
      defaultPressId: normalizeString(resolvedDefaultSelection.defaultPressId),
      defaultCategoryIdByPressId:
        resolvedDefaultSelection.defaultCategoryIdByPressId &&
        typeof resolvedDefaultSelection.defaultCategoryIdByPressId === "object"
          ? resolvedDefaultSelection.defaultCategoryIdByPressId
          : {},
    },
    articleFileByPressId: resolvedArticleFileByPressId,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNewsArticleShardFile(shardFile: any): NewsArticleShardFile {
  if (!shardFile || typeof shardFile !== "object") {
    return {
      meta: {
        generatedAt: "",
        schemaVersion: "",
        pressId: "",
      },
      articleListByCategoryId: {},
      categoryOrder: [],
    };
  }

  const resolvedMeta =
    shardFile.meta && typeof shardFile.meta === "object" ? shardFile.meta : {};
  const resolvedArticleListByCategoryId =
    shardFile.articleListByCategoryId &&
    typeof shardFile.articleListByCategoryId === "object"
      ? shardFile.articleListByCategoryId
      : {};
  const resolvedCategoryOrder = Array.isArray(shardFile.categoryOrder)
    ? shardFile.categoryOrder
    : [];

  const normalizedArticleListByCategoryId = Object.entries(
    resolvedArticleListByCategoryId
  ).reduce<Record<string, Article[]>>((accumulator, [categoryId, articleList]) => {
    accumulator[String(categoryId)] = decodeArticleTitleList(
      Array.isArray(articleList) ? (articleList as Article[]) : []
    );
    return accumulator;
  }, {});

  return {
    meta: {
      generatedAt: normalizeString(resolvedMeta.generatedAt),
      schemaVersion: normalizeString(resolvedMeta.schemaVersion),
      pressId: normalizeString(resolvedMeta.pressId),
    },
    articleListByCategoryId: normalizedArticleListByCategoryId,
    categoryOrder: resolvedCategoryOrder.map((categoryId: unknown) =>
      String(categoryId)
    ),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`요청 실패: ${response.status}`);
  }
  return response.json();
}

function resolveNewsArticleShardFilePath(
  pressId: string,
  articleFileByPressId?: Record<string, string>
): string {
  const mappedPath = normalizeString(articleFileByPressId?.[pressId]);
  if (mappedPath) {
    return mappedPath.startsWith("/") ? mappedPath : `/api/last/news/${mappedPath}`;
  }
  return `${NEWS_ARTICLE_PRESS_FILE_BASE_PATH}/press-${encodeURIComponent(pressId)}.json`;
}

export async function fetchNewsMetaFile(): Promise<NewsMetaFile> {
  try {
    const data = await fetchJson(NEWS_META_FILE_PATH);
    const normalizedMetaFile = normalizeNewsMetaFile(data);

    if (
      newsMetaFileCache &&
      newsMetaGeneratedAtCache &&
      normalizedMetaFile.meta.generatedAt &&
      newsMetaGeneratedAtCache !== normalizedMetaFile.meta.generatedAt
    ) {
      resetNewsArticleShardCache();
    }

    newsMetaFileCache = normalizedMetaFile;
    newsMetaGeneratedAtCache = normalizedMetaFile.meta.generatedAt;
    return normalizedMetaFile;
  } catch (error) {
    console.error("뉴스 메타 파일 조회 실패:", error);
    if (newsMetaFileCache) {
      return newsMetaFileCache;
    }
    return normalizeNewsMetaFile(null);
  }
}

export async function fetchNewsArticleShardByPressId(
  pressId: string,
  options: { articleFileByPressId?: Record<string, string> } = {}
): Promise<NewsArticleShardFile> {
  const normalizedPressId = normalizeString(pressId);

  if (!normalizedPressId) {
    return normalizeNewsArticleShardFile(null);
  }

  const cachedShard = newsArticleShardCacheByPressId.get(normalizedPressId);
  if (cachedShard) {
    return cachedShard;
  }

  try {
    const shardFilePath = resolveNewsArticleShardFilePath(
      normalizedPressId,
      options.articleFileByPressId
    );
    const data = await fetchJson(shardFilePath);
    const normalizedShardFile = normalizeNewsArticleShardFile(data);

    if (
      normalizedShardFile.meta.pressId &&
      normalizedShardFile.meta.pressId !== normalizedPressId
    ) {
      console.error(
        "뉴스 기사 shard 언론사 불일치:",
        normalizedPressId,
        normalizedShardFile.meta.pressId
      );
      return normalizeNewsArticleShardFile(null);
    }

    newsArticleShardCacheByPressId.set(normalizedPressId, normalizedShardFile);
    return normalizedShardFile;
  } catch (error) {
    console.error("뉴스 기사 shard 조회 실패:", normalizedPressId, error);
    return (
      newsArticleShardCacheByPressId.get(normalizedPressId) ||
      normalizeNewsArticleShardFile(null)
    );
  }
}
