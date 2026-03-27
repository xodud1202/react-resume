import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchNewsMetaFile,
  fetchNewsArticleShardByPressId,
  type Press,
  type Article,
  type NewsMetaFile,
  type CategoryArticleSection,
} from "@/services/newsApiService";
import {
  getPressOrderFromCookie,
  setPressOrderToCookie,
} from "@/utils/newsCookieStorage";
import PressOrderModal from "./PressOrderModal";

const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_COUNT = 10;

/**
 * 기사 발행일시를 yy/MM/dd HH:mm:ss 형식으로 변환한다.
 * @param publishedDt 발행일시 문자열 (예: "2025-03-27 14:30:00" 또는 ISO 형식)
 * @returns 포맷된 발행일시 문자열, 변환 불가 시 빈 문자열
 */
function formatPublishedDateTime(publishedDt: string | undefined): string {
  // 값이 없으면 빈 문자열을 반환한다.
  if (typeof publishedDt !== "string" || !publishedDt.trim()) {
    return "";
  }

  // 공백이 포함된 형식(YYYY-MM-DD HH:mm:ss)을 ISO 형식으로 변환해 Date 객체를 생성한다.
  const parsedDate = new Date(publishedDt.replace(" ", "T"));
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  // yy/MM/dd HH:mm:ss 형태로 포맷한다.
  const year = String(parsedDate.getFullYear()).slice(-2);
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const hour = String(parsedDate.getHours()).padStart(2, "0");
  const minute = String(parsedDate.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

/**
 * 기본 ID 목록과 저장된 정렬 목록을 병합해 유효한 정렬 목록을 생성한다.
 */
function normalizeOrderedIds(baseIds: string[], storedOrderIds: string[]): string[] {
  const baseIdSet = new Set(baseIds);
  const resolvedStoredIds = storedOrderIds.filter((id) => baseIdSet.has(id));
  const orderedSet = new Set(resolvedStoredIds);
  const remainingIds = baseIds.filter((id) => !orderedSet.has(id));
  return [...resolvedStoredIds, ...remainingIds];
}

/**
 * 특정 ID 항목을 상하로 이동한 다음 순서를 반환한다.
 */
function moveIdByOffset(orderedIds: string[], targetId: string, offset: number): string[] {
  const currentIndex = orderedIds.indexOf(targetId);
  if (currentIndex < 0) return orderedIds;
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= orderedIds.length) return orderedIds;
  const nextOrderedIds = [...orderedIds];
  const [movedId] = nextOrderedIds.splice(currentIndex, 1);
  nextOrderedIds.splice(nextIndex, 0, movedId);
  return nextOrderedIds;
}

/**
 * 기사 아이템 컴포넌트
 */
function ArticleItem({ article }: { article: Article }) {
  return (
    <li className="py-2 border-b last:border-b-0">
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="flex gap-2 hover:opacity-75 transition-opacity"
      >
        {article.thumbnailUrl && (
          <div className="flex-shrink-0 w-20 h-14 overflow-hidden rounded">
            <img
              src={article.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                const wrapper = (e.currentTarget as HTMLImageElement).parentElement;
                if (wrapper) wrapper.style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-base font-bold text-black leading-snug break-keep">
            {article.title}
          </span>
          {formatPublishedDateTime(article.publishedDt) && (
            <span className="text-xs text-gray-400 whitespace-nowrap text-right">
              {formatPublishedDateTime(article.publishedDt)}
            </span>
          )}
        </div>
      </a>
    </li>
  );
}

function NewsPage() {
  const [metaFile, setMetaFile] = useState<NewsMetaFile | null>(null);
  const [selectedPressId, setSelectedPressId] = useState("");
  const [categoryArticleSections, setCategoryArticleSections] = useState<CategoryArticleSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pressOrderIds, setPressOrderIds] = useState<string[]>([]);

  // PC: 카테고리별 노출 기사 수
  const [pcVisibleCountByCategoryId, setPcVisibleCountByCategoryId] = useState<Record<string, number>>({});

  // 모바일: 선택 카테고리 & 노출 기사 수
  const [mobileSelectedCategoryId, setMobileSelectedCategoryId] = useState("");
  const [mobileVisibleCount, setMobileVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  // 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOrderIds, setModalOrderIds] = useState<string[]>([]);
  const [modalSelectedPressId, setModalSelectedPressId] = useState("");

  const articleRequestSequenceRef = useRef(0);

  // 순서 반영 언론사 목록
  const visiblePressList: Press[] = useMemo(() => {
    if (!metaFile) return [];
    const baseIds = metaFile.pressList.map((p) => p.id);
    const resolvedOrderIds = normalizeOrderedIds(baseIds, pressOrderIds);
    const pressById = new Map(metaFile.pressList.map((p) => [p.id, p]));
    return resolvedOrderIds.map((id) => pressById.get(id)!).filter(Boolean);
  }, [metaFile, pressOrderIds]);

  const pressNameById = useMemo(() => {
    if (!metaFile) return new Map<string, string>();
    return new Map(metaFile.pressList.map((p) => [p.id, p.name]));
  }, [metaFile]);

  // 마운트 시 1회: 쿠키 + 메타 파일 로드
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const storedOrder = getPressOrderFromCookie();
      const meta = await fetchNewsMetaFile();
      setPressOrderIds(storedOrder);
      setMetaFile(meta);

      // 초기 언론사 결정: 쿠키 순서 → 메타 기본값 → 첫 번째
      const baseIds = meta.pressList.map((p) => p.id);
      const orderedIds = normalizeOrderedIds(baseIds, storedOrder);
      const initialPressId =
        orderedIds[0] ||
        meta.defaultSelection.defaultPressId ||
        meta.pressList[0]?.id ||
        "";
      setSelectedPressId(initialPressId);
      // 언론사 목록이 없으면 로딩 상태 해제
      if (!initialPressId) {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // selectedPressId 변경 시: 기사 shard 로드
  useEffect(() => {
    if (!selectedPressId || !metaFile) return;

    articleRequestSequenceRef.current += 1;
    const seq = articleRequestSequenceRef.current;

    setCategoryArticleSections([]);
    setPcVisibleCountByCategoryId({});
    setMobileVisibleCount(INITIAL_VISIBLE_COUNT);

    async function loadArticles() {
      const shard = await fetchNewsArticleShardByPressId(selectedPressId, {
        articleFileByPressId: metaFile!.articleFileByPressId,
      });
      if (seq !== articleRequestSequenceRef.current) return;

      const categories = metaFile!.categoryListByPressId[selectedPressId] ?? [];
      const sections: CategoryArticleSection[] = categories.map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        articleList: shard.articleListByCategoryId[cat.id] ?? [],
      }));

      setCategoryArticleSections(sections);
      setIsLoading(false);

      // 모바일 선택 카테고리: 현재 선택이 유효하면 유지, 아니면 첫 번째로
      setMobileSelectedCategoryId((prev) => {
        const isValid = sections.some((s) => s.categoryId === prev);
        return isValid ? prev : sections[0]?.categoryId ?? "";
      });
    }

    loadArticles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPressId]);

  function handleSelectPress(pressId: string) {
    setSelectedPressId(pressId);
    setIsLoading(true);
  }

  function handleOpenModal() {
    const ids = visiblePressList.map((p) => p.id);
    setModalOrderIds(ids);
    setModalSelectedPressId(
      ids.includes(selectedPressId) ? selectedPressId : ids[0] ?? ""
    );
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
  }

  function handleModalSelectPress(pressId: string) {
    setModalSelectedPressId(pressId);
  }

  function handleModalMoveUp() {
    setModalOrderIds((prev) => moveIdByOffset(prev, modalSelectedPressId, -1));
  }

  function handleModalMoveDown() {
    setModalOrderIds((prev) => moveIdByOffset(prev, modalSelectedPressId, 1));
  }

  function handleSaveOrder() {
    setPressOrderIds(modalOrderIds);
    setPressOrderToCookie(modalOrderIds);
    setIsModalOpen(false);
  }

  function handlePcShowMore(categoryId: string) {
    setPcVisibleCountByCategoryId((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] ?? INITIAL_VISIBLE_COUNT) + LOAD_MORE_COUNT,
    }));
  }

  function handleMobileSelectCategory(categoryId: string) {
    setMobileSelectedCategoryId(categoryId);
    setMobileVisibleCount(INITIAL_VISIBLE_COUNT);
  }

  function handleMobileShowMore() {
    setMobileVisibleCount((prev) => prev + LOAD_MORE_COUNT);
  }

  const mobileSection = categoryArticleSections.find(
    (s) => s.categoryId === mobileSelectedCategoryId
  );

  const controlRow = (
    <div className="flex items-center gap-2">
      <select
        className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={selectedPressId}
        onChange={(e) => handleSelectPress(e.target.value)}
      >
        {visiblePressList.map((press) => (
          <option key={press.id} value={press.id}>
            {press.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors whitespace-nowrap"
        onClick={handleOpenModal}
      >
        순서변경
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-4 pb-4">
      {/* PC 레이아웃 */}
      <div className="hidden md:block">
        <div className="mb-4">{controlRow}</div>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            뉴스를 불러오는 중...
          </div>
        ) : (
          <div className="flex gap-4 pb-4">
            {categoryArticleSections.map((section) => {
              const visibleCount =
                pcVisibleCountByCategoryId[section.categoryId] ?? INITIAL_VISIBLE_COUNT;
              const visibleArticles = section.articleList.slice(0, visibleCount);
              const hasMore = section.articleList.length > visibleCount;
              return (
                <div
                  key={section.categoryId}
                  className="flex-shrink-0 w-[420px] bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <h3 className="px-3 py-2 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg">
                    {section.categoryName}
                  </h3>
                  <ol className="px-3 py-1 list-none">
                    {visibleArticles.map((article) => (
                      <ArticleItem key={article.id} article={article} />
                    ))}
                    {visibleArticles.length === 0 && (
                      <li className="py-3 text-xs text-gray-400 text-center">
                        기사가 없습니다
                      </li>
                    )}
                  </ol>
                  {hasMore && (
                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        className="w-full py-1.5 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                        onClick={() => handlePcShowMore(section.categoryId)}
                      >
                        더보기 ({section.articleList.length - visibleCount}개 남음)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 모바일 레이아웃 */}
      <div className="block md:hidden">
        <div className="mb-3">{controlRow}</div>
        {/* 카테고리 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 [&::-webkit-scrollbar]:hidden">
          {categoryArticleSections.map((section) => (
            <button
              key={section.categoryId}
              type="button"
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm border transition-colors ${
                mobileSelectedCategoryId === section.categoryId
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => handleMobileSelectCategory(section.categoryId)}
            >
              {section.categoryName}
            </button>
          ))}
        </div>

        {/* 기사 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            뉴스를 불러오는 중...
          </div>
        ) : mobileSection ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
            <ol className="list-none">
              {mobileSection.articleList.slice(0, mobileVisibleCount).map((article) => (
                <ArticleItem key={article.id} article={article} />
              ))}
              {mobileSection.articleList.length === 0 && (
                <li className="py-4 text-sm text-gray-400 text-center">
                  기사가 없습니다
                </li>
              )}
            </ol>
            {mobileSection.articleList.length > mobileVisibleCount && (
              <div className="py-3">
                <button
                  type="button"
                  className="w-full py-2 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                  onClick={handleMobileShowMore}
                >
                  더보기 ({mobileSection.articleList.length - mobileVisibleCount}개 남음)
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <PressOrderModal
        isOpen={isModalOpen}
        orderIds={modalOrderIds}
        pressNameById={pressNameById}
        selectedPressId={modalSelectedPressId}
        onSelectPress={handleModalSelectPress}
        onMoveUp={handleModalMoveUp}
        onMoveDown={handleModalMoveDown}
        onClose={handleCloseModal}
        onSave={handleSaveOrder}
      />
    </div>
  );
}

export default NewsPage;
