/**
 * Render reviews to canvases and append to container.
 * reviews: array of { id, user, rating, text, image, createdAt }
 * container: DOM element to append canvases into (optional; defaults to '#reviewsContainer')
 */
function createReviewCanvases(reviews, container = document.getElementById('reviewsContainer') || document.body) {
  // kept the original sizing/constants so output matches the canvas look
  const W = 680;                // logical card width in CSS px
  const padding = 18;
  const headerFont = "600 14px Inter, system-ui, Arial";
  const metaFont = "400 12px Inter, system-ui, Arial";
  const bodyFont = "400 15px Inter, system-ui, Arial";
  const starSize = 16;
  const starGap = 6;
  const maxBodyWidth = W - padding * 2;

  // inject stylesheet once
  if (!document.getElementById('review-card-styles')) {
    const style = document.createElement('style');
    style.id = 'review-card-styles';
    style.textContent = `
      .review-card {
        width: ${W}px;
        padding: ${padding}px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 1px 4px rgba(16,24,40,0.06);
        border: 1px solid rgba(0,0,0,0.06);
        box-sizing: border-box;
        display: block;
        margin-bottom: 12px;
        font-family: Inter, system-ui, Arial;
      }
      .review-meta {
        font: ${metaFont};
        color: #4b5563;
        margin-bottom: 6px;
      }
      .review-stars {
        display: flex;
        gap: ${starGap}px;
        margin-bottom: 8px;
        align-items: center;
      }
      .review-body {
        font: ${bodyFont};
        color: #111827;
        line-height: 20px;
        max-width: ${maxBodyWidth}px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .review-star {
        width: ${starSize}px;
        height: ${starSize}px;
        flex: 0 0 ${starSize}px;
        display: inline-block;
      }
      /* optional: make the container center on small screens */
      @media (max-width: ${W + 40}px) {
        .review-card { width: calc(100% - 40px); }
      }
    `;
    document.head.appendChild(style);
  }

  // star SVG path (5-point star)
  const STAR_PATH = "M12 .587l3.668 7.431 8.2 1.192-5.934 5.788 1.402 8.173L12 18.896 4.664 22.769l1.402-8.173L.132 9.21l8.2-1.192z";

  // helper to format date and meta text (same logic as before)
  function buildMeta(review) {
    const publicName = emailToPublicUsername(review.user);

    try {
      const date = new Date(review.createdAt);
      const dateStr = date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      return publicName + " · " + dateStr;
    } catch (e) {
      return publicName;
    }
  }

  // create cards
  reviews.forEach(review => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Review by ${emailToPublicUsername(review.user)}`);

    // meta
    const metaDiv = document.createElement('div');
    metaDiv.className = 'review-meta';
    metaDiv.textContent = buildMeta(review);
    card.appendChild(metaDiv);

    // stars
    const stars = document.createElement('div');
    stars.className = 'review-stars';
    const rating = Math.max(0, Math.min(5, Math.round(review.rating || 0)));
    for (let i = 0; i < 5; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'review-star');
      svg.setAttribute('aria-hidden', 'true');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', STAR_PATH);

      if (i < rating) {
        path.setAttribute('fill', '#f59e0b'); // filled star color
      } else {
        path.setAttribute('fill', '#e6e7e9'); // empty star fill
        path.setAttribute('stroke', '#cfcfd2'); // empty star stroke
        path.setAttribute('stroke-width', '0.6');
      }

      svg.appendChild(path);
      stars.appendChild(svg);
    }
    card.appendChild(stars);

    // body text
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'review-body';
    bodyDiv.textContent = review.text || '';
    card.appendChild(bodyDiv);

    // append to container
    container.appendChild(card);
  });
}

// Loader: fetch reviews and render them
(function() {
  const container = document.getElementById('reviewsContainer');
  const loadMoreBtn = document.getElementById('load-more-reviews');
  if (!container || !loadMoreBtn) {
    console.warn('Reviews container or load more button not found');
    return;
  }

  let nextCursor = null;
  let isLoading = false;
  const PAGE_LIMIT = 10;

  async function showFallbackSample() {
    createReviewCanvases([{
      id: "sample-1",
      user: "carter.aaron.cope@gmail.com",
      rating: 5,
      text: "Awesome for my upcoming ARG in a minecraft mod!",
      image: null,
      createdAt: "2026-01-11T02:09:22.011Z"
    }], container);
    loadMoreBtn.style.display = 'none';
  }

  async function loadPage(cursor = undefined) {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';

    try {
      const url = new URL('https://api.spectrodraw.com/api/reviews', window.location.origin);
      url.searchParams.set('limit', String(PAGE_LIMIT));
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { credentials: 'include', method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch reviews: ' + res.status);

      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : (payload.reviews || payload.data || []);
      if (Array.isArray(list) && list.length > 0) {
        createReviewCanvases(list, container);
      }

      // update cursor & button visibility
      nextCursor = payload.nextCursor || null;
      if (!nextCursor) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'inline-block';
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load more';
      }

      // if this was the very first load and nothing returned, show fallback
      if ((!list || list.length === 0) && !cursor) {
        showFallbackSample();
      }
    } catch (err) {
      console.error('loadReviews error', err);
      // if first page failed, show fallback
      if (!cursor) showFallbackSample();
      else {
        // for subsequent pages, hide button (could show a retry in future)
        loadMoreBtn.style.display = 'none';
      }
    } finally {
      isLoading = false;
      loadMoreBtn.disabled = false;
      if (loadMoreBtn.style.display !== 'none') loadMoreBtn.textContent = 'Load more';
    }
  }

  // hook the button
  loadMoreBtn.addEventListener('click', function() {
    // if nextCursor is null but button visible, try load (defensive)
    const c = nextCursor || undefined;
    loadPage(c);
  });

  // initial load
  // start with the first page (no cursor)
  loadPage(undefined);
})();