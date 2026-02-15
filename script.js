// Get DOM elements
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const serviceCards = document.querySelectorAll('.service-card');

// Search and filter function
function filterServices() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    serviceCards.forEach(card => {
        const cardText = card.textContent.toLowerCase();
        const cardCategory = card.getAttribute('data-category');
        
        // Check if card matches search term
        const matchesSearch = cardText.includes(searchTerm);
        
        // Check if card matches selected category
        const matchesCategory = selectedCategory === '' || cardCategory === selectedCategory;
        
        // Show or hide card based on both conditions
        if (matchesSearch && matchesCategory) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

// Add event listeners
searchInput.addEventListener('input', filterServices);
categoryFilter.addEventListener('change', filterServices);

// Add smooth scrolling for better UX
document.addEventListener('DOMContentLoaded', () => {
    console.log('MasterUZ Handyman Directory loaded successfully!');
    console.log(`Total services available: ${serviceCards.length}`);
});
