// 행사 목록·지도·검색·찜·상세 시트 등 앱 화면 로직 전체 (index.html에서 분리)
        // 토스인앱 등 어디에 빌드해 넣어도 데이터는 항상 GitHub Pages의 최신본을
        // 실시간으로 받아오도록 절대경로를 쓴다. GitHub Actions가 매일 새벽 갱신함.
        const DATA_BASE_URL = 'https://logichub24.github.io/fastfood-event-navi/public/';
        // granite.config.ts의 appName과 반드시 일치해야 intoss:// 딥링크가 이 앱으로 열림
        const APP_NAME = 'fastfood-event-navi';

        const CATEGORIES = ['ALL', '신메뉴', '시간대 특가', '세트･콤보', '배달', '멤버십･앱', '쿠폰･할인', '메뉴소식'];
        // grad: 공식 프로모션 이미지 대신 쓰는 자체 제작 카드 비주얼(브랜드 톤 그라데이션).
        // 저작권·심사 리스크 때문에 브랜드 배너 이미지는 앱 화면에 노출하지 않는다.
        const BRAND_INFO = {
            'MCDONALDS':     { text: '맥도날드',   emoji: '🍟', bg: 'bg-amber-100',  color: 'text-amber-700',  ring: 'ring-amber-300',  grad: 'from-amber-400 to-orange-500' },
            'KFC':           { text: 'KFC',       emoji: '🍗', bg: 'bg-red-100',    color: 'text-red-700',    ring: 'ring-red-300',    grad: 'from-red-500 to-red-700' },
            'LOTTERIA':      { text: '롯데리아',   emoji: '🍔', bg: 'bg-orange-100', color: 'text-orange-700', ring: 'ring-orange-300', grad: 'from-orange-400 to-red-500' },
            'MOMSTOUCH':     { text: '맘스터치',   emoji: '🐔', bg: 'bg-rose-100',   color: 'text-rose-700',   ring: 'ring-rose-300',   grad: 'from-rose-400 to-rose-600' },
            'FRANKBURGER':   { text: '프랭크버거', emoji: '🍔', bg: 'bg-yellow-100', color: 'text-yellow-700', ring: 'ring-yellow-300', grad: 'from-yellow-400 to-amber-600' },
            'SHAKESHACK':    { text: '쉐이크쉑',   emoji: '🍔', bg: 'bg-green-100',  color: 'text-green-700',  ring: 'ring-green-300',  grad: 'from-green-500 to-emerald-600' },
            'SUBWAY':        { text: '서브웨이',   emoji: '🥪', bg: 'bg-teal-100',   color: 'text-teal-700',   ring: 'ring-teal-300',   grad: 'from-teal-400 to-emerald-600' },
            'BURGERKING':    { text: '버거킹',     emoji: '👑', bg: 'bg-blue-100',   color: 'text-blue-700',   ring: 'ring-blue-300',   grad: 'from-blue-500 to-indigo-600' },
            'NOBRANDBURGER': { text: '노브랜드버거', emoji: '🍔', bg: 'bg-slate-100',  color: 'text-slate-700',  ring: 'ring-slate-300',  grad: 'from-slate-500 to-slate-700' },
        };

        let ALL_DEALS = [];
        let activeCategory = 'ALL';
        let activeBrand = 'ALL';
        let newOnly = false; // '오늘 새 행사' 배너로 켜는 신규만 보기 필터
        let endingOnly = false; // '오늘 종료' 칩으로 켜는 오늘마감만 보기 필터
        let sinceOnly = false; // '지난 방문 이후 새 행사' 배너로 켜는 필터
        let likedIds = new Set(JSON.parse(localStorage.getItem('ff_liked') || '[]'));
        // 행사 탭 필터에 노출할 브랜드. 9개 브랜드 모두 크롤러가 있고 실제 행사가 수집된다.
        const EVENT_BRANDS = ['MCDONALDS', 'KFC', 'LOTTERIA', 'MOMSTOUCH', 'BURGERKING', 'NOBRANDBURGER', 'FRANKBURGER', 'SHAKESHACK', 'SUBWAY'];

        // 지도 탭 상태
        let ALL_STORES = [];
        let mapBrand = 'ALL';
        let leafletMap = null;
        let mapMarkers = [];
        let searchCircle = null;
        let currentRadius = 500;
        let isUserPanning = false;
        let streetLayer = null, satelliteLayer = null, satelliteLabelLayer = null, isSatelliteView = false;
        const MAP_BRANDS = ['MCDONALDS', 'LOTTERIA', 'MOMSTOUCH', 'BURGERKING', 'NOBRANDBURGER', 'FRANKBURGER', 'SHAKESHACK', 'KFC', 'SUBWAY'];
        const RADIUS_STEPS = [300, 500, 1000, 2000, 3000, 5000]; // 그리드 좌→우, 위→아래 순서와 일치
        // 원본 편의점 앱과 동일한 브이월드(국토지리정보원) 위성영상 키 재사용 (도메인 제한 없이 동작 확인함)
        const VWORLD_KEY = '6888EEC4-8F4B-3D0D-87AE-7AE4C071E4CA';

        function dealKey(d) { return `${d.brand}:${d.id}`; }

        // 재방문 동기: deals.json의 isNew는 "크롤 시점 기준 전날 대비" 신규라, 며칠 만에 들어온
        // 사용자는 그동안 쌓인 행사를 전부 놓친다. 지난 방문 때 존재하던 행사 키를 저장해두고
        // 이번 방문에 없던 키를 "내 기준 새 행사"로 계산해 별도 배너로 보여준다.
        const SEEN_STORAGE_KEY = 'ff_seen';
        let sinceLastVisitKeys = new Set();
        let sinceImpressionLogged = false; // 배너 노출은 방문당 1회만 계측

        // 프라이빗 모드·용량 초과 등으로 localStorage가 막혀도 앱은 그대로 동작해야 하므로
        // 실패 시 "첫 방문"으로 취급해 배너만 접는다.
        function readSeenKeys() {
            try {
                const raw = localStorage.getItem(SEEN_STORAGE_KEY);
                return raw ? new Set(JSON.parse(raw)) : null; // null = 첫 방문(비교 대상 없음)
            } catch (e) {
                return null;
            }
        }

        function writeSeenKeys(keys) {
            try {
                localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...keys]));
            } catch (e) {
                // 저장 실패는 무시 - 다음 방문에 첫 방문으로 취급될 뿐 데이터 손실은 없다.
            }
        }

        // 지난 방문 스냅샷과 비교해 개인화 신규를 구한 뒤, 이번 방문 스냅샷으로 갱신한다.
        function updateSinceLastVisit() {
            // 로드 실패로 목록이 비었을 때 갱신하면 스냅샷이 지워져 다음 방문에 전체가 신규로 잡힌다.
            if (ALL_DEALS.length === 0) return;
            const currentKeys = new Set(ALL_DEALS.map(dealKey));
            const seen = readSeenKeys();
            // 첫 방문은 전부 새 것으로 보이므로 배너를 띄우지 않는다.
            sinceLastVisitKeys = seen
                ? new Set([...currentKeys].filter((k) => !seen.has(k)))
                : new Set();
            writeSeenKeys(currentKeys);
        }

        // 계측의 핵심 질문: "매일 오는 30~50명이 같은 사람인가, 매번 새 사람인가."
        // 방문 시각을 남겨두고 다음 방문 때의 간격을 함께 보내면 신규/재방문을 구분할 수 있다.
        const LAST_VISIT_KEY = 'ff_last_visit';
        function logVisit() {
            let daysSince = -1;   // -1 = 첫 방문(비교할 이전 방문 없음)
            let visitType = 'new';
            try {
                const prev = parseInt(localStorage.getItem(LAST_VISIT_KEY) || '', 10);
                if (Number.isFinite(prev)) {
                    daysSince = Math.floor((Date.now() - prev) / 86400000);
                    visitType = 'returning';
                }
                localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
            } catch (e) {
                // localStorage가 막힌 환경 - 방문 구분 없이 화면 진입만 기록한다.
            }
            window.tossLog?.('screen', {
                log_name: 'app_open',
                visit_type: visitType,
                days_since_last_visit: daysSince,
                deal_count: ALL_DEALS.length,
                liked_count: likedIds.size,
                since_last_visit_new: sinceLastVisitKeys.size,
            });
        }

        function saveLiked() {
            localStorage.setItem('ff_liked', JSON.stringify([...likedIds]));
            updateLikedBadge();
        }

        function updateLikedBadge() {
            const badge = document.getElementById('likedBadge');
            if (likedIds.size > 0) { badge.textContent = likedIds.size; badge.classList.remove('hidden'); }
            else { badge.classList.add('hidden'); }
        }

        async function loadDeals() {
            try {
                const res = await fetch(`${DATA_BASE_URL}deals.json?_=${Date.now()}`);
                ALL_DEALS = await res.json();
            } catch (e) {
                ALL_DEALS = [];
                console.error('deals.json 로드 실패', e);
            }
            document.getElementById('eventCountText').textContent = `${ALL_DEALS.length}건`;
            updateSinceLastVisit();
            logVisit();
            renderBrands();
            renderCategories();
            renderDeals();
            updateAlertBanners();
        }

        // 헤더의 '오늘 새 행사' 칩과 '찜한 행사 마감 임박' 배너를 상태에 맞춰 갱신한다.
        function updateAlertBanners() {
            // 오늘 새 행사 칩 (헤더 안, 탭하면 신규만 필터)
            const newCount = ALL_DEALS.filter((d) => d.isNew).length;
            const newBanner = document.getElementById('newDealsBanner');
            if (newCount > 0) {
                document.getElementById('newDealsBannerText').textContent = newOnly ? `새 행사 ${newCount} · 전체보기` : `새 행사 ${newCount}`;
                newBanner.className = `flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold border shrink-0 ${newOnly ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-200 text-blue-700'}`;
            } else {
                newBanner.className = 'hidden';
                if (newOnly) { newOnly = false; renderDeals(); } // 신규가 없어졌으면 필터 해제
            }

            // 오늘 종료 칩 (헤더 안, 탭하면 오늘마감만 필터)
            const endCount = ALL_DEALS.filter((d) => d.daysLeft !== null && d.daysLeft <= 0).length;
            const endBanner = document.getElementById('endingTodayBanner');
            if (endCount > 0) {
                document.getElementById('endingTodayBannerText').textContent = endingOnly ? `오늘 종료 ${endCount} · 전체보기` : `오늘 종료 ${endCount}`;
                endBanner.className = `flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold border shrink-0 ${endingOnly ? 'bg-red-600 border-red-600 text-white' : 'bg-red-50 border-red-200 text-red-600'}`;
            } else {
                endBanner.className = 'hidden';
                if (endingOnly) { endingOnly = false; renderDeals(); }
            }

            // 지난 방문 이후 새로 올라온 행사 (탭하면 그 행사만 보기)
            const sinceBanner = document.getElementById('sinceVisitBanner');
            if (sinceLastVisitKeys.size > 0) {
                document.getElementById('sinceVisitBannerText').textContent = sinceOnly
                    ? `지난 방문 이후 ${sinceLastVisitKeys.size}개 · 전체보기`
                    : `지난 방문 이후 새 행사 ${sinceLastVisitKeys.size}개`;
                sinceBanner.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${sinceOnly ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`;
                // 노출을 클릭과 함께 재야 이 배너가 실제로 재방문에 기여하는지(CTR) 판단할 수 있다.
                // updateAlertBanners는 필터를 켤 때마다 다시 도므로 방문당 1회만 기록한다.
                if (!sinceImpressionLogged) {
                    sinceImpressionLogged = true;
                    window.tossLog?.('impression', { log_name: 'since_visit_banner', count: sinceLastVisitKeys.size });
                }
            } else {
                sinceBanner.className = 'hidden';
                if (sinceOnly) { sinceOnly = false; renderDeals(); }
            }

            // 찜한 행사 중 오늘/내일 마감(daysLeft 0~1)인 것
            const expiring = ALL_DEALS.filter((d) => likedIds.has(dealKey(d)) && d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= 1);
            const expBanner = document.getElementById('expiringLikedBanner');
            if (expiring.length > 0) {
                document.getElementById('expiringLikedBannerText').textContent = `찜한 행사 ${expiring.length}개 곧 마감`;
                expBanner.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-[11px] font-bold text-red-600';
            } else {
                expBanner.className = 'hidden';
            }

            // 찜한 브랜드에 새 행사가 뜬 경우 (카페행사맵의 '찜 변동 감지' 이식 - 찜의 효용을 완성)
            const likedBrands = new Set([...likedIds].map((k) => k.split(':')[0]));
            const likedNew = ALL_DEALS.filter((d) => d.isNew && likedBrands.has(d.brand) && !likedIds.has(dealKey(d)));
            const likedNewBanner = document.getElementById('likedNewBanner');
            if (likedNew.length > 0) {
                document.getElementById('likedNewBannerText').textContent = `찜한 브랜드에 새 행사 ${likedNew.length}개`;
                likedNewBanner.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-bold text-purple-600';
            } else {
                likedNewBanner.className = 'hidden';
            }

            syncAlertBannersPad();
        }

        // 배너 줄에 보이는 항목이 하나라도 있을 때만 아래 필터와의 간격을 준다 (날씨 칩 등 비동기 항목 포함).
        function syncAlertBannersPad() {
            const wrap = document.getElementById('alertBanners');
            const anyShown = [...wrap.children].some((c) => !c.className.includes('hidden'));
            wrap.className = anyShown ? 'flex flex-wrap gap-1.5 px-3 pb-2' : 'flex flex-wrap gap-1.5 px-3';
        }

        // 새 행사/오늘 종료/지난 방문 이후 필터는 상호 배타 - 하나를 켜면 나머지는 끈다.
        function toggleNewOnly() {
            newOnly = !newOnly;
            if (newOnly) { endingOnly = false; sinceOnly = false; }
            renderDeals();
            updateAlertBanners();
        }

        function toggleEndingToday() {
            endingOnly = !endingOnly;
            if (endingOnly) { newOnly = false; sinceOnly = false; }
            renderDeals();
            updateAlertBanners();
        }

        function toggleSinceOnly() {
            window.tossLog?.('click', { log_name: 'since_visit_banner', count: sinceLastVisitKeys.size, turning_on: !sinceOnly });
            sinceOnly = !sinceOnly;
            if (sinceOnly) { newOnly = false; endingOnly = false; }
            renderDeals();
            updateAlertBanners();
            document.getElementById('dealListArea').scrollTop = 0;
        }

        // '찜한 브랜드 새 행사' 배너 탭 - 신규만 보기로 전환
        function viewLikedBrandNew() {
            newOnly = true;
            endingOnly = false;
            renderDeals();
            updateAlertBanners();
            document.getElementById('dealListArea').scrollTop = 0;
            switchTab('events');
        }

        function renderBrands() {
            const container = document.getElementById('brandContainer');
            // 인라인에는 3개만 노출하고 나머지는 '브랜드' 모달에서 고른다.
            // 고정 순서였을 때 행사 20건인 버거킹이 모달에 숨고 5건인 KFC가 노출되는 손해가 있었다.
            // 행사가 많은 브랜드를 앞에 두면 데이터가 매일 바뀌어도 자동으로 맞는다.
            const counts = {};
            ALL_DEALS.forEach((d) => { counts[d.brand] = (counts[d.brand] || 0) + 1; });
            let inline = EVENT_BRANDS.filter((b) => counts[b]).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
            if (inline.length === 0) inline = EVENT_BRANDS.slice(0, 6); // 로드 실패 등으로 건수를 모를 때
            // 모달에서 인라인 밖의 브랜드를 선택하면 마지막 칩을 교체해 선택 상태가 보이게 한다.
            if (activeBrand !== 'ALL' && !inline.includes(activeBrand)) {
                inline = [...inline.slice(0, inline.length - 1), activeBrand];
            }
            const chipHtml = (b) => {
                const active = activeBrand === b ? 'active' : 'bg-white border-gray-200 text-gray-600';
                // 건수를 함께 보여주면 어디에 볼 게 많은지 스캔 없이 바로 판단된다.
                const n = counts[b] || 0;
                const label = `${BRAND_INFO[b].emoji} ${BRAND_INFO[b].text}${n ? ` <span class="opacity-60">${n}</span>` : ''}`;
                return `<button onclick="setBrand('${b}')" class="brand-btn ${active} px-2.5 py-1.5 rounded-full border text-[12px] font-bold whitespace-nowrap shrink-0">${label}</button>`;
            };
            // 두 줄에 3개씩. 각 줄이 '브랜드'/'카테고리' 버튼과 폭을 나눠 쓰므로 3개가 상한이다.
            container.innerHTML = inline.slice(0, 3).map(chipHtml).join('');
            document.getElementById('brandContainer2').innerHTML = inline.slice(3, 6).map(chipHtml).join('');
        }

        // 카테고리는 칩 줄을 브랜드 2번째 줄에 내주고 버튼 하나로 줄었다.
        // 대신 선택 중인 카테고리를 버튼 라벨과 색으로 드러내야 지금 무엇으로 걸러져 있는지 알 수 있다.
        function renderCategories() {
            const btn = document.getElementById('categoryBtn');
            const text = document.getElementById('categoryBtnText');
            const on = activeCategory !== 'ALL';
            text.textContent = on ? activeCategory : '카테고리';
            btn.className = `shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[12px] font-bold ${on ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-200 bg-gray-50 text-gray-600'}`;
            btn.setAttribute('aria-label', on ? `카테고리 필터: ${activeCategory}. 눌러서 변경` : '카테고리 선택');
        }

        // '전체' 칩을 없앤 대신, 활성 칩을 다시 누르면 전체(ALL)로 돌아가는 토글로 동작한다.
        function setBrand(b) { activeBrand = (activeBrand === b) ? 'ALL' : b; renderBrands(); renderDeals(); }
        function setCategory(c) { activeCategory = (activeCategory === c) ? 'ALL' : c; renderCategories(); renderDeals(); }

        function ddayText(daysLeft) {
            // 종료일을 2099년 등으로 멀리 박아둔 "상시" 성격의 이벤트까지 포함하므로
            // 180일 넘게 남은 건 사실상 상시 이벤트로 취급한다.
            if (daysLeft === null || daysLeft === undefined || daysLeft > 180) return { text: '상시', cls: 'bg-gray-100 text-gray-500' };
            if (daysLeft <= 0) return { text: '오늘마감', cls: 'bg-red-500 text-white' };
            if (daysLeft <= 3) return { text: `D-${daysLeft}`, cls: 'bg-red-100 text-red-600' };
            if (daysLeft <= 7) return { text: `D-${daysLeft}`, cls: 'bg-orange-100 text-orange-600' };
            return { text: `D-${daysLeft}`, cls: 'bg-gray-100 text-gray-500' };
        }

        // 카테고리별 이모지 배지 - 이미지 없는 카드에서 시각적 구분을 대신한다.
        const CATEGORY_BADGE = {
            '신메뉴': '🆕', '시간대 특가': '⏰', '세트･콤보': '🍔', '배달': '🛵',
            '멤버십･앱': '📱', '쿠폰･할인': '💰', '메뉴소식': '📣',
        };

        // 카테고리 배지 + 제목 키워드로 파생한 배지 1개(경품/할인/1+1)까지 최대 2개.
        function dealBadges(d) {
            const badges = [`${CATEGORY_BADGE[d.category] || '🍽️'} ${d.category}`];
            if (/1\s*\+\s*1/.test(d.title)) badges.push('🎉 1+1');
            else if (/경품|응모|추첨|증정|받자/.test(d.title)) badges.push('🎁 경품');
            else if (d.category !== '쿠폰･할인' && /할인|특가|쿠폰|[0-9,]{3,}원/.test(d.title)) badges.push('💰 할인');
            return badges;
        }

        // 브랜드별 시그니처 메뉴 이모지 - 떠오르는 애니메이션을 브랜드마다 차별화한다.
        const BRAND_FLOAT = {
            'MCDONALDS':     ['🍟', '🍔', '🥤'],
            'KFC':           ['🍗', '🍟', '🥤'],
            'LOTTERIA':      ['🍔', '🍟', '🥤'],
            'MOMSTOUCH':     ['🍗', '🍔', '🥤'],
            'FRANKBURGER':   ['🍔', '🌭', '🍟'],
            'SHAKESHACK':    ['🥤', '🍔', '🍦'],
            'SUBWAY':        ['🥪', '🥬', '🧀'],
            'BURGERKING':    ['👑', '🍔', '🔥'],
            'NOBRANDBURGER': ['🍔', '🍟', '🥤'],
        };

        // 브랜드마다 기억에 남는 대표 모션 요소 1개 (불꽃/빛/흔들림/펑).
        const BRAND_MOTION = {
            'MCDONALDS':     { e: '✨', cls: 'sig-twinkle' },
            'KFC':           { e: '🔥', cls: 'sig-flicker' },
            'LOTTERIA':      { e: '✨', cls: 'sig-twinkle' },
            'MOMSTOUCH':     { e: '💥', cls: 'sig-pop' },
            'FRANKBURGER':   { e: '🔥', cls: 'sig-flicker' },
            'SHAKESHACK':    { e: '❄️', cls: 'sig-sway' },
            'SUBWAY':        { e: '🥬', cls: 'sig-sway' },
            'BURGERKING':    { e: '🔥', cls: 'sig-flicker' },
            'NOBRANDBURGER': { e: '✨', cls: 'sig-twinkle' },
        };

        // 배달 행사는 세로 중앙을 가로지르는 스쿠터 씬으로 표현하므로, 배달 매칭은 여기서 제외한다.
        const DELIVERY_RE = /배달|배민|쿠팡이츠|요기요|땡겨요|딜리버리/;

        // 제목에서 큰 딜 문구를 뽑아 밴드의 시선 초점으로 쓴다. 못 뽑으면 null(=메뉴 소식형 카드).
        function dealHeadline(d) {
            const t = d.title;
            let m;
            if (/1\s*\+\s*1|원\s*플러스/.test(t)) return '1+1';
            if (/2\s*\+\s*1/.test(t)) return '2+1';
            if (m = t.match(/([0-9][0-9,]{1,7})\s*원\s*(?:할인|세일|다운|↓)/i)) return m[1] + '원 할인';
            if (m = t.match(/(?:할인|세일)\s*([0-9][0-9,]{1,7})\s*원/i)) return m[1] + '원 할인';
            if (m = t.match(/([1-9][0-9]?)\s*%\s*(?:할인|off|세일)/i)) return m[1] + '% 할인';
            if (m = t.match(/([0-9][0-9,]{2,6})\s*원\s*(?:부터|~|from)/i)) return m[1] + '원~';
            if (/무료배달|배달비\s*무료|무료\s*배달/.test(t)) return '배달 무료';
            if (/무료|증정|공짜/.test(t)) return '증정';
            if (/쿠폰/.test(t)) return '쿠폰';
            if (/출시|신메뉴|신제품|NEW/i.test(t)) return 'NEW';
            // 딜 문구가 없으면 카테고리 기반 문구로 초점을 준다 (혜택 과장 없이 정직하게).
            const CAT_HL = {
                '신메뉴': '신메뉴', '세트･콤보': '세트 메뉴', '시간대 특가': '타임 특가',
                '배달': '배달 행사', '멤버십･앱': '앱 전용', '쿠폰･할인': '할인 행사', '메뉴소식': '메뉴 소식',
            };
            return CAT_HL[d.category] || '진행중';
        }

        // 행사 유형을 나타내는 힌트 이모지 1개(있으면). 브랜드 시그니처 사이에 섞어 딜 성격을 드러낸다.
        function dealAccentEmoji(d) {
            if (/1\s*\+\s*1|원\s*플러스/.test(d.title)) return '🎉';
            if (/경품|응모|추첨|증정|받자|당첨/.test(d.title)) return '🎁';
            if (d.category === '쿠폰･할인' || /할인|특가|세일|쿠폰|[0-9,]{3,}원/.test(d.title)) return '💰';
            if (/신메뉴|신제품|출시|NEW/i.test(d.title)) return '🆕';
            return null;
        }

        // 배달 행사용 스쿠터 씬. size는 스쿠터 이모지 크기(px).
        function deliverySceneHtml(size) {
            return `<svg class="scene-road" height="14" viewBox="0 0 300 14" preserveAspectRatio="none"><line x1="0" y1="7" x2="300" y2="7" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-dasharray="8 6"/></svg>
                    <span class="scene-scooter" style="animation-duration:3s"><span style="font-size:${size}px">🛵</span></span>`;
        }

        // 밴드에서 떠오르는 이모지 3개: 브랜드 시그니처를 기본으로, 가운데에 딜 힌트를 섞는다.
        function dealFloatEmojis(d, brandEmoji) {
            const sig = BRAND_FLOAT[d.brand] || [brandEmoji, brandEmoji, brandEmoji];
            const accent = dealAccentEmoji(d);
            return accent ? [sig[0], accent, sig[2]] : sig;
        }

        // 카드 하단에 붙는 사람 친화형 상태 문구. D-day 배지(D-3)를 문장으로 풀어준다.
        function dealStatusText(d) {
            if (d.daysLeft === null || d.daysLeft === undefined || d.daysLeft > 180) return null; // 상시는 배지로 충분
            if (d.daysLeft <= 0) return { t: '오늘 종료', cls: 'text-red-500' };
            const now = new Date();
            const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            if (d.startDate === todayIso) return { t: '오늘 시작', cls: 'text-blue-500' };
            return { t: `${d.daysLeft}일 남음`, cls: d.daysLeft <= 3 ? 'text-red-500' : 'text-gray-400' };
        }

        // 공식 프로모션 배너 대신 자체 제작 브랜드 비주얼 밴드를 쓴다 (저작권·심사 리스크 회피).
        // isHero: 목록 첫 카드는 등장 모션·반짝임으로 시선을 잡는 히어로로 렌더한다.
        function dealCardHtml(d, isHero) {
            const b = BRAND_INFO[d.brand] || { text: d.brand, emoji: '🍽️', bg: 'bg-gray-100', color: 'text-gray-600', grad: 'from-gray-400 to-gray-600' };
            const dday = ddayText(d.daysLeft);
            const liked = likedIds.has(dealKey(d));
            const period = d.startDate && d.endDate ? `${d.startDate.slice(5).replace('-', '.')} ~ ${d.endDate.slice(5).replace('-', '.')}` : '상시 진행';
            const bs = dealBadges(d); // [카테고리(은은), 딜유형(강조)?]
            const hl = dealHeadline(d); // 큰 딜 문구 (없으면 메뉴 소식형 카드)
            return `
            <div class="deal-card ${isHero ? 'hero-card' : ''} bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer" onclick="openDetail('${dealKey(d)}')">
                <div class="band-flow relative w-full h-28 bg-gradient-to-br ${b.grad} overflow-hidden">
                    <span class="band-shimmer"></span>
                    ${isHero ? '<span class="hero-glow"></span>' : ''}
                    <span class="absolute -right-1 -bottom-5 text-[80px] opacity-20 -rotate-12 select-none pointer-events-none">${b.emoji}</span>
                    ${(() => { const fe = dealFloatEmojis(d, b.emoji); return `
                    <span class="banner-float text-[23px]" style="left:12%;bottom:4px;animation-duration:2.8s;animation-delay:0s">${fe[0]}</span>
                    <span class="banner-float text-[18px]" style="left:45%;bottom:7px;animation-duration:3.4s;animation-delay:1.1s">${fe[1]}</span>
                    <span class="banner-float text-[20px]" style="left:76%;bottom:2px;animation-duration:2.5s;animation-delay:0.6s">${fe[2]}</span>`; })()}
                    ${DELIVERY_RE.test(d.title) && !hl ? deliverySceneHtml(24) : ''}
                    ${BRAND_MOTION[d.brand] ? `<span class="brand-sig ${BRAND_MOTION[d.brand].cls} text-[20px]" style="top:26%;right:15%">${BRAND_MOTION[d.brand].e}</span>` : ''}
                    ${isHero ? `
                    <span class="spark text-[14px]" style="top:16%;right:12%;animation-delay:0s">✨</span>
                    <span class="spark text-[11px]" style="top:54%;right:26%;animation-delay:0.5s">✨</span>
                    <span class="spark text-[12px]" style="top:30%;left:46%;animation-delay:0.95s">✨</span>` : ''}
                    ${hl ? `<div class="absolute inset-0 flex items-center pointer-events-none"><span class="deal-headline ml-3.5 text-white font-black ${isHero ? 'text-[30px]' : 'text-[22px]'} leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">${hl}</span></div>` : ''}
                    <div class="absolute top-2.5 left-3 flex items-center gap-1.5">
                        <span class="text-white font-black text-[15px] drop-shadow-sm">${b.emoji} ${b.text}</span>
                        ${d.isNew ? '<span class="bg-white text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded">NEW</span>' : ''}
                    </div>
                    <div class="absolute bottom-2.5 left-3 flex items-center gap-1.5">
                        ${!hl && bs[1] ? `<span class="deal-pop bg-white text-red-600 text-[11px] font-black px-2 py-0.5 rounded-full shadow-md">${bs[1]}</span>` : ''}
                        <span class="bg-white/25 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">${bs[0]}</span>
                    </div>
                    <span class="absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${dday.cls} shadow-sm">${dday.text}</span>
                    <button onclick="event.stopPropagation(); toggleLike('${dealKey(d)}')" class="heart-btn ${liked ? 'liked' : ''} absolute bottom-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow"><i class="fa-regular fa-heart text-gray-400 text-xs"></i></button>
                </div>
                <div class="px-3.5 pt-3.5 pb-3">
                    <p class="text-[15px] font-black text-gray-900 leading-normal line-clamp-2 tracking-tight">${d.title}</p>
                    <div class="flex items-center justify-between mt-2.5">
                        <p class="text-[10px] text-gray-400 font-medium"><i class="fa-regular fa-clock mr-1"></i>${period}</p>
                        ${(() => { const s = dealStatusText(d); return s ? `<span class="text-[10px] font-bold ${s.cls}">⏰ ${s.t}</span>` : ''; })()}
                    </div>
                </div>
            </div>`;
        }

        function getFiltered() {
            return ALL_DEALS.filter((d) =>
                (activeBrand === 'ALL' || d.brand === activeBrand) &&
                (activeCategory === 'ALL' || d.category === activeCategory) &&
                (!newOnly || d.isNew) &&
                (!endingOnly || (d.daysLeft !== null && d.daysLeft <= 0)) &&
                (!sinceOnly || sinceLastVisitKeys.has(dealKey(d)))
            );
        }

        function renderDeals() {
            const list = document.getElementById('dealList');
            const empty = document.getElementById('emptyState');
            const filtered = getFiltered();
            if (filtered.length === 0) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                empty.classList.add('flex');
                return;
            }
            empty.classList.add('hidden');
            empty.classList.remove('flex');
            // 맨 앞(상단 대표) 카드를 히어로로: 광원·반짝임·등장 모션으로 시선을 먼저 잡는다.
            list.innerHTML = filtered.map((d, i) => dealCardHtml(d, i === 0)).join('');
            observeCards();
        }

        // 뷰포트에 들어온 카드만 .in-view를 붙여 애니메이션을 돌린다 (오프스크린 카드는 일시정지).
        let cardObserver = null;
        // 스크롤 깊이 계측. 체류 34초가 "못 찾고 이탈"인지 "빠르게 훑고 찾음"인지 지금은 구분할 수 없다.
        // 몇 번째 카드까지 봤는지를 구간으로 남기면 카드 크기·첫 화면·재방문 중 무엇이 병목인지 갈린다.
        // 값을 파라미터로만 보내면 콘솔이 파라미터 분포를 못 보여줄 때 무용지물이라 이벤트 이름에 구간을 넣는다.
        // 구간에 처음 도달할 때 한 번씩만 보내므로 세션당 최대 4건이고, 종료 시점 이벤트에 의존하지 않는다.
        let maxCardSeen = 0;
        const sentDepthBuckets = new Set();

        // 스크롤 없이도 카드 3장이 보이므로, 4장째부터가 "실제로 스크롤했다"는 신호다.
        function depthBucket(n) {
            if (n <= 3) return '1_3';   // 첫 화면에서 멈춤
            if (n <= 8) return '4_8';
            if (n <= 20) return '9_20';
            return '21up';              // 끝까지 탐색
        }

        function noteCardSeen(index) {
            if (index <= maxCardSeen) return;
            maxCardSeen = index;
            const bucket = depthBucket(index);
            if (sentDepthBuckets.has(bucket)) return;
            sentDepthBuckets.add(bucket);
            window.tossLog?.('impression', { log_name: `scroll_depth_${bucket}`, max_card: index });
        }

        function observeCards() {
            if (!cardObserver) {
                cardObserver = new IntersectionObserver((entries) => {
                    // 애니메이션용 rootMargin(120px)은 화면 밖 카드까지 잡으므로 계측에 그대로 쓰면
                    // 스크롤을 안 해도 깊이가 부풀려진다. 실제 목록 영역 하단을 기준으로 한 번 더 거른다.
                    const foldBottom = document.getElementById('dealListArea').getBoundingClientRect().bottom;
                    for (const e of entries) {
                        e.target.classList.toggle('in-view', e.isIntersecting);
                        if (e.isIntersecting && e.boundingClientRect.top < foldBottom) {
                            noteCardSeen(Number(e.target.dataset.i) + 1);
                        }
                    }
                }, { rootMargin: '120px 0px' });
            } else {
                cardObserver.disconnect();
            }
            document.querySelectorAll('#dealList .deal-card').forEach((c, i) => {
                c.dataset.i = i;
                cardObserver.observe(c);
            });
        }

        function toggleLike(key) {
            const wasLiked = likedIds.has(key);
            // 찜은 재방문 의사의 가장 강한 신호라 추가/해제를 나눠 본다.
            window.tossLog?.('click', { log_name: 'deal_like', brand: key.split(':')[0], liked: !wasLiked });
            if (wasLiked) likedIds.delete(key); else likedIds.add(key);
            saveLiked();
            renderDeals();
            renderLikedList();
            updateAlertBanners();
            if (!wasLiked) maybePromptNotifOnLike(); // 찜 추가 = 관심 최고조 시점 → 알림 동의 유도
        }

        // 찜을 처음 누른 순간(관심이 가장 높은 시점)에 알림 동의를 딱 한 번 요청한다.
        // 설정 메뉴에 묻어둔 것보다 이 타이밍이 동의율이 훨씬 높다.
        const NOTIF_PROMPTED_KEY = 'ff_notif_prompted';
        function maybePromptNotifOnLike() {
            if (localStorage.getItem(NOTIF_PROMPTED_KEY)) return;
            if (!document.body.classList.contains('in-toss-app') || !window.tossRequestNotificationAgreement) return;
            localStorage.setItem(NOTIF_PROMPTED_KEY, '1');
            window.tossRequestNotificationAgreement()
                .then(() => showToast('마감·새 행사 알림을 보내드릴게요!'))
                .catch(() => {});
        }

        // 1,324명 중 첫 주에 돌아온 사람이 최대 82명뿐이라, 다시 열 이유를 만들 장치가 필요하다.
        // 다만 첫 세션을 다시 방해하면 본전이므로 화면을 막지 않는 토스트로, 찜이 하나도 없을 때 딱 한 번만 띄운다.
        const LIKE_HINT_KEY = 'ff_like_hint';
        function maybeHintLike() {
            if (likedIds.size > 0) return;
            try {
                if (localStorage.getItem(LIKE_HINT_KEY)) return;
                localStorage.setItem(LIKE_HINT_KEY, '1');
            } catch (e) {
                return; // 저장이 안 되면 매번 뜨게 되므로 아예 띄우지 않는다.
            }
            showToast('하트를 누르면 찜 목록에 모아둘 수 있어요');
        }

        function findDeal(key) {
            return ALL_DEALS.find((d) => dealKey(d) === key);
        }

        function openDetail(key) {
            const d = findDeal(key);
            if (!d) return;
            window.tossLog?.('click', { log_name: 'deal_detail', brand: d.brand, category: d.category, is_new: !!d.isNew });
            maybeHintLike();
            window.onAdTrigger?.('detail'); // 행사 상세보기 - 빈도 낮게 제한
            const b = BRAND_INFO[d.brand] || { text: d.brand, emoji: '🍽️' };
            const dday = ddayText(d.daysLeft);
            const period = d.startDate && d.endDate ? `${d.startDate} ~ ${d.endDate}` : '상시 진행';
            const hl = dealHeadline(d);
            document.getElementById('detailContent').innerHTML = `
                <div class="band-flow relative w-full h-32 bg-gradient-to-br ${b.grad || 'from-gray-400 to-gray-600'} overflow-hidden">
                    <span class="band-shimmer"></span>
                    <span class="absolute -right-2 -bottom-8 text-[110px] opacity-25 -rotate-12 select-none pointer-events-none">${b.emoji}</span>
                    ${(() => { const fe = dealFloatEmojis(d, b.emoji); return `
                    <span class="banner-float text-[26px]" style="left:20%;bottom:6px;animation-duration:2.8s;animation-delay:0s">${fe[0]}</span>
                    <span class="banner-float text-[20px]" style="left:48%;bottom:8px;animation-duration:3.4s;animation-delay:1.1s">${fe[1]}</span>
                    <span class="banner-float text-[22px]" style="left:70%;bottom:4px;animation-duration:2.5s;animation-delay:0.6s">${fe[2]}</span>`; })()}
                    ${DELIVERY_RE.test(d.title) && !hl ? deliverySceneHtml(32) : ''}
                    ${hl ? `<span class="deal-headline detail-pop absolute top-4 left-5 text-white font-black text-[36px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">${hl}</span>` : ''}
                    <span class="absolute bottom-4 left-5 text-white font-black ${hl ? 'text-base opacity-90' : 'text-2xl'} drop-shadow-sm">${b.emoji} ${b.text}</span>
                    <button onclick="closeDetailSheet()" class="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${b.bg} ${b.color}">${b.emoji} ${b.text}</span>
                        ${dealBadges(d).map((t) => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">${t}</span>`).join('')}
                    </div>
                    <h2 class="text-lg font-black mt-2 leading-snug">${d.title}</h2>
                    <p class="text-xs text-gray-500 mt-2"><i class="fa-regular fa-clock mr-1"></i>${period} <span class="ml-1 px-1.5 py-0.5 rounded ${dday.cls} font-bold">${dday.text}</span></p>
                    <div class="grid grid-cols-2 gap-2 mt-5">
                        <button onclick="toggleLike('${dealKey(d)}'); openDetail('${dealKey(d)}')" class="py-3 rounded-xl font-bold text-sm border ${likedIds.has(dealKey(d)) ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-600'}"><i class="fa-solid fa-heart mr-1"></i>${likedIds.has(dealKey(d)) ? '찜 완료' : '찜하기'}</button>
                        <button onclick="shareDeal('${dealKey(d)}')" class="py-3 rounded-xl font-bold text-sm bg-gray-50 border border-gray-200 text-gray-600"><i class="fa-solid fa-share-nodes mr-1"></i>공유하기</button>
                    </div>
                    <a href="${d.link}" target="_blank" rel="noopener" class="block text-center mt-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow"><i class="fa-solid fa-arrow-up-right-from-square mr-1.5 text-xs"></i>공식 이벤트 보기</a>
                    <div class="mt-4 bg-gray-50 rounded-xl p-3.5">
                        <p class="text-[11px] font-bold text-gray-600 mb-1.5"><i class="fa-solid fa-circle-info mr-1 text-gray-400"></i>행사 안내</p>
                        <ul class="text-[11px] text-gray-500 leading-relaxed flex flex-col gap-0.5">
                            <li>· 일부 매장에서는 행사가 적용되지 않을 수 있어요.</li>
                            <li>· 행사 내용과 기간은 브랜드 사정에 따라 변경될 수 있어요.</li>
                            <li>· 최신 정보는 공식 이벤트 페이지에서 확인해 주세요.</li>
                        </ul>
                    </div>
                </div>`;
            document.getElementById('detailSheetBg').classList.add('active');
            document.getElementById('detailSheet').classList.add('active');
        }

        function closeDetailSheet() {
            document.getElementById('detailSheetBg').classList.remove('active');
            document.getElementById('detailSheet').classList.remove('active');
        }

        // ===== 통합 검색 (카페행사맵 이식 - 초성 검색 지원) =====
        const QUICK_SEARCH = ['1+1', '할인', '신메뉴', '버거', '치킨', '아이스', '배달', '세트'];

        // 한글 문자열을 초성 문자열로 변환 (예: '버거킹' -> 'ㅂㄱㅋ'). 비한글 문자는 그대로 둔다.
        const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        function toChosung(str) {
            let out = '';
            for (const ch of str) {
                const code = ch.charCodeAt(0);
                if (code >= 0xAC00 && code <= 0xD7A3) out += CHOSUNG[Math.floor((code - 0xAC00) / 588)];
                else out += ch;
            }
            return out;
        }

        function matchSearch(d, q) {
            const b = BRAND_INFO[d.brand] || { text: d.brand };
            const target = `${d.title} ${b.text} ${d.brand} ${d.category}`.toLowerCase();
            const query = q.toLowerCase().trim();
            if (target.includes(query)) return true;
            // 질의가 전부 초성이면 초성 매칭도 시도 (ㅂㄱ -> 버거)
            if (/^[ㄱ-ㅎ]+$/.test(query)) return toChosung(target).includes(query);
            return false;
        }

        function openSearchSheet(prefill) {
            document.getElementById('quickSearchChips').innerHTML = QUICK_SEARCH.map((k) =>
                `<button onclick="quickSearch('${k}')" class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold">${k}</button>`
            ).join('');
            const input = document.getElementById('searchInput');
            input.value = typeof prefill === 'string' ? prefill : '';
            performSearch();
            document.getElementById('searchSheetBg').classList.add('active');
            document.getElementById('searchSheet').classList.add('active');
            if (!input.value) setTimeout(() => input.focus(), 250);
        }
        function closeSearchSheet() {
            document.getElementById('searchSheetBg').classList.remove('active');
            document.getElementById('searchSheet').classList.remove('active');
        }
        function quickSearch(k) {
            document.getElementById('searchInput').value = k;
            performSearch();
        }
        function performSearch() {
            const q = document.getElementById('searchInput').value.trim();
            const box = document.getElementById('searchResults');
            if (!q) {
                box.innerHTML = `<div class="text-center text-gray-400 text-xs py-16"><span class="text-4xl block mb-3">🔍</span>행사명, 브랜드, 카테고리로 검색해보세요<br>초성 검색도 돼요 (ㅂㄱ → 버거)</div>`;
                return;
            }
            const hits = ALL_DEALS.filter((d) => matchSearch(d, q));
            box.innerHTML = hits.length
                ? `<p class="text-[11px] font-bold text-gray-400">검색 결과 ${hits.length}건</p>` + hits.map(dealCardHtml).join('')
                : `<div class="text-center text-gray-400 text-xs py-16"><span class="text-4xl block mb-3">🤔</span>'${q}' 검색 결과가 없어요</div>`;
        }

        // ===== 날씨 기반 행사 추천 (카페행사맵 이식 - Open-Meteo, 키 불필요) =====
        // 서울시청 기준 현재 날씨로 상황 추천 칩을 1개 띄운다. 실패 시 조용히 생략.
        async function fetchWeatherChip() {
            try {
                const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,weather_code,precipitation&timezone=Asia%2FSeoul');
                const j = await r.json();
                const t = j.current?.temperature_2m;
                const code = j.current?.weather_code ?? 0;
                const prec = j.current?.precipitation || 0;
                if (t === undefined) return;

                let rec = null;
                if (prec > 0 || code >= 51) {
                    rec = { label: '☔ 비 오는 날엔 배달 행사 어때요?', act: () => { activeCategory = '배달'; renderCategories(); renderDeals(); closeSearchSheet(); switchTab('events'); } };
                } else if (t >= 28) {
                    rec = { label: `🥵 ${Math.round(t)}°C 무더위, 시원한 메뉴 찾기`, act: () => openSearchSheet('아이스') };
                } else if (t <= 5) {
                    rec = { label: `🥶 ${Math.round(t)}°C, 따뜻한 세트 어때요?`, act: () => { activeCategory = '세트･콤보'; renderCategories(); renderDeals(); switchTab('events'); } };
                }
                if (!rec) return;

                window._weatherAct = rec.act;
                document.getElementById('weatherBannerText').textContent = rec.label;
                document.getElementById('weatherBanner').className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-700';
                syncAlertBannersPad();
            } catch (e) { /* 날씨는 부가 기능 - 실패해도 아무것도 하지 않음 */ }
        }

        function openLikedSheet() {
            renderLikedList();
            document.getElementById('likedSheetBg').classList.add('active');
            document.getElementById('likedSheet').classList.add('active');
        }
        function closeLikedSheet() {
            document.getElementById('likedSheetBg').classList.remove('active');
            document.getElementById('likedSheet').classList.remove('active');
        }

        function renderLikedList() {
            const container = document.getElementById('likedList');
            const items = ALL_DEALS.filter((d) => likedIds.has(dealKey(d)));
            if (items.length === 0) {
                container.innerHTML = `<div class="text-center text-gray-400 text-xs py-16"><span class="text-4xl block mb-3">🤍</span>마음에 드는 행사를 찜해보세요</div>`;
                return;
            }
            container.innerHTML = items.map(dealCardHtml).join('');
        }

        // 공유 링크를 눌러 앱으로 돌아오면 이 특정 행사가 바로 열리도록(재방문 전환율 개선).
        // intoss:// 스킴은 토스 앱이 설치되어 있을 때만 열리므로, 텍스트에 안내 문구도 함께 남긴다.
        function dealDeepLink(d) {
            return `intoss://${APP_NAME}?deal=${encodeURIComponent(dealKey(d))}`;
        }

        function shareText(d) {
            const b = BRAND_INFO[d.brand] || { text: d.brand };
            return `🍔 ${b.text} 행사 발견!\n[${d.title}]\n\n📱 패스트푸드 행사 앱에서 확인하세요!\n${dealDeepLink(d)}`;
        }

        function shareDeal(key) {
            const d = findDeal(key);
            if (!d) return;
            const message = shareText(d);
            // 공유는 유일한 유기적 유입 경로라 별도로 본다.
            window.tossLog?.('click', { log_name: 'deal_share', brand: d.brand });
            if (document.body.classList.contains('in-toss-app') && window.tossShare) {
                window.tossShare(message).catch(() => {});
            } else if (navigator.share) {
                navigator.share({ title: '패스트푸드 행사', text: message }).catch(() => {});
            } else {
                navigator.clipboard?.writeText(message);
                alert('공유 문구를 클립보드에 복사했어요!');
            }
        }

        function shareWishlist() {
            const items = ALL_DEALS.filter((d) => likedIds.has(dealKey(d)));
            if (items.length === 0) { showToast?.('찜한 행사가 없어요') ?? alert('찜한 행사가 없어요'); return; }
            const lines = items.map((d) => {
                const b = BRAND_INFO[d.brand] || { text: d.brand };
                return `· [${b.text}] ${d.title}`;
            });
            const message = `🛍️ 찜한 행사 목록 (${items.length}개)\n${lines.join('\n')}\n\n📱 패스트푸드 행사 앱에서 확인하세요!`;
            if (document.body.classList.contains('in-toss-app') && window.tossShare) {
                window.tossShare(message).catch(() => {});
            } else if (navigator.share) {
                navigator.share({ title: '찜한 행사 목록', text: message }).catch(() => {});
            } else {
                navigator.clipboard?.writeText(message);
                alert('찜 목록을 클립보드에 복사했어요!');
            }
        }

        // ===== 탭 전환 =====
        function switchTab(name) {
            const isEvents = name === 'events';
            document.getElementById('panel-events').classList.toggle('hidden', !isEvents);
            document.getElementById('panel-map').classList.toggle('hidden', isEvents);
            document.getElementById('panel-map').parentElement.scrollTop = 0;
            document.getElementById('panel-map').classList.toggle('flex', !isEvents);
            document.getElementById('navBtnEvents').classList.toggle('active', isEvents);
            document.getElementById('navBtnMap').classList.toggle('active', !isEvents);
            if (!isEvents) {
                window.tossLog?.('click', { log_name: 'tab_map' });
                window.onAdTrigger?.('map'); // "지도 보기" 진입 - 광고 우선순위 1순위
                // 탭 전환 직후엔 flex 레이아웃이 아직 최종 크기로 반영되기 전이라
                // Leaflet이 실제보다 작은 크기로 타일을 그리는 문제가 생김.
                // rAF를 두 번 중첩해 레이아웃/페인트가 끝난 다음 프레임에 초기화/재계산한다.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        initMapIfNeeded();
                        if (leafletMap) leafletMap.invalidateSize();
                    });
                });
            }
        }

        // ===== 지도 =====
        let toastTimer = null;
        function showToast(msg, duration = 1800) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.classList.remove('opacity-0', 'pointer-events-none');
            toast.classList.add('opacity-100');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toast.classList.remove('opacity-100');
                toast.classList.add('opacity-0', 'pointer-events-none');
            }, duration);
        }

        function radiusText(r) { return r >= 1000 ? `${r / 1000}km` : `${r}m`; }

        async function loadStores() {
            try {
                const res = await fetch(`${DATA_BASE_URL}stores.json?_=${Date.now()}`);
                ALL_STORES = await res.json();
            } catch (e) {
                ALL_STORES = [];
                console.error('stores.json 로드 실패', e);
            }
            renderMapBrandChips();
        }

        function renderMapBrandChips() {
            const container = document.getElementById('mapBrandContainer');
            // 인라인에는 대표 3개 브랜드만 노출하고, 나머지는 '브랜드' 모달에서 고른다.
            let inline = MAP_BRANDS.slice(0, 3);
            if (mapBrand !== 'ALL' && !inline.includes(mapBrand)) {
                inline = [...inline.slice(0, 2), mapBrand];
            }
            container.innerHTML = inline.map((b) => {
                const active = mapBrand === b ? 'active' : 'bg-white border-gray-200 text-gray-600';
                const label = `${BRAND_INFO[b].emoji} ${BRAND_INFO[b].text}`;
                return `<button onclick="setMapBrand('${b}')" class="brand-btn ${active} px-2.5 py-1.5 rounded-full border text-[12px] font-bold whitespace-nowrap shrink-0">${label}</button>`;
            }).join('');
        }

        function setMapBrand(b) { mapBrand = (mapBrand === b) ? 'ALL' : b; renderMapBrandChips(); loadStoresInRadius(); }

        // ===== 드라이브스루 필터 (카페행사맵의 편의정보 필터 이식 - 매장명 DT 패턴 추론) =====
        // 별도 편의정보 데이터 없이 매장명 관례(맥도날드 XXDT점, 버거킹 XX DT점 등)로 판별한다.
        let mapDtOnly = false;
        function isDriveThrough(s) { return /DT|드라이브\s?스루|드라이빙\s?스루/i.test(s.name); }
        function toggleDtOnly() {
            mapDtOnly = !mapDtOnly;
            const btn = document.getElementById('dtToggleBtn');
            btn.className = mapDtOnly
                ? 'bg-gray-900 px-3 py-1.5 rounded-full shadow-sm text-[11px] font-bold text-white flex items-center gap-1 active:scale-95 transition'
                : 'bg-white/95 px-3 py-1.5 rounded-full shadow-sm text-[11px] font-bold text-gray-600 flex items-center gap-1 active:scale-95 transition';
            loadStoresInRadius();
            showToast(mapDtOnly ? '드라이브스루(차량 주문) 매장만 표시해요' : '전체 매장을 표시해요');
        }

        async function initMapIfNeeded() {
            if (leafletMap) return;
            const defaultCenter = [37.5665, 126.9780]; // 서울시청 (위치 권한 거부/실패 시 기본값)
            leafletMap = L.map('map', { zoomControl: false }).setView(defaultCenter, 16);

            streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap',
            }).addTo(leafletMap);

            // 브이월드(국토지리정보원) 위성영상 + 라벨 오버레이 (편의점 앱과 동일한 방식)
            satelliteLayer = L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`, {
                attribution: '&copy; VWorld', maxZoom: 19,
            });
            satelliteLabelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png');

            searchCircle = L.circle(defaultCenter, {
                radius: currentRadius, color: '#3b82f6', fillColor: '#3b82f6',
                fillOpacity: 0.05, weight: 2, dashArray: '5, 5',
            }).addTo(leafletMap);

            leafletMap.on('move', () => searchCircle.setLatLng(leafletMap.getCenter()));
            leafletMap.on('dragstart', () => { isUserPanning = true; });
            leafletMap.on('zoomstart', () => { isUserPanning = true; });
            leafletMap.on('moveend', () => {
                if (isUserPanning) { showReSearchBtn(); isUserPanning = false; }
            });

            highlightRadiusButtons(currentRadius);
            await loadStores();
            await locateMe();
        }

        function brandMarkerClass(brand) {
            return {
                MCDONALDS: 'marker-mcdonalds', LOTTERIA: 'marker-lotteria', MOMSTOUCH: 'marker-momstouch',
                FRANKBURGER: 'marker-frankburger', SHAKESHACK: 'marker-shakeshack',
                BURGERKING: 'marker-burgerking', NOBRANDBURGER: 'marker-nobrandburger',
            }[brand] || 'marker-mcdonalds';
        }

        // 반경 원의 중심을 기준으로 그 반경 안에 있는 매장만 걸러서 개별 마커로 그린다.
        // (지도를 옮기는 동안엔 원이 화면 중앙을 따라오기만 하고, 실제 검색은 재검색 버튼을 눌러야 갱신됨)
        function loadStoresInRadius() {
            if (!leafletMap || !searchCircle) return;
            mapMarkers.forEach((m) => leafletMap.removeLayer(m));
            mapMarkers = [];

            const center = searchCircle.getLatLng();
            const filtered = ALL_STORES.filter((s) => {
                if (mapBrand !== 'ALL' && s.brand !== mapBrand) return false;
                if (mapDtOnly && !isDriveThrough(s)) return false;
                return leafletMap.distance(center, [s.lat, s.lng]) <= currentRadius;
            });

            filtered.forEach((s) => {
                const b = BRAND_INFO[s.brand] || { emoji: '🍽️' };
                const dtBadge = isDriveThrough(s) ? '<span class="dt-badge">🚗</span>' : '';
                const icon = L.divIcon({
                    html: `<div class="marker-wrap"><div class="store-marker ${brandMarkerClass(s.brand)}"><span>${b.emoji}</span></div>${dtBadge}</div>`,
                    className: '', iconSize: [30, 30], iconAnchor: [15, 28],
                });
                const marker = L.marker([s.lat, s.lng], { icon }).addTo(leafletMap);
                marker.on('click', () => openStoreSheet(s));
                mapMarkers.push(marker);
            });

            document.getElementById('mapResultBadge').textContent = `반경 ${radiusText(currentRadius)} 내 ${filtered.length}개 매장`;
        }

        function searchInCurrentArea() {
            hideReSearchBtn();
            loadStoresInRadius();
            showToast(`반경 ${radiusText(currentRadius)} 내에서 다시 찾았어요`);
        }

        function showReSearchBtn() {
            const btn = document.getElementById('reSearchBtn');
            btn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
            btn.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }
        function hideReSearchBtn() {
            const btn = document.getElementById('reSearchBtn');
            btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
            btn.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }

        function highlightRadiusButtons(r) {
            RADIUS_STEPS.forEach((val) => {
                document.getElementById(`rad${val}`).classList.toggle('active', val === r);
            });
        }

        function setRadius(r) {
            currentRadius = r;
            highlightRadiusButtons(r);
            searchCircle.setRadius(r);
            leafletMap.flyToBounds(searchCircle.getBounds(), { padding: [20, 20], duration: 0.5 });
            setTimeout(() => {
                hideReSearchBtn(); // flyToBounds 애니메이션도 이동 이벤트를 발생시켜 재검색 버튼이 뜰 수 있어 다시 숨김
                loadStoresInRadius();
                showToast(`검색 반경이 ${radiusText(r)}로 변경되었습니다.`);
            }, 600);
        }

        function applySatelliteView(on) {
            isSatelliteView = on;
            if (on) {
                leafletMap.removeLayer(streetLayer);
                satelliteLayer.addTo(leafletMap);
                satelliteLabelLayer.addTo(leafletMap); // 위성 위에 도로명/지명 라벨 겹치기
            } else {
                leafletMap.removeLayer(satelliteLayer);
                leafletMap.removeLayer(satelliteLabelLayer);
                streetLayer.addTo(leafletMap);
            }
            document.getElementById('satelliteToggleBtn').classList.toggle('active', on);
        }

        function toggleSatelliteView() { applySatelliteView(!isSatelliteView); }

        // ===== 지역/주소 검색 (VWorld 검색 API, CORS 차단으로 JSONP 사용) =====
        function vworldJsonp(url) {
            return new Promise((resolve) => {
                const cbName = `vworldCb${Date.now()}${Math.floor(Math.random() * 1e6)}`;
                const cleanup = () => { delete window[cbName]; script.remove(); };
                const timer = setTimeout(() => { cleanup(); resolve(null); }, 5000);
                window[cbName] = (json) => { clearTimeout(timer); cleanup(); resolve(json); };
                const script = document.createElement('script');
                script.src = `${url}&callback=${cbName}`;
                script.onerror = () => { clearTimeout(timer); cleanup(); resolve(null); };
                document.body.appendChild(script);
            });
        }

        let locationSearchTimer = null;
        function openLocationSearch() {
            document.getElementById('locationSearchResults').innerHTML = '';
            document.getElementById('locationSearchBg').classList.add('active');
            document.getElementById('locationSearchSheet').classList.add('active');
            setTimeout(() => document.getElementById('locationSearchInput').focus(), 100);
        }
        function closeLocationSearch() {
            document.getElementById('locationSearchBg').classList.remove('active');
            document.getElementById('locationSearchSheet').classList.remove('active');
            document.getElementById('locationSearchInput').value = '';
        }

        function handleLocationSearchInput() {
            clearTimeout(locationSearchTimer);
            locationSearchTimer = setTimeout(runLocationSearch, 400);
        }

        function renderLocationSearchResults(items) {
            const container = document.getElementById('locationSearchResults');
            if (items.length === 0) {
                container.innerHTML = `<p class="text-center text-sm text-gray-400 py-10">검색 결과가 없습니다.</p>`;
                return;
            }
            container.innerHTML = items.map((item, i) => `
                <button onclick="selectSearchResult(${i})" class="w-full text-left px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition flex items-start gap-3">
                    <i class="fa-solid ${item.icon} text-gray-400 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-gray-900 truncate">${item.title}</p>
                        <p class="text-xs text-gray-500 truncate mt-0.5">${item.subtitle}</p>
                    </div>
                </button>
            `).join('');
            window._locationSearchResultsData = items;
        }

        async function runLocationSearch() {
            const query = document.getElementById('locationSearchInput').value.trim();
            const container = document.getElementById('locationSearchResults');
            if (!query) { container.innerHTML = ''; return; }
            container.innerHTML = `<p class="text-center text-sm text-gray-400 py-10">검색 중...</p>`;

            const placeJson = await vworldJsonp(`https://api.vworld.kr/req/search?service=search&request=search&version=2.0&query=${encodeURIComponent(query)}&type=place&format=json&key=${VWORLD_KEY}`);
            const placeItems = (placeJson?.response?.status === 'OK' ? placeJson.response.result.items : []).map((p) => ({
                title: p.title.replace(/<[^>]+>/g, ''),
                subtitle: p.address.road || p.address.parcel || p.category,
                lat: parseFloat(p.point.y), lng: parseFloat(p.point.x),
                icon: 'fa-location-dot',
            }));

            const addrJson = await vworldJsonp(`https://api.vworld.kr/req/search?service=search&request=search&version=2.0&query=${encodeURIComponent(query)}&type=address&category=road&format=json&key=${VWORLD_KEY}`);
            const addrItems = (addrJson?.response?.status === 'OK' ? addrJson.response.result.items : []).slice(0, 5).map((a) => ({
                title: a.address.road || a.address.parcel,
                subtitle: a.address.bldnm || '주소',
                lat: parseFloat(a.point.y), lng: parseFloat(a.point.x),
                icon: 'fa-map',
            }));

            renderLocationSearchResults([...placeItems, ...addrItems]);
        }

        function selectSearchResult(index) {
            const item = window._locationSearchResultsData?.[index];
            if (!item) return;
            closeLocationSearch();
            showToast(`'${item.title}' 위치로 이동합니다.`);
            leafletMap.setView([item.lat, item.lng], 16);
            searchCircle.setLatLng([item.lat, item.lng]);
            hideReSearchBtn();
            loadStoresInRadius();
        }

        function openStoreSheet(s) {
            // 매장 시트를 여는 것 자체는 단순 열람이라 광고를 걸지 않음 - 길찾기 클릭 시점(구매의사 최고점)으로 옮김
            const b = BRAND_INFO[s.brand] || { text: s.brand, emoji: '🍽️', bg: 'bg-gray-100', color: 'text-gray-600' };
            const mapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(s.name)},${s.lat},${s.lng}`;
            const eventCount = ALL_DEALS.filter((d) => d.brand === s.brand).length;
            document.getElementById('storeSheetContent').innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${b.bg} ${b.color}">${b.emoji} ${b.text}</span>
                        <h2 class="text-base font-black mt-2">${s.name}</h2>
                        <p class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-location-dot mr-1"></i>${s.address || '주소 정보 없음'}</p>
                    </div>
                    <button onclick="closeStoreSheet()" class="w-8 h-8 flex items-center justify-center text-gray-400 shrink-0"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="grid ${s.phone ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-3">
                    ${s.phone ? `<a href="tel:${s.phone}" class="py-3 rounded-xl font-bold text-sm bg-gray-50 border border-gray-200 text-gray-600 text-center"><i class="fa-solid fa-phone mr-1 text-green-500"></i>전화</a>` : ''}
                    <button onclick="viewBrandEvents('${s.brand}')" class="py-3 rounded-xl font-bold text-sm bg-gray-50 border border-gray-200 text-gray-600"><i class="fa-solid fa-fire mr-1 text-orange-500"></i>행사 ${eventCount}건</button>
                    <a href="${mapUrl}" target="_blank" rel="noopener" onclick="window.tossLog?.('click', { log_name: 'store_navigate', brand: '${s.brand}' }); window.onAdTrigger?.('navigation')" class="py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow text-center"><i class="fa-solid fa-diamond-turn-right mr-1"></i>길찾기</a>
                </div>`;
            document.getElementById('storeSheetBg').classList.add('active');
            document.getElementById('storeSheet').classList.add('active');
        }

        function closeStoreSheet() {
            document.getElementById('storeSheetBg').classList.remove('active');
            document.getElementById('storeSheet').classList.remove('active');
        }

        // 매장 시트의 "행사안내" 버튼 - 그 브랜드로 필터링된 행사 탭으로 바로 이동
        function viewBrandEvents(brand) {
            closeStoreSheet();
            activeBrand = brand;
            activeCategory = 'ALL';
            renderBrands();
            renderCategories();
            renderDeals();
            document.getElementById('dealListArea').scrollTop = 0;
            switchTab('events');
        }

        function getLocation() {
            if (document.body.classList.contains('in-toss-app') && window.tossGetCurrentLocation) {
                // 토스 위치 브릿지는 표준 GeolocationPosition과 동일하게 coords.latitude/longitude로 내려줌
                return window.tossGetCurrentLocation().then((loc) => ({ lat: loc.coords.latitude, lng: loc.coords.longitude }));
            }
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) { reject(new Error('geolocation 미지원')); return; }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => reject(err),
                    { enableHighAccuracy: false, timeout: 8000 }
                );
            });
        }

        async function locateMe() {
            const btn = document.getElementById('locateBtn');
            btn.classList.add('loading');
            btn.querySelector('i').className = 'fa-solid fa-spinner';
            try {
                const { lat, lng } = await getLocation();
                leafletMap.setView([lat, lng], 16);
                searchCircle.setLatLng([lat, lng]);
                hideReSearchBtn();
                loadStoresInRadius();
            } catch (e) {
                // 위치 권한이 없어도 기본 위치(서울시청) 기준으로는 계속 볼 수 있게 함
                loadStoresInRadius();
                showToast('위치 정보를 가져올 수 없어 기본 위치로 표시했어요.');
            } finally {
                btn.classList.remove('loading');
                btn.querySelector('i').className = 'fa-solid fa-location-crosshairs';
            }
        }

        // 토스 미니앱 "기능" 딥링크(intoss://fastfood-event-navi/map) 대응.
        // 화면별로 실제 URL이 나뉘어 있는 구조가 아니라 단일 index.html이라, 진입 시
        // pathname/hash/query 중 어디에 "map"이 실려오든 매장찾기 탭으로 바로 열리게 처리한다.
        function applyDeepLink() {
            const path = location.pathname || '';
            const hash = (location.hash || '').replace('#', '');
            const params = new URLSearchParams(location.search);
            const screen = params.get('screen') || params.get('tab') || '';

            // 공유 링크(예: ?deal=MCDONALDS%3A1010)로 유입된 경우, 그 특정 행사 상세를 바로 연다.
            const dealParam = params.get('deal') || (hash.match(/deal=([^&]+)/) || [])[1];
            if (dealParam) {
                const key = decodeURIComponent(dealParam);
                if (findDeal(key)) { openDetail(key); return; }
            }

            if ([path, hash, screen].some((v) => /map/i.test(v))) {
                switchTab('map');
                return;
            }

            applySearchIntent(params, hash);
        }

        // 유입의 90%가 토스 '검색'이다. 검색어가 넘어온다면 그 브랜드를 미리 골라줘야
        // 34초짜리 세션에서 사용자가 필터를 다시 찾는 비용이 사라진다.
        // 토스가 어떤 파라미터로 넘기는지(혹은 넘기긴 하는지) 확인되지 않아 흔한 이름을 모두 훑고,
        // 아무것도 안 오면 조용히 아무 일도 하지 않는다.
        const BRAND_QUERY_ALIASES = [
            ['MCDONALDS', /맥도날드|맥날|mcdonald/i],
            ['BURGERKING', /버거킹|burger\s?king/i],
            ['NOBRANDBURGER', /노브랜드/i],
            ['LOTTERIA', /롯데리아|lotteria/i],
            ['MOMSTOUCH', /맘스터치|moms/i],
            ['KFC', /\bkfc\b|케이에프씨/i],
            ['SUBWAY', /서브웨이|subway/i],
            ['SHAKESHACK', /쉐이크쉑|쉑쉑|shake\s?shack/i],
            ['FRANKBURGER', /프랭크\s?버거|frank/i],
        ];

        function applySearchIntent(params, hash) {
            const raw = ['q', 'query', 'keyword', 'kw', 'search', 'term']
                .map((k) => params.get(k))
                .find(Boolean) || (hash.match(/(?:q|query|keyword)=([^&]+)/) || [])[1];
            if (!raw) return;

            let text;
            try {
                text = decodeURIComponent(raw);
            } catch (e) {
                text = raw; // 잘못 인코딩된 값이 와도 원문으로 한 번 더 시도한다.
            }

            const hit = BRAND_QUERY_ALIASES.find(([brand, pattern]) => pattern.test(text) && EVENT_BRANDS.includes(brand));
            if (!hit) return;

            activeBrand = hit[0];
            renderBrands();
            renderDeals();
            window.tossLog?.('screen', { log_name: 'search_intent_applied', brand: hit[0] });
        }

        // ===== 브랜드 선택 모달 =====
        // 행사 탭('event')과 매장찾기 탭('map')이 하나의 모달을 공유하되,
        // 열린 컨텍스트에 따라 대상 브랜드 목록과 선택 결과 반영 함수를 달리한다.
        let brandModalContext = 'event';

        function openBrandModal(ctx) {
            brandModalContext = ctx;
            renderBrandModalGrid();
            document.getElementById('brandModalBg').classList.add('active');
        }
        function closeBrandModal() {
            document.getElementById('brandModalBg').classList.remove('active');
        }
        function renderBrandModalGrid() {
            const brands = brandModalContext === 'map' ? MAP_BRANDS : EVENT_BRANDS;
            const active = brandModalContext === 'map' ? mapBrand : activeBrand;

            const allBtn = document.getElementById('brandModalAll');
            allBtn.className = active === 'ALL'
                ? 'w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm mb-3'
                : 'w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm mb-3';

            const grid = document.getElementById('brandModalGrid');
            grid.innerHTML = brands.map((b) => {
                const info = BRAND_INFO[b];
                const cls = active === b
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700';
                return `<button onclick="pickBrand('${b}')" class="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl border ${cls} text-[12px] font-bold">
                    <span class="text-lg leading-none">${info.emoji}</span>
                    <span>${info.text}</span>
                </button>`;
            }).join('');
        }
        function pickBrand(b) {
            if (brandModalContext === 'map') setMapBrand(b);
            else setBrand(b);
            closeBrandModal();
        }

        // ===== 카테고리 선택 모달 =====
        function openCategoryModal() {
            renderCategoryModalGrid();
            document.getElementById('categoryModalBg').classList.add('active');
        }
        function closeCategoryModal() {
            document.getElementById('categoryModalBg').classList.remove('active');
        }
        function renderCategoryModalGrid() {
            const allBtn = document.getElementById('categoryModalAll');
            allBtn.className = activeCategory === 'ALL'
                ? 'w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm mb-3'
                : 'w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm mb-3';

            const grid = document.getElementById('categoryModalGrid');
            grid.innerHTML = CATEGORIES.filter((cat) => cat !== 'ALL').map((cat) => {
                const cls = activeCategory === cat
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700';
                return `<button onclick="pickCategory('${cat}')" class="py-3 rounded-xl border ${cls} text-[12px] font-bold">${cat}</button>`;
            }).join('');
        }
        function pickCategory(c) {
            activeCategory = c; // 모달은 명시적 선택이므로 토글하지 않는다.
            renderCategories();
            renderDeals();
            closeCategoryModal();
        }

        // ===== 설정 / 시작 안내(온보딩) =====
        const ONBOARDING_SEEN_KEY = 'ff_onboarding_seen';

        function openSettings() {
            document.getElementById('settingsBg').classList.add('active');
        }
        function closeSettings() {
            document.getElementById('settingsBg').classList.remove('active');
        }

        function showOnboarding() {
            document.getElementById('onboardingBg').classList.add('active');
        }
        function closeOnboarding() {
            document.getElementById('onboardingBg').classList.remove('active');
            localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
        }
        // 첫 방문자는 전체 트래픽의 91%이고 평균 체류가 34초뿐이라, 시작 안내를 화면을 막는
        // 모달로 띄우면 사용자 가치가 0인 고지에 그 예산을 쓰게 된다. 목록 위 한 줄로 낮춘다.
        function maybeShowFirstNotice() {
            if (localStorage.getItem(ONBOARDING_SEEN_KEY)) return;
            const el = document.getElementById('firstNotice');
            el.classList.remove('hidden');
            el.classList.add('flex');
        }

        function dismissFirstNotice() {
            const el = document.getElementById('firstNotice');
            el.classList.add('hidden');
            el.classList.remove('flex');
            try {
                localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
            } catch (e) {
                // 저장 실패 시 다음 방문에 한 번 더 보일 뿐이라 무시한다.
            }
        }
        function reopenOnboarding() {
            closeSettings();
            showOnboarding();
        }

        function resetLikes() {
            if (!confirm('찜 목록을 초기화할까요?')) return;
            likedIds = new Set();
            saveLiked();
            renderDeals();
            renderLikedList();
            updateAlertBanners();
            showToast('찜 목록을 초기화했어요.');
        }

        // 알림 수신 동의만 받는 단계 - 실제 "언제 무엇을 보낼지"는 콘솔의 스마트 발송 설정이 별도로 필요함.
        function requestNotifications() {
            if (!document.body.classList.contains('in-toss-app') || !window.tossRequestNotificationAgreement) {
                showToast('토스 앱에서만 알림 설정이 가능해요.');
                return;
            }
            window.tossRequestNotificationAgreement()
                .then(() => showToast('알림 동의가 완료됐어요!'))
                .catch(() => showToast('알림 동의를 완료하지 못했어요.'));
        }

        updateLikedBadge();
        loadDeals().then(applyDeepLink); // 특정 행사로 바로 열기는 ALL_DEALS가 로드된 뒤에만 가능
        maybeShowFirstNotice();
        fetchWeatherChip();
