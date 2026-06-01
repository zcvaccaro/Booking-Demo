document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date');
    const timeSelect = document.getElementById('time');
    const bookingForm = document.querySelector('.reservation-form');
    const serviceSelect = document.getElementById('service');
    const lengthSelect = document.getElementById('length');

    // --- 0. Global State & URL Parameters ---
    const urlParams = new URLSearchParams(window.location.search);
    const state = {
        hasCardFromLookup: urlParams.get('hasCard') === 'true',
        useSavedCard: false,
        squareInitialized: false
    };

    // --- Square Payment SDK Initialization ---
    const appId = window.SQUARE_APP_ID;
    const locationId = window.SQUARE_LOCATION_ID;

    let card;
    let fp; // Flatpickr instance

    // Initialize the Calendar immediately
    initializeDatePicker();

    // --- Pre-fill Logic for Returning Customers ---
    const prefillFromURL = () => {
        const urlParams = new URLSearchParams(window.location.search);
        ['firstName', 'lastName', 'email', 'phone', 'address', 'dob'].forEach(id => {
            const val = urlParams.get(id);
            const el = document.getElementById(id);
            if (val && el) el.value = val;
        });
    };
    prefillFromURL();

    // Initialize Square immediately after DOM content is parsed

    // Square initialization removed for demo purposes

    async function initializeSquare() {
        if (state.squareInitialized) return;

        if (!window.Square) {
            // Retry once if the script tag hasn't finished loading
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!window.Square) {
                console.error('Square.js failed to load properly');
                return;
            }
        }

        const cardContainer = document.getElementById('card-container');
        if (!cardContainer) {
            console.error("Square Initialization Error: #card-container not found in DOM.");
            return;
        }

        try {
            const payments = window.Square.payments(appId, locationId);

            // ✅ FIX: Initializing without a style object resolves focus/typing issues on desktop
            card = await payments.card();
            await card.attach('#card-container');

            state.squareInitialized = true;
            console.log("✅ Square Card attached successfully");

        } catch (e) {
            console.error('Square Card Attachment Failed:', e);
        }
    }

    // --- 0. Service Length and Pricing Data ---
    const servicePricing = {
        'swedish': [
            { length: 30, price: 75 },
            { length: 60, price: 130 },
            { length: 90, price: 180 }
        ],
        'deep-tissue': [
            { length: 30, price: 75 },
            { length: 60, price: 130 },
            { length: 90, price: 180 }
        ],
        'prenatal': [
            { length: 60, price: 120 }
        ],
        'mfr': [
            { length: 30, price: 85 },
            { length: 60, price: 140 },
            { length: 90, price: 190 }
        ]
    };

    const updateLengthOptions = () => {
        const selectedService = serviceSelect.value;
        if (servicePricing[selectedService]) {
            lengthSelect.innerHTML = '<option value="" disabled selected>Select duration</option>';
            lengthSelect.classList.add('placeholder-selected');
            servicePricing[selectedService].forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.length;
                option.textContent = `${opt.length} min — $${opt.price}`;
                lengthSelect.appendChild(option);
            });
            lengthSelect.disabled = false;
        } else {
            lengthSelect.innerHTML = '<option value="" disabled selected>Please select service first</option>';
            lengthSelect.classList.add('placeholder-selected');
            lengthSelect.disabled = true;
        }
        // Reset time availability because service/length context has changed
        fetchAndDisplayAvailability();
    };

    // --- 1. Fetch and Display Availability ---

    let availabilityTimeout;
    const fetchAndDisplayAvailability = () => {
        clearTimeout(availabilityTimeout);
        availabilityTimeout = setTimeout(async () => {
        // Guard against accessing flatpickr before it is initialized
        const selectedDate = fp ? fp.selectedDates[0] : null;
        const duration = lengthSelect.value;

        // Differentiate placeholders based on what is missing
        if (!selectedDate) {
            timeSelect.innerHTML = '<option value="" disabled selected>Please select a date first...</option>';
            timeSelect.classList.add('placeholder-selected');
            timeSelect.disabled = true;
            return;
        } else if (!duration) {
            timeSelect.innerHTML = '<option value="" disabled selected>Please select a duration first...</option>';
            timeSelect.classList.add('placeholder-selected');
            timeSelect.disabled = true;
            return;
        }

        // Clear previous times and show a loading message
        timeSelect.innerHTML = '<option>Fetching times...</option>';
        timeSelect.disabled = true;

        try {
            // Generate a range of times from 10:00 AM to 5:00 PM
            const dateStr = selectedDate.toISOString().split('T')[0];
            const availableTimes = [
                `${dateStr}T10:00:00`,
                `${dateStr}T11:00:00`,
                `${dateStr}T12:00:00`,
                `${dateStr}T13:00:00`,
                `${dateStr}T14:00:00`,
                `${dateStr}T15:00:00`,
                `${dateStr}T16:00:00`,
                `${dateStr}T17:00:00`
            ];
            populateTimeSlots(availableTimes);
        } catch (error) {
            console.error('Error fetching availability:', error);
            timeSelect.innerHTML = '<option>Could not load times.</option>';
        }
        }, 250); // Debounce fetch requests
    };

    const populateTimeSlots = (availableTimes) => {
        timeSelect.innerHTML = ''; // Clear loading message

        if (!availableTimes || availableTimes.length === 0) {
            timeSelect.innerHTML = '<option value="" disabled selected>No times available on this day</option>';
            timeSelect.classList.add('placeholder-selected');
            return;
        }

        timeSelect.classList.remove('placeholder-selected');
        // Populate the dropdown
        availableTimes.forEach(timeISO => {
            const slot = new Date(timeISO);
            const option = document.createElement('option');
            // Format time as "HH:MM AM/PM"
            option.value = slot.toTimeString().slice(0, 5); // "HH:MM"
            option.textContent = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeSelect.appendChild(option);
        });

        timeSelect.disabled = false;
    };

    // --- 2. Handle Form Submission ---

    const scrollToField = (el, offset = 180) => {
        const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({
            top: y,
            behavior: 'smooth'
        });
    };

    let isInternalValidation = false;
    bookingForm.addEventListener('invalid', (e) => {
        // Ensure UI updates for the checkbox whenever it is invalid
        if (e.target.id === 'authCharge') {
            const authErrorMessage = document.getElementById('auth-error-message');
            const agreementText = bookingForm.querySelector('.agreement-text');
            if (agreementText) agreementText.style.color = 'var(--accent-color-dark)';
            if (authErrorMessage) authErrorMessage.style.display = 'block';
        }

        if (isInternalValidation) return;
        
        const firstInvalid = bookingForm.querySelector(':invalid');
        if (firstInvalid && e.target === firstInvalid) {
            e.preventDefault(); // Stop the browser from jumping instantly
            
            // Find the container (label + input) to ensure both are visible
            const scrollTarget = firstInvalid.closest('.form-group, .agreement-group, fieldset') || firstInvalid;
            scrollToField(scrollTarget);

            setTimeout(() => {
                isInternalValidation = true;
                firstInvalid.reportValidity(); // Show browser validation bubble
                isInternalValidation = false;
                firstInvalid.focus({ preventScroll: true });
            }, 300);
        }
    }, true);

    bookingForm.addEventListener('submit', async (e) => {
        // Handle custom validation for the authorization checkbox
        const authErrorMessage = document.getElementById('auth-error-message');
        const agreementText = bookingForm.querySelector('.agreement-text');
        if (authChargeCheckbox && !authChargeCheckbox.disabled && !authChargeCheckbox.checked) {
            authChargeCheckbox.setCustomValidity("Please authorize the card hold to continue.");
            if (agreementText) agreementText.style.color = 'var(--accent-color-dark)';
            if (authErrorMessage) authErrorMessage.style.display = 'block';
        } else if (authChargeCheckbox) {
            authChargeCheckbox.setCustomValidity("");
            if (agreementText) agreementText.style.color = '';
            if (authErrorMessage) authErrorMessage.style.display = 'none';
        }

        if (!bookingForm.checkValidity()) {
            e.preventDefault();
            return;
        }

        e.preventDefault();

        const submitButton = bookingForm.querySelector('button[type="submit"]');
        submitButton.classList.add('loading');
        submitButton.disabled = true;

        try {
            // Skip Square tokenization for demo
            let sourceId = "mock-source-id";
            let useCardOnFile = state.useSavedCard;

            const selectedDate = fp.selectedDates[0];
            const [hour, minute] = timeSelect.value.split(':');
            const startTime = new Date(selectedDate);
            startTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

            const formData = new FormData(bookingForm);
            const clientName = `${formData.get('firstName')} ${formData.get('lastName')}`;
            const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text;

            // Format date and time for the confirmation and intake pages
            const formattedDate = selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const formattedTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const mockParams = new URLSearchParams({
                date: formattedDate,
                time: formattedTime,
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                comments: formData.get('comments'),
                service: serviceName,
                calendarId: 'mock-calendar-id-123', // Mock ID
                dob: urlParams.get('dob') || '',
                address: urlParams.get('address') || '',
                conditions: urlParams.get('conditions') || '',
                allergies: urlParams.get('allergies') || ''
            });
            window.location.href = `BookingConfirm.html?${mockParams.toString()}`;

        } catch (error) {
            console.error('Booking failed:', error);
            alert(`Booking failed: ${error.message}`);
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    });

    // --- New: Handle Saved Card UI ---
    const cardContainer = document.getElementById('card-container');
    const savedCardOption = document.getElementById('saved-card-option');
    const useNewCardBtn = document.getElementById('use-new-card-btn');
    const cardNameInput = document.getElementById('cardName');
    const authChargeCheckbox = document.getElementById('authCharge');
    const authChargeGroup = authChargeCheckbox ? authChargeCheckbox.closest('.agreement-group') : null;

    if (authChargeCheckbox) {
        authChargeCheckbox.addEventListener('change', () => {
            const authErrorMessage = document.getElementById('auth-error-message');
            const agreementText = authChargeCheckbox.closest('.agreement-group').querySelector('.agreement-text');
            authChargeCheckbox.setCustomValidity("");
            if (agreementText) agreementText.style.color = '';
            if (authErrorMessage) authErrorMessage.style.display = 'none';
        });
    }

    if (state.hasCardFromLookup) {
        // Update message with last 4 digits from URL
        const last4 = urlParams.get('last4');
        if (last4) {
            const msgPara = savedCardOption.querySelector('p');
            if (msgPara) {
                msgPara.innerHTML = `We have a card on file for you ending in <strong>${last4}</strong>. If you would like to use this card, simply submit your booking below. Otherwise...`;
            }
        }

        // Hide new card input groups (including labels) and show saved card option
        if (cardContainer) cardContainer.closest('.form-group').style.display = 'none';
        if (cardNameInput) {
            cardNameInput.closest('.form-group').style.display = 'none';
            cardNameInput.required = false; // Prevent validation from blocking submit
        }
        if (savedCardOption) savedCardOption.style.display = 'block';
        if (authChargeCheckbox) {
            authChargeCheckbox.checked = true; // Assume authorization for saved card
            authChargeCheckbox.disabled = true; // Disable checkbox
            authChargeCheckbox.required = false; // Prevent validation from blocking submit
            if (authChargeGroup) authChargeGroup.style.opacity = '0.6'; // Visually indicate disabled
        }
        state.useSavedCard = true; // Default to using saved card
    } else {
        // If no card on file, ensure Square is initialized (already done above)
        if (cardContainer) cardContainer.style.display = 'block';
        if (cardNameInput) cardNameInput.style.display = 'block';
        if (savedCardOption) savedCardOption.style.display = 'none';
        if (authChargeCheckbox) {
            authChargeCheckbox.disabled = false;
            if (authChargeGroup) authChargeGroup.style.opacity = '1';
        }
    }

    if (useNewCardBtn) {
        useNewCardBtn.addEventListener('click', () => {
            state.useSavedCard = false;
            if (savedCardOption) savedCardOption.style.display = 'none';
            if (cardContainer) cardContainer.closest('.form-group').style.display = 'block';
            if (cardNameInput) {
                cardNameInput.closest('.form-group').style.display = 'block';
                cardNameInput.required = false;
            }
            if (authChargeCheckbox) {
                authChargeCheckbox.disabled = false;
                authChargeCheckbox.checked = false;
                authChargeCheckbox.required = false;
                if (authChargeGroup) authChargeGroup.style.opacity = '1';
            }
        });
    }

    // --- 3. Initialize Date Picker with Enabled Dates ---
    async function initializeDatePicker() {
        // Initialize flatpickr immediately so the grid appears on click
        fp = flatpickr("#date", {
            inline: false, // Desktop friendly: open on click, close on select
            disableMobile: true,
            minDate: "today",
            dateFormat: "Y-m-d",
            onChange: (selectedDates) => {
                if (selectedDates.length > 0) fetchAndDisplayAvailability();
            }
        });

        // In this static demo, all days from today onwards are enabled by default.
        // We remove the fetch call to the backend.
    }

    // Also fetch availability when the service length changes
    lengthSelect.addEventListener('change', () => {
        lengthSelect.classList.remove('placeholder-selected');
        fetchAndDisplayAvailability();
    });

    // When a real time is selected, remove the placeholder styling
    timeSelect.addEventListener('change', () => {
        timeSelect.classList.remove('placeholder-selected');
    });

    // --- 4. Cancellation Policy Modal Logic ---
    const modal = document.getElementById('cancellation-modal');
    const openModalBtn = document.getElementById('cancellation-policy-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (modal && openModalBtn && closeModalBtn) {
        openModalBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Also close modal if user clicks on the overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // --- 5. Pre-select service from URL ---
    const preselectService = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const service = urlParams.get('service');
        if (serviceSelect) {
            serviceSelect.classList.add('placeholder-selected');
            if (service && Array.from(serviceSelect.options).some(opt => opt.value === service)) { // Check if the service exists
                serviceSelect.value = service; // Pre-select the service
                serviceSelect.classList.remove('placeholder-selected');
            }
            updateLengthOptions(); // Update duration options and trigger availability fetch
        }
    };

    serviceSelect.addEventListener('change', () => {
        serviceSelect.classList.remove('placeholder-selected');
        updateLengthOptions();
    });

    preselectService(); // Run on page load (within DOMContentLoaded)
});