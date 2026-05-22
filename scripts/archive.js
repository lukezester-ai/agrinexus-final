(function() {
  const ITEMS_PER_PAGE = 5; // Reduced for testing/demonstration, can be changed later
  let currentPage = 1;
  let currentCategory = 'all';
  let searchQuery = '';

  const listContainer = document.getElementById('archive-dynamic-list');
  const paginationContainer = document.getElementById('archive-pagination');
  const searchInput = document.getElementById('archive-search');
  const categorySelect = document.getElementById('archive-category');
  
  function getLang() {
    return document.documentElement.lang === 'ru' ? 'ru' : 'en';
  }

  function getFilteredArticles() {
    return window.ARCHIVE_ARTICLES.filter(article => {
      // Category filter
      if (currentCategory !== 'all' && article.region !== currentCategory && article.category !== currentCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const lang = getLang();
        const title = article.title[lang].toLowerCase();
        if (!title.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });
  }

  function renderList() {
    if (!listContainer) return;
    const lang = getLang();
    const filtered = getFilteredArticles();
    
    // Pagination logic
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    listContainer.innerHTML = '';
    
    if (paginated.length === 0) {
      listContainer.innerHTML = '<li>No articles found.</li>';
    } else {
      paginated.forEach(article => {
        const li = document.createElement('li');
        
        const a = document.createElement('a');
        a.href = article.url;
        
        const spanTitle = document.createElement('span');
        spanTitle.textContent = article.title[lang];
        a.appendChild(spanTitle);
        
        const divMeta = document.createElement('div');
        divMeta.className = 'archive-meta';
        
        const spanMeta = document.createElement('span');
        spanMeta.textContent = article.meta[lang] + ' · ' + (lang === 'en' ? 'English' : 'Английский');
        divMeta.appendChild(spanMeta);
        
        li.appendChild(a);
        li.appendChild(divMeta);
        listContainer.appendChild(li);
      });
    }
    
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = getLang() === 'en' ? 'Previous' : 'Назад';
    prevBtn.disabled = currentPage === 1;
    prevBtn.className = 'archive-page-btn';
    prevBtn.addEventListener('click', () => {
      currentPage--;
      renderList();
    });
    paginationContainer.appendChild(prevBtn);
    
    const spanInfo = document.createElement('span');
    spanInfo.textContent = \` \${currentPage} / \${totalPages} \`;
    spanInfo.className = 'archive-page-info';
    paginationContainer.appendChild(spanInfo);
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = getLang() === 'en' ? 'Next' : 'Напред'; // Russian for Next: 'Вперед', wait, 'Напред' is BG, Russian is 'Далее' or 'Вперед'. We'll use 'Далее'
    if (getLang() === 'ru') nextBtn.textContent = 'Далее';
    
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.className = 'archive-page-btn';
    nextBtn.addEventListener('click', () => {
      currentPage++;
      renderList();
    });
    paginationContainer.appendChild(nextBtn);
  }

  function init() {
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        renderList();
      });
    }
    
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        currentPage = 1;
        renderList();
      });
    }
    
    document.addEventListener('furrow-lang-change', () => {
      renderList();
      
      // Update UI texts for search and category
      const isRu = getLang() === 'ru';
      if (searchInput) searchInput.placeholder = isRu ? 'Поиск...' : 'Search articles...';
      if (categorySelect) {
        categorySelect.options[0].text = isRu ? 'Все категории' : 'All Categories';
        categorySelect.options[1].text = isRu ? 'Северная Америка' : 'North America';
        categorySelect.options[2].text = isRu ? 'Европа' : 'Europe';
        categorySelect.options[3].text = isRu ? 'MENA' : 'MENA';
        categorySelect.options[4].text = isRu ? 'Аналитика (Мир)' : 'Global Analysis';
      }
    });
    
    renderList();
  }

  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();
