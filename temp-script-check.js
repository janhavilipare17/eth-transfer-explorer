  
    // Vanilla JS dashboard logic
    const addressInput = document.getElementById('address-input');
    const searchBtn = document.getElementById('search-btn');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const resultsContainer = document.getElementById('results-container');
    const errorMessage = document.getElementById('error-message');

    // Get references to all the DOM elements we need
    const statTotal = document.getElementById('stat-total');
    const statSent = document.getElementById('stat-sent');
    const statReceived = document.getElementById('stat-received');
    const statUnique = document.getElementById('stat-unique');
    const catExternal = document.getElementById('cat-external');
    const catInternal = document.getElementById('cat-internal');
    const catERC20 = document.getElementById('cat-erc20');
    const catERC721 = document.getElementById('cat-erc721');
    const catERC1155 = document.getElementById('cat-erc1155');
    const topAssetsList = document.getElementById('top-assets-list');
    const transactionTableBody = document.getElementById('transaction-table-body');
    const tableFooterNote = document.getElementById('table-footer-note');

    // Store full transfers array and current filter
    let storedTransfers = [];
    let currentFilter = 'all';

    // Add click handler on search button AND Enter keypress on address input
    searchBtn.addEventListener('click', performSearch);
    addressInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    // Category click handlers
    function setFilter(filter) {
      currentFilter = filter;
      
      // Update active badge state
      const badges = [catExternal, catInternal, catERC20, catERC721, catERC1155];
      badges.forEach(b => b.classList.remove('active'));
      
      if (filter === 'all') {
        // Show All - deactivate all badges
        // No badge gets 'active' class
      } else {
        // Activate the clicked badge
        if (filter === 'external') catExternal.classList.add('active');
        if (filter === 'internal') catInternal.classList.add('active');
        if (filter === 'erc20') catERC20.classList.add('active');
        if (filter === 'erc721') catERC721.classList.add('active');
        if (filter === 'erc1155') catERC1155.classList.add('active');
      }
      
      // Render filtered table
      renderTable(currentFilter);
    }

    // Render transaction table with optional filter
    function renderTable(filter) {
      const transfers = storedTransfers.filter(tx => {
        if (filter === 'all') return true;
        return tx.category === filter;
      });
      
      const fragment = document.createDocumentFragment();
      
      let showNote = false;
      fragment.innerHTML = '';
      
      storedTransfers.slice(0, 50).forEach(tx => {
        const isReceived = tx.direction === 'received';
        const row = document.createElement('tr');
        row.className = 'table-row-stripe border-b border-black';
        const date = tx.blockTimestamp ? tx.blockTimestamp.split('T')[0] : 'N/A';
        const direction = tx.direction;
        const directionClass = tx.direction === 'received' ? 'text-green-600' : 'text-red-500';
        const amount = tx.amount !== null && tx.amount !== undefined ? tx.amount : '0';
        const counterparty = tx.counterparty || 'N/A';
        const hash = tx.hash || 'N/A';

        const tr = document.createElement('tr');
        tr.className = 'table-row-stripe border-b border-black';
        tr.innerHTML = `
          <td class="p-4">${date}</td>
          <td class="p-4 font-bold ${directionClass}">${direction}</td>
          <td class="p-4">${tx.asset || 'NFT'}</td>
          <td class="p-4">${amount}</td>
          <td class="p-4">${counterparty}</td>
          <td class="p-4 truncate" title="${hash}">${hash}</td>
        `;
        fragment.appendChild(tr);
      });
      
      transactionTableBody.innerHTML = '';
      transactionTableBody.appendChild(fragment);
      
      if (storedTransfers.length > 50) {
        showNote = true;
        document.querySelector('#table-footer-note').textContent = `Showing 50 of ${storedTransfers.length} total transfers - full history available via CLI export`;
      } else {
        document.querySelector('#table-footer-note').textContent = '';
    }

    // Hide loading, show results
    function hideLoadingShowResults() {
      loadingState.classList.add('hidden');
      resultsContainer.classList.remove('hidden');
      errorState.classList.add('hidden');
    }

    // Hide loading, show error
    function hideLoadingShowError(error) {
      loadingState.classList.add('hidden');
      errorState.classList.remove('hidden');
      errorMessage.textContent = error.message || 'Failed to fetch transfer history';
    }

    // Add click handler on search button AND Enter keypress on address input
    searchBtn.addEventListener('click', performSearch);
    addressInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    function performSearch() {
      const address = addressInput.value.trim();
      if (!address) return;

      // Hide results/error, show loading
      resultsContainer.classList.add('hidden');
      errorState.classList.add('hidden');
      loadingState.classList.remove('hidden');

      // Fetch from the API
      fetch(`http://localhost:3001/api/transfers/${address}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Store full transfers array
          storedTransfers = data.transfers;
          
          // Hide loading, show results
          hideLoadingShowResults();
          
          // Update summary stats
          statTotal.textContent = data.summary.totalCount;
          statSent.textContent = data.summary.sentCount;
          statReceived.textContent = data.summary.receivedCount;
          statUnique.textContent = data.summary.uniqueCounterparties;

          // Update category breakdown
          catExternal.textContent = data.summary.categoryBreakdown.external;
          catInternal.textContent = data.summary.categoryBreakdown.internal;
          catERC20.textContent = data.summary.categoryBreakdown.erc20;
          catERC721.textContent = data.summary.categoryBreakdown.erc721;
          catERC1155.textContent = data.summary.categoryBreakdown.erc1155;

          // Build top assets list
          topAssetsList.innerHTML = '';
          data.summary.topAssets.forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center py-2 border-b border-black rounded-lg';
            li.innerHTML = `
              <span>${item.asset}</span>
              <span class="bg-black text-white text-xs rounded py-0.5 px-2">${item.count}</span>
            `;
            topAssetsList.appendChild(li);
          });

          // Render transaction table with all transfers (capped at 50)
          renderTable('all');
        })
        .catch(error => {
          hideLoadingShowError(error);
        });
    }

    // Category click handlers
    catExternal.addEventListener('click', () => setFilter('external'));
    catInternal.addEventListener('click', () => setFilter('internal'));
    catERC20.addEventListener('click', () => setFilter('erc20'));
    catERC721.addEventListener('click', () => setFilter('erc721'));
    catERC1155.addEventListener('click', () => setFilter('erc1155'));

    // Initial render with no filter (show all)
    renderTable('all');

