
// Configuration
const API_BASE_URL = 'https://aca-manualmate-cc-prod-001.proudocean-fab4a47f.canadacentral.azurecontainerapps.io';

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        userId: urlParams.get('user') || 'default_user',
        tenantId: urlParams.get('tenant') || 'default_tenant'
    };
}

// Extract URL and text from markdown format
function extractUrlAndText(inputText) {
    if (!inputText) {
        return { url: null, formattedText: '' };
    }

    // Search for markdown URL pattern
    const urlMatch = inputText.match(/\[.*?\]\((.*?)\)/);
    const url = urlMatch ? urlMatch[1] : null;

    // Remove markdown link from text
    let cleanedText = inputText.replace(/\[.*?\]\(.*?\)/g, '').trim();

    // Convert markdown to HTML
    const formattedText = convertMarkdownToHtml(cleanedText);

    return { url, formattedText };
}

// Convert markdown formatting to HTML
function convertMarkdownToHtml(text) {
    if (!text) return '';

    // Convert bold text (**text** or __text__)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Convert italic text (*text* or _text_)
    text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    text = text.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');

    // Convert inline code (`code`)
    text = text.replace(/`([^`]+?)`/g, '<code>$1</code>');

    // Convert line breaks to HTML breaks
    text = text.replace(/\n/g, '<br>');

    return text;
}

// Format bookmarks for UI
function formatBookmarksForUI(bookmarkData) {
    if (!bookmarkData.success) {
        return [];
    }

    const bookmarks = bookmarkData.data || [];
    const formattedBookmarks = [];

    for (const bookmark of bookmarks) {
        const responseText = bookmark.response || '';
        const { url, formattedText } = extractUrlAndText(responseText);

        const formattedBookmark = {
            id: bookmark.query_id || '',
            query_id: bookmark.query_id || '',
            query: bookmark.query || '',
            response: formattedText,
            is_bookmark: bookmark.is_bookmark !== undefined ? bookmark.is_bookmark : true,
            'Reference links': url || ''
        };

        formattedBookmarks.push(formattedBookmark);
    }

    return formattedBookmarks;
}

// Fetch bookmarks from API
async function fetchBookmarksFromApi(userId, tenantId) {
    const endpoint = `${API_BASE_URL}/bookmark`;
    const params = new URLSearchParams({
        user_id: userId,
        tenant_id: tenantId
    });

    try {
        const response = await fetch(`${endpoint}?${params}`);

        if (response.ok) {
            const data = await response.json();
            console.log(`Successfully fetched ${data.data?.length || 0} bookmarks for user ${userId}`);
            return data;
        } else {
            const errorText = await response.text();
            console.error(`API request failed with status ${response.status}: ${errorText}`);
            return {
                success: false,
                errors: [`API request failed with status ${response.status}`],
                data: [],
                status_code: response.status
            };
        }
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return {
            success: false,
            errors: [`Network error: ${error.message}`],
            data: [],
            status_code: 500
        };
    }
}

// Delete bookmark
async function deleteBookmark(queryId) {
    const { userId, tenantId } = getUrlParams();
    const url = `${API_BASE_URL}/deletebookmarks?user_id=${userId}&tenant_id=${tenantId}&query_id=${queryId}`;

    try {
        await fetch(url, { method: 'GET' });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
    }
}

// Show custom confirmation modal
function showConfirmationModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const cancelBtn = document.getElementById('cancel-delete-btn');

        // Show modal
        modal.classList.add('show');

        // Handle confirm
        const handleConfirm = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleModalClick);
            resolve(true);
        };

        // Handle cancel
        const handleCancel = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleModalClick);
            resolve(false);
        };

        // Handle click outside modal
        const handleModalClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };

        // Add event listeners
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('click', handleModalClick);
    });
}

// Refresh bookmarks
async function refreshBookmarks() {
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingElement = document.getElementById('loading');
    const bookmarksContainer = document.getElementById('bookmarks-container');
    const emptyState = document.getElementById('empty-state');
    const errorContainer = document.getElementById('error-container');

    refreshBtn.disabled = true;
    refreshBtn.textContent = '🔄 Refreshing...';
    loadingElement.style.display = 'block';
    bookmarksContainer.style.display = 'none';
    emptyState.style.display = 'none';
    errorContainer.innerHTML = '';

    const { userId, tenantId } = getUrlParams();
    const bookmarkData = await fetchBookmarksFromApi(userId, tenantId);

    loadingElement.style.display = 'none';
    refreshBtn.disabled = false;
    refreshBtn.textContent = '🔄 Refresh Bookmarks';

    // If API call succeeded (even with empty data), show the bookmarks
    if (bookmarkData.success === true || bookmarkData.success === undefined) {
        const formattedBookmarks = formatBookmarksForUI(bookmarkData);
        displayBookmarks(formattedBookmarks);
    } else {
        // Render empty state HTML instead of error message
        emptyState.innerHTML = `
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
            </svg>
            <h2>No Bookmarks Yet</h2>
            <p>Your bookmarked queries will appear here</p>
        `;
        emptyState.style.display = 'block';
    }
}

// Create bookmark card element
function createBookmarkCard(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.queryId = bookmark.query_id;

    card.innerHTML = `
                <div class="card-header">
                    <button class="remove-bookmark-btn" title="Remove bookmark">Remove Bookmark</button>
                </div>
                <div class="query-section">
                    <div class="section-label">Query</div>
                    <div class="query-text">${escapeHtml(bookmark.query)}</div>
                </div>
                <div class="query-section">
                    <div class="section-label">Response</div>
                    <div class="response-text">${bookmark.response}</div>
                </div>
                <div class="query-section">
                    <div class="section-label">Reference Links</div>
                    <div class="reference-links">
                        ${bookmark['Reference links'] && bookmark['Reference links'].trim()
            ? `<a href="${escapeHtml(bookmark['Reference links'])}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark['Reference links'])}</a>`
            : '<span class="no-reference">No reference links available</span>'
        }
                    </div>
                </div>
            `;

    // Add remove bookmark functionality
    const removeBookmarkBtn = card.querySelector('.remove-bookmark-btn');
    removeBookmarkBtn.addEventListener('click', async () => {
        // Show custom confirmation modal
        const confirmDelete = await showConfirmationModal();
        
        if (confirmDelete) {
            card.style.animation = 'fadeOut 0.3s ease-out';

            setTimeout(() => {
                card.remove();
                checkEmptyState();
            }, 300);

            try {
                await deleteBookmark(bookmark.query_id);
            } catch (error) {
                console.error('Error calling deleteBookmark:', error);
            }
        }
    });

    return card;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('error-container');
    errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

// Check if bookmarks container is empty
function checkEmptyState() {
    const bookmarksContainer = document.getElementById('bookmarks-container');
    const emptyState = document.getElementById('empty-state');

    if (bookmarksContainer.children.length === 0) {
        bookmarksContainer.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// Display bookmarks
function displayBookmarks(bookmarks) {
    const bookmarksContainer = document.getElementById('bookmarks-container');
    const emptyState = document.getElementById('empty-state');

    bookmarksContainer.innerHTML = '';

    if (bookmarks.length === 0) {
        emptyState.style.display = 'block';
        bookmarksContainer.style.display = 'none';
    } else {
        bookmarksContainer.style.display = 'block';
        emptyState.style.display = 'none';

        bookmarks.forEach(bookmark => {
            const card = createBookmarkCard(bookmark);
            bookmarksContainer.appendChild(card);
        });
    }
}

// Initialize the dashboard
async function init() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', refreshBookmarks);

    // Load bookmarks on initial load
    await refreshBookmarks();
}

// Start the app
init();