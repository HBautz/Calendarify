    window.API_URL = 'http://localhost:3001/api';
    if (!getAnyToken()) {
      window.location.replace('/log-in');
    }

    // Global variables to store fresh data (no localStorage caching for business data)
    let freshEventTypes = [];
    let freshTags = [];
    let freshWorkflows = [];
    let freshContacts = [];
    let freshMeetings = {};
    let freshUserState = {};
    
    // Notification function
    function showNotification(message, type = 'success') {
      // Remove existing notifications
      const existingNotifications = document.querySelectorAll('.notification');
      existingNotifications.forEach(n => n.remove());
      
      // Create notification element
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
        <div class="flex items-center justify-between">
          <span>${message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Animate in
      setTimeout(() => {
        notification.classList.add('show');
      }, 100);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }, 5000);
    }
    
    // Authentication functions are already available from auth.js
    // getAnyToken(), clearToken(), logout() are globally available
    
    // Tab memory functions (preserved in localStorage for UX)
    function saveCurrentSection(section) {
      console.log(`💾 Saving current section: ${section}`);
      localStorage.setItem('calendarify-current-section', section);
      console.log(`✅ Section saved. Current localStorage:`, localStorage.getItem('calendarify-current-section'));
    }
    
    function getCurrentSection() {
      const section = localStorage.getItem('calendarify-current-section') || 'event-types';
      console.log(`📖 Getting current section: ${section}`);
      return section;
    }
    
    function saveMeetingsTab(tab) {
      localStorage.setItem('calendarify-meetings-tab', tab);
    }
    
    function getMeetingsTab() {
      return localStorage.getItem('calendarify-meetings-tab') || 'upcoming';
    }

    async function loadState() {
      const token = getAnyToken();
      if (!token) {
        return;
      }
      const cleanToken = token.replace(/^"|"$/g, "");
      const res = await fetch(`${API_URL}/users/me/state`, {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        freshUserState = data;
        
        // Update UI elements that depend on user state
        updateGoogleCalendarButton();
        updateZoomButton();
        updateOutlookCalendarButton();
        updateAppleCalendarButton();
      }
    }

    async function fetchTagsFromServer() {
      const token = getAnyToken();
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/tags`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const tags = await res.json();
        freshTags = tags;
        return tags;
      }
      return [];
    }

    async function fetchWorkflowsFromServer() {
      const token = getAnyToken();
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/workflows`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const wfs = await res.json();
        freshWorkflows = wfs;
        return wfs;
      }
      return [];
    }

    async function fetchContactsFromServer() {
      const token = getAnyToken();
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const contacts = await res.json();
        console.log('[DEBUG] Fetched contacts:', contacts);
        freshContacts = contacts;
        return contacts;
      }
      return [];
    }

    async function fetchEventTypesFromServer() {
      const token = getAnyToken();
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      
      try {
        // Fetch event types from backend
        const res = await fetch(`${API_URL}/event-types`, { headers: { Authorization: `Bearer ${clean}` } });
        if (res.ok) {
          const raw = await res.json();
          
          // Fetch user state to get additional settings
          const stateRes = await fetch(`${API_URL}/users/me/state`, { headers: { Authorization: `Bearer ${clean}` } });
          if (stateRes.ok) {
            const userState = await stateRes.json();
            
            // Merge event types with their additional settings
            const mergedEventTypes = raw.map(eventType => {
              const settingsKey = `event-type-settings-${eventType.id}`;
              const additionalSettings = userState[settingsKey] || {};
              
              return {
                ...eventType,
                ...additionalSettings,
                // Ensure we have fallbacks for required fields
                color: additionalSettings.color || '#34D399',
                location: additionalSettings.location || 'zoom',
                visibility: additionalSettings.visibility || 'public',
                priority: additionalSettings.priority || 'normal',
                tags: additionalSettings.tags || [],
                notifications: additionalSettings.notifications || {
                  availability: true,
                  reminders: true,
                  followUp: false,
                  reschedule: true
                }
              };
            });
            
            freshEventTypes = mergedEventTypes;
            return mergedEventTypes;
          } else {
            // If we can't fetch user state, just use the raw data
            freshEventTypes = raw;
            return raw;
          }
        }
      } catch (error) {
        console.error('Error fetching event types:', error);
      }
      return [];
    }

    async function fetchMeetingsFromServer() {
      const token = getAnyToken();
      if (!token) {
        console.log('[DEBUG] No token available for fetching meetings');
        return;
      }
      const clean = token.replace(/^"|"$/g, '');
      
      try {
        console.log('[DEBUG] Fetching meetings from server...');
        const res = await fetch(`${API_URL}/bookings`, { headers: { Authorization: `Bearer ${clean}` } });
        
        if (res.ok) {
          const data = await res.json();
          console.log('[DEBUG] Server returned meetings:', data.length, 'bookings');
          
          meetingsData = { upcoming: [], past: [], pending: [] };
          const now = new Date();
          
          data.forEach(b => {
            const start = new Date(b.starts_at);
            const info = {
              id: b.id,
              invitee: b.name,
              email: b.email,
              eventType: b.event_type.title,
              slug: b.event_type.slug,
              duration: b.event_type.duration,
              start: b.starts_at, // Use server data directly
              end: b.ends_at,     // Use server data directly
              // Do not pre-format date here; we format per current clock setting when rendering
              date: b.starts_at,
              status: 'Confirmed',
              zoom_link: b.zoom_link, // Include Zoom link if available
              google_meet_link: b.google_meet_link, // Include Google Meet link if available
              chosen_location: b.chosen_location // Include chosen location for non-video meetings
            };
            if (start < now) meetingsData.past.push(info); else meetingsData.upcoming.push(info);
          });
          
          // Store fresh data in memory (no localStorage caching)
          freshMeetings = meetingsData;
          console.log('[DEBUG] Updated fresh meetings data');
        } else {
          console.error('[DEBUG] Failed to fetch meetings from server:', res.status, res.statusText);
          // Don't use local storage as fallback - keep empty data
          meetingsData = { upcoming: [], past: [], pending: [] };
          freshMeetings = meetingsData; // Clear fresh data
        }
      } catch (error) {
        console.error('[DEBUG] Error fetching meetings from server:', error);
        // Don't use local storage as fallback - keep empty data
        meetingsData = { upcoming: [], past: [], pending: [] };
        freshMeetings = meetingsData; // Clear fresh data
      }
    }

    async function refreshMeetingsData() {
      console.log('[DEBUG] Refreshing meetings data...');
      await fetchMeetingsFromServer();
      // Update the current tab if meetings section is active
      const currentTab = getMeetingsTab();
      if (document.getElementById('meetings-section').style.display !== 'none') {
        updateMeetingsTable(currentTab);
      }
    }

    // Force refresh meetings data from server (for debugging)
    async function forceRefreshMeetings() {
      console.log('[DEBUG] Force refreshing meetings data from server...');
      await fetchMeetingsFromServer();
      const currentTab = getMeetingsTab();
      updateMeetingsTable(currentTab);
      showNotification('Meetings data refreshed from server');
    }

    // No localStorage state management - always fetch fresh data
    async function syncState() {
      // No-op - we don't cache state in localStorage anymore
      console.log('syncState called - no localStorage caching');
    }
    async function showSection(section, el) {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('section-title').textContent = el.textContent.trim();
      document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
      const secEl = document.getElementById(section + '-section');
      if (secEl) secEl.style.display = 'block';
      
      // Save current section for tab memory
      saveCurrentSection(section);
      
      // Always fetch fresh data for each section
      if (section === 'meetings') {
        // Refresh meetings data from server
        await refreshMeetingsData();
        const savedTab = getMeetingsTab();
        const savedTabBtn = document.querySelector(`#meetings-section button[data-tab="${savedTab}"]`);
        showMeetingsTab(savedTab, savedTabBtn);
      } else if (section === 'availability') {
        initializeCalendar();
        // Always fetch fresh availability data from backend
        await loadFreshAvailabilityData();
      } else if (section === 'contacts') {
        await fetchContactsFromServer();
        renderContacts();
      } else if (section === 'event-types') {
        await fetchEventTypesFromServer();
        renderEventTypes();
        // Update location gates when event-types section is shown
        await updateLocationGates();
      } else if (section === 'workflows') {
        await fetchWorkflowsFromServer();
        renderWorkflows();
      } else if (section === 'integrations') {
        setTimeout(async () => {
          updateGoogleCalendarButton();
          updateZoomButton();
          updateOutlookCalendarButton();
          updateAppleCalendarButton();
          // Update location gates when integrations section is shown
          await updateLocationGates();
        }, 100);
      }
    }

    // Meetings tab functionality
    async function showMeetingsTab(tab, btn) {
      console.log('showMeetingsTab called with tab:', tab);
      
      // Save current tab for tab memory
      saveMeetingsTab(tab);
      
      // Update tab buttons
      document.querySelectorAll('#meetings-section button[data-tab]').forEach(button => {
        button.classList.remove('bg-[#34D399]', 'text-[#1A2E29]', 'active-tab');
        button.classList.add('text-[#A3B3AF]');
      });

      if (!btn) {
        btn = document.querySelector(`#meetings-section button[data-tab="${tab}"]`);
      }
      if (btn) {
        btn.classList.remove('text-[#A3B3AF]');
        btn.classList.add('bg-[#34D399]', 'text-[#1A2E29]', 'active-tab');
        console.log('Active button classes:', btn.className);
      }

      await fetchMeetingsFromServer();
      // Update table content based on tab
      updateMeetingsTable(tab);
    }

    function updateMeetingsTable(tab) {
      console.log('updateMeetingsTable called with tab:', tab);
      const tbody = document.querySelector('#meetings-section tbody');
      console.log('Found tbody:', tbody);
      
      if (!tbody) {
        console.error('Could not find tbody element!');
        return;
      }
      // Use current meetingsData (which should be fresh from server)
      // No local storage fallback - server data is the source of truth

      const meetings = getMeetingsData(tab);
      console.log('Meetings for tab', tab, ':', meetings);
      
      // Sort meetings by date (soonest first)
      const sortedMeetings = meetings.sort((a, b) => {
        const dateA = new Date(a.start);
        const dateB = new Date(b.start);
        return dateA - dateB; // Soonest first (ascending order)
      });
      
      const is12h = getClockFormat() === '12h';
      const tableHTML = sortedMeetings.map(meeting => {
        const displayDate = new Date(meeting.start).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: is12h
        });
        let badgeClass =
          meeting.status === 'Confirmed' ? 'badge-success' :
          meeting.status === 'Pending' ? 'badge-warning' :
          meeting.status === 'Completed' ? 'badge-completed' :
          'badge-error';
        return `
        <tr class="table-row border-b border-[#2C4A43]" id="meeting-${meeting.id}">
          <td class="py-3">
            <div class="flex items-center gap-2 justify-center">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(meeting.invitee)}&amp;background=34D399&amp;color=1A2E29" alt="${meeting.invitee}" class="w-8 h-8 rounded-full">
              <div>
                <div class="text-white font-medium">${meeting.invitee}</div>
                <div class="text-[#A3B3AF] text-sm">${meeting.email}</div>
              </div>
            </div>
          </td>
          <td class="py-3 text-center">${meeting.eventType}</td>
          <td class="py-3 text-center">${displayDate}</td>
          <td class="py-3 text-center"><span class="${badgeClass}">${meeting.status}</span></td>
          <td class="py-3 text-center">
            <div class="flex flex-col gap-2 items-center">
              ${meeting.zoom_link ? 
                `<a href="${meeting.zoom_link}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  <span class="material-icons-outlined text-xs">video_call</span>
                  Join Zoom
                </a>` : ''
              }
              ${meeting.google_meet_link ? 
                `<a href="${meeting.google_meet_link}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
                  <span class="material-icons-outlined text-xs">video_call</span>
                  Join Meet
                </a>` : ''
              }
              ${!meeting.zoom_link && !meeting.google_meet_link ? 
                `<span class="text-[#A3B3AF] text-sm">${meeting.chosen_location ? formatChosenLocation(meeting.chosen_location) : 'No meeting link'}</span>` : ''
              }
            </div>
          </td>
          <td class="py-3 text-center">
            <div class="relative inline-block text-left">
              <button class="kebab-btn flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#223c36] transition-colors" type="button" onclick="toggleMeetingMenu(this)">
                <span class="material-icons-outlined">more_vert</span>
              </button>
              <div class="meeting-menu absolute bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg">
                ${tab === 'past' ? 
                  `<button class="w-full flex items-center gap-2 px-4 py-2 text-[#EF4444] hover:bg-[#223c36] text-sm font-semibold" onclick="deleteMeeting('${meeting.id}')">
                    <span class="material-icons-outlined text-xs">delete_forever</span>Delete
                  </button>` :
                  `<button class="w-full flex items-center gap-2 px-4 py-2 text-[#A3B3AF] hover:bg-[#223c36] text-sm font-semibold" onclick="rescheduleMeeting('${meeting.id}')">
                    <span class="material-icons-outlined text-xs">schedule</span>Reschedule
                  </button>
                  <button class="w-full flex items-center gap-2 px-4 py-2 text-[#EF4444] hover:bg-[#223c36] text-sm font-semibold" onclick="cancelMeeting('${meeting.id}')">
                    <span class="material-icons-outlined text-xs">close</span>Cancel
                  </button>`
                }
              </div>
            </div>
          </td>
        </tr>
      `;
      }).join('');
      
      console.log('Generated table HTML:', tableHTML);
      tbody.innerHTML = tableHTML;
      console.log('Table updated successfully');
    }

    // Store meetings data in a variable that can be modified
    let meetingsData = { upcoming: [], past: [], pending: [] };
    try {
      const storedMeetings = JSON.parse(localStorage.getItem('calendarify-meetings') || '{}');
      if (storedMeetings.upcoming) {
        meetingsData = storedMeetings;
      } else {
        // seed with example data if nothing stored yet
        meetingsData = {
          upcoming: [
            { id: 1, invitee: 'Jane Doe', email: 'jane@example.com', eventType: '30-min Intro Call', date: 'Today, 2:00 PM', status: 'Confirmed' }
          ],
          past: [
            { id: 3, invitee: 'Alice Johnson', email: 'alice@test.com', eventType: '30-min Intro Call', date: 'Yesterday, 3:00 PM', status: 'Completed' }
          ],
          pending: [
            { id: 2, invitee: 'John Smith', email: 'john@company.com', eventType: '1-hour Consultation', date: 'Tomorrow, 10:00 AM', status: 'Pending' }
          ]
        };
        localStorage.setItem('calendarify-meetings', JSON.stringify(meetingsData));
      }
    } catch {
      localStorage.setItem('calendarify-meetings', JSON.stringify(meetingsData));
    }

    function getMeetingsData(tab) {
      return meetingsData[tab] || [];
    }

    function removeMeetingFromData(meetingId) {
      // Remove from all tabs
      Object.keys(meetingsData).forEach(tab => {
        meetingsData[tab] = meetingsData[tab].filter(meeting => meeting.id !== meetingId);
      });
    }

    // Meeting actions
    function meetingAction(action, meetingId) {
      const meeting = getMeetingsData('upcoming').find(m => m.id === meetingId) || 
                     getMeetingsData('past').find(m => m.id === meetingId);
      
      switch(action) {
        case 'join':
          alert(`Joining meeting with ${meeting.invitee}`);
          break;
        case 'reschedule':
          alert(`Rescheduling meeting with ${meeting.invitee}`);
          break;
      }
    }

    // Utility functions
    function formatChosenLocation(location) {
      switch(location) {
        case 'zoom':
          return 'Zoom Meeting';
        case 'google-meet':
          return 'Google Meet';
        case 'phone':
          return 'Phone Call';
        case 'office':
          return 'In-person Meeting';
        case 'custom':
          return 'Custom Location';
        default:
          return location;
      }
    }

    function copyLink(slug) {
      const prefix = window.PREPEND_URL || window.FRONTEND_URL || window.location.origin;
      const display = freshUserState['calendarify-display-name'] || '';

      if (!display || display.trim() === '') {
        showNotification('Please set a display name in your profile settings before sharing links');
        return;
      }

      navigator.clipboard.writeText(`${prefix}/booking/${encodeURIComponent(display)}/${slug}`);
      showNotification('Link copied to clipboard');
    }

    function openShareModal(title, slug) {
      const prefix = window.PREPEND_URL || window.FRONTEND_URL || window.location.origin;
      const display = freshUserState['calendarify-display-name'] || '';

      if (!display || display.trim() === '') {
        showNotification('Please set a display name in your profile settings before sharing links');
        return;
      }

      const link = `${prefix}/booking/${encodeURIComponent(display)}/${slug}`;
      document.getElementById('share-modal-title').textContent = title;
      document.getElementById('share-modal-link').value = link;
      const copyBtn = document.getElementById('share-modal-copy-btn');
      copyBtn.onclick = () => copyLink(slug);
      document.getElementById('share-modal').classList.remove('hidden');
      document.getElementById('modal-backdrop').classList.remove('hidden');
    }

    function closeShareModal() {
      document.getElementById('share-modal').classList.add('hidden');
      document.getElementById('modal-backdrop').classList.add('hidden');
    }

    function slugify(text) {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    function generateSlug(name, existing) {
      const base = slugify(name);
      let slug = base;
      let i = 1;
      while (existing.some(e => e.slug === slug)) {
        slug = `${base}-${i++}`;
      }
      return slug;
    }

    function toggleCreateMenu() {
      const menu = document.getElementById('create-menu');
      menu.classList.toggle('hidden');
    }

    function toggleCardMenu(button) {
      const menu = button.nextElementSibling;
      menu.classList.toggle('hidden');
    }

    async function openCreateEventTypeModal() {
      const backdrop = document.getElementById('modal-backdrop');
      const modal = document.getElementById('create-event-type-modal');
      const menu = document.getElementById('create-menu');
      if (backdrop) backdrop.classList.remove('hidden');
      if (modal) modal.classList.remove('hidden');
      if (menu) menu.classList.add('hidden');
      // Update location gates when create modal is opened
      try { await updateLocationGates(); } catch {}
    }

    function closeCreateEventTypeModal() {
      const backdrop = document.getElementById('modal-backdrop');
      const modal = document.getElementById('create-event-type-modal');
      if (backdrop) backdrop.classList.add('hidden');
      if (modal) modal.classList.add('hidden');
      // Clear questions container
      const qc = document.getElementById('questions-container');
      if (qc) qc.innerHTML = '';
      if (typeof questionCounter !== 'undefined') questionCounter = 0;
    }

    async function saveOverride() {
      if (!selectedDate) {
        showNotification('No date selected');
        return;
      }
      
      console.log('[OVERRIDE DEBUG] saveOverride called:', {
        selectedDate,
        selectedDateType: typeof selectedDate
      });
      
      // selectedDate is stored as a string (YYYY-MM-DD) in selectDate
      const dateString = typeof selectedDate === 'string' ? selectedDate : new Date(selectedDate).toISOString().split('T')[0];
      const toggleButton = document.querySelector('#override-modal button[onclick="toggleOverrideAvailability(this)"]');
      const isAvailable = toggleButton.getAttribute('aria-pressed') === 'true';
      
      console.log('[OVERRIDE DEBUG] Parsed values:', {
        dateString,
        isAvailable,
        toggleButtonFound: !!toggleButton
      });
      
      // Collect time slots if available
      let timeSlots = [];
      if (isAvailable) {
        const timesContainer = document.getElementById('override-times');
        const timeSlotDivs = timesContainer.querySelectorAll('.flex.items-center.gap-2');
        
        timeSlotDivs.forEach(div => {
          const inputs = div.querySelectorAll('input');
          if (inputs.length >= 2 && inputs[0].value && inputs[1].value) {
            timeSlots.push({
              start: inputs[0].value,
              end: inputs[1].value
            });
          }
        });
      }
      
      console.log('[OVERRIDE DEBUG] Time slots collected:', timeSlots);
      
      // Persist override to backend (first slot if provided)
      try {
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        let body = { date: dateString, available: isAvailable };
        if (isAvailable && timeSlots.length > 0) {
          body = { ...body, start: timeSlots[0].start, end: timeSlots[0].end };
        }
        
        console.log('[OVERRIDE DEBUG] Request body:', body);
        console.log('[OVERRIDE DEBUG] API URL:', `${API_URL}/availability/overrides`);
        
        const res = await fetch(`${API_URL}/availability/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(clean && { Authorization: `Bearer ${clean}` }) },
          body: JSON.stringify(body)
        });
        
        console.log('[OVERRIDE DEBUG] Response status:', res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[OVERRIDE DEBUG] Failed to save override:', res.status, errorText);
          showNotification('Failed to save override');
          return;
        }
        
        console.log('[OVERRIDE DEBUG] Override saved successfully');
      } catch (e) {
        console.error('[OVERRIDE DEBUG] Error saving override:', e);
        showNotification('Failed to save override');
        return;
      }
      
      // Update calendar display
      await fetchCalendarOverrides();
      renderCalendar();
      
      showNotification('Override saved successfully');
      closeOverrideModal();
    }

    async function confirmDeleteOverride() {
      if (!selectedDate) {
        showNotification('No date selected');
        return;
      }
      
      console.log('[OVERRIDE DEBUG] confirmDeleteOverride called:', {
        selectedDate,
        selectedDateType: typeof selectedDate
      });
      
      // selectedDate is stored as a string (YYYY-MM-DD)
      const dateString = typeof selectedDate === 'string' ? selectedDate : new Date(selectedDate).toISOString().split('T')[0];
      
      console.log('[OVERRIDE DEBUG] Delete date string:', dateString);
      console.log('[OVERRIDE DEBUG] Current calendarOverrides before deletion:', calendarOverrides);
      
      // Remove override from backend
      try {
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        const url = `${API_URL}/availability/overrides/${dateString}`;
        
        console.log('[OVERRIDE DEBUG] Delete URL:', url);
        console.log('[OVERRIDE DEBUG] Token available:', !!clean);
        
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { 
            ...(clean && { Authorization: `Bearer ${clean}` }),
            'Cache-Control': 'no-cache'
          }
        });
        
        console.log('[OVERRIDE DEBUG] Delete response status:', res.status);
        console.log('[OVERRIDE DEBUG] Delete response headers:', Object.fromEntries(res.headers.entries()));
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[OVERRIDE DEBUG] Failed to delete override:', res.status, errorText);
          showNotification('Failed to delete override');
          return;
        }
        
        const responseText = await res.text();
        console.log('[OVERRIDE DEBUG] Delete response body:', responseText);
        console.log('[OVERRIDE DEBUG] Override deleted successfully');
      } catch (e) {
        console.error('[OVERRIDE DEBUG] Error deleting override:', e);
        showNotification('Failed to delete override');
        return;
      }
      
      // Update calendar display
      console.log('[OVERRIDE DEBUG] Fetching updated overrides...');
      // Add a small delay to ensure database has processed the delete
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchCalendarOverrides();
      console.log('[OVERRIDE DEBUG] CalendarOverrides after fetch:', calendarOverrides);
      
      console.log('[OVERRIDE DEBUG] Re-rendering calendar...');
      renderCalendar();
      
      showNotification('Override deleted successfully');
      // Close both modals
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-confirm-modal').classList.add('hidden');
      
      // Add a brief visual feedback to show the change
      console.log('[OVERRIDE DEBUG] Override deleted, calendar re-rendered with updated data');
    }

    function closeDeleteConfirmModal() {
      document.getElementById('delete-confirm-modal').classList.add('hidden');
      // Show the override modal again
      document.getElementById('override-modal').classList.remove('hidden');
    }

    function createWorkflow() {
      localStorage.removeItem('calendarify-current-workflow');
      window.location.href = '/dashboard/editor';
    }

    function editWorkflow(id) {
      localStorage.setItem('calendarify-current-workflow', id);
      window.location.href = '/dashboard/editor';
    }

    async function cloneWorkflow(id) {
      const token = getAnyToken();
      const clean = token.replace(/^"|"$/g, '');

      const existingRes = await fetch(`${API_URL}/workflows/${id}`, { headers: { Authorization: `Bearer ${clean}` } });
      if (!existingRes.ok) return;
      const wf = await existingRes.json();

      const res = await fetch(`${API_URL}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
        body: JSON.stringify({ name: wf.name + ' Copy', description: wf.description, data: wf.data }),
      });
      if (res.ok) {
        showNotification('Workflow cloned');
        renderWorkflows();
      }
    }

    function deleteWorkflow(id) {
      window.workflowToDelete = id;
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('delete-workflow-confirm-modal').classList.remove('hidden');
    }

    async function confirmDeleteWorkflow() {
      const workflowId = window.workflowToDelete;
      if (workflowId) {
        try {
          const token = getAnyToken();
          const clean = token.replace(/^"|"$/g, '');
          const response = await fetch(`${API_URL}/workflows/${workflowId}`, { 
            method: 'DELETE', 
            headers: { Authorization: `Bearer ${clean}` } 
          });
          
          if (response.ok) {
            showNotification('Workflow deleted successfully');
            closeDeleteWorkflowConfirmModal();
            // Remove from localStorage cache
            const cachedWorkflows = JSON.parse(localStorage.getItem('calendarify-workflows') || '[]');
            const updatedWorkflows = cachedWorkflows.filter(w => w.id !== workflowId);
            localStorage.setItem('calendarify-workflows', JSON.stringify(updatedWorkflows));
            // Re-render the workflows
            await renderWorkflows();
          } else {
            const errorText = await response.text();
            console.error('Delete failed:', response.status, errorText);
            showNotification('Failed to delete workflow');
          }
        } catch (error) {
          console.error('Delete error:', error);
          showNotification('Failed to delete workflow');
        }
      }
    }

    function closeDeleteWorkflowConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-workflow-confirm-modal').classList.add('hidden');
      window.workflowToDelete = null;
    }

    function showEventTypesModal(workflowId, eventTypes) {
      const modal = document.getElementById('event-types-modal');
      const list = document.getElementById('event-types-list');
      
      // Store workflow ID for delete operations
      modal.setAttribute('data-workflow-id', workflowId);
      
      // Clear previous content
      list.innerHTML = '';
      
      // Add event types to the list
      if (eventTypes && eventTypes.length > 0) {
        eventTypes.forEach((eventType, index) => {
          const item = document.createElement('div');
          item.className = 'flex items-center justify-between p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg hover:border-[#34D399] transition-colors';
          item.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="material-icons-outlined text-[#34D399]">event</span>
              <span class="text-[#E0E0E0] font-medium">${eventType}</span>
            </div>
            <button onclick="removeEventTypeFromWorkflow('${workflowId}', ${index})" class="p-1 text-[#A3B3AF] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Remove event type">
              <span class="material-icons-outlined text-sm">delete</span>
            </button>
          `;
          list.appendChild(item);
        });
      } else {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-3 p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg';
        item.innerHTML = `
          <span class="material-icons-outlined text-[#A3B3AF]">event</span>
          <span class="text-[#A3B3AF]">All Event Types</span>
        `;
        list.appendChild(item);
      }
      
      // Show modal
      document.getElementById('modal-backdrop').classList.remove('hidden');
      modal.classList.remove('hidden');
    }

    function closeEventTypesModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('event-types-modal').classList.add('hidden');
    }

    async function removeEventTypeFromWorkflow(workflowId, eventTypeIndex) {
      const token = getAnyToken();
      const clean = token.replace(/^"|"$/g, '');

      const res = await fetch(`${API_URL}/workflows/${workflowId}`, { headers: { Authorization: `Bearer ${clean}` } });
      if (!res.ok) return;
      const workflow = await res.json();

      const wfData = workflow.data || {};
      wfData.triggerEventTypes = wfData.triggerEventTypes || [];

      if (wfData.triggerEventTypes.length > eventTypeIndex) {
        wfData.triggerEventTypes.splice(eventTypeIndex, 1);

        if (wfData.triggerEventTypes.length === 0) {
          wfData.triggerEventTypes = [];
          wfData.status = false;
          showNotification('Last event type removed. Workflow disabled and set to "All Event Types"');
        } else {
          showNotification('Event type removed from workflow');
        }

        await fetch(`${API_URL}/workflows/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ data: wfData }),
        });

        if (wfData.triggerEventTypes.length === 0) {
          closeEventTypesModal();
        } else {
          showEventTypesModal(workflowId, wfData.triggerEventTypes);
        }

        renderWorkflows();
      }
    }

    async function toggleWorkflowStatus(id, button) {
      const token = getAnyToken();
      const clean = token.replace(/^"|"$/g, '');

      const res = await fetch(`${API_URL}/workflows/${id}`, { headers: { Authorization: `Bearer ${clean}` } });
      if (!res.ok) return;
      const wf = await res.json();

      const wfData = wf.data || {};
      wfData.status = !wfData.status;

      await fetch(`${API_URL}/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
        body: JSON.stringify({ data: wfData }),
      });

      const isActive = wfData.status;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.classList.toggle('bg-[#34D399]', isActive);
      button.classList.toggle('bg-[#19342e]', !isActive);
      const circle = button.querySelector('div');
      if (circle) {
        circle.style.transform = isActive ? 'translateX(20px)' : 'translateX(0)';
      }
    }

    async function renderWorkflows() {
      const tbody = document.getElementById('workflows-tbody');
      // Always fetch fresh data from server to ensure UI is up to date
      let workflows = await fetchWorkflowsFromServer();
      
      function formatEventTypes(eventTypes) {
        if (!eventTypes || eventTypes.length === 0) {
          return 'All Event Types';
        }
        
        if (eventTypes.length === 1) {
          return eventTypes[0];
        }
        
        if (eventTypes.length === 2) {
          return eventTypes.join(', ');
        }
        
        return `${eventTypes.length} event types`;
      }
      
      tbody.innerHTML = workflows.map(w => {
        const displayText = formatEventTypes(w.triggerEventTypes);
        const hasEventTypes = w.triggerEventTypes && w.triggerEventTypes.length > 0;
        
        return `
          <tr class="table-row" id="workflow-${w.id}">
            <td class="py-2 text-center">${w.name}</td>
            <td class="py-2 text-center">
              <button type="button" aria-pressed="${w.status ? 'true' : 'false'}" class="w-12 h-7 ${w.status ? 'bg-[#34D399]' : 'bg-[#19342e]'} rounded-full relative cursor-pointer border border-[#34D399] transition-colors duration-300" onclick="toggleWorkflowStatus('${w.id}', this)">
                <div class="w-6 h-6 bg-white rounded-full absolute" style="top:1px; left:1px; transition:transform 0.3s, background-color 0.3s; transform:translateX(${w.status ? '20px' : '0'});"></div>
              </button>
            </td>
            <td class="py-2 text-center">
              ${hasEventTypes ? `
                <button class="inline-flex items-center gap-1 px-2 py-1 bg-[#19342e] hover:bg-[#1E3A34] border border-[#2C4A43] hover:border-[#34D399] rounded-lg text-sm text-[#E0E0E0] hover:text-[#34D399] transition-all duration-200" onclick="showEventTypesModal('${w.id}', ${JSON.stringify(w.triggerEventTypes).replace(/"/g, '&quot;')})">
                  ${displayText}
                  <span class="material-icons-outlined text-xs">info</span>
                </button>
              ` : `
                <span class="text-[#E0E0E0]">${displayText}</span>
              `}
            </td>
            <td class="py-2 text-center">${w.lastEdited}</td>
            <td class="py-2 text-center">
              <div class="flex gap-2 justify-center">
                <button class="btn-secondary" onclick="editWorkflow('${w.id}')">Edit</button>
                <button class="btn-secondary" onclick="cloneWorkflow('${w.id}')">Clone</button>
                <button class="btn-secondary" onclick="deleteWorkflow('${w.id}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function addContact() {
      await renderTagOptions();
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('add-contact-modal').classList.remove('hidden');
    }

    function showNotification(message) {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-[#34D399] text-[#1A2E29] px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
      notification.remove();
    }, 3000);
    }

    async function openProfileModal() {
      const backdrop = document.getElementById('modal-backdrop');
      const modal = document.getElementById('profile-modal');
      if (!modal || !backdrop) return;
      backdrop.classList.remove('hidden');
      modal.classList.remove('hidden');
      document.getElementById('profile-timezone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const token = getAnyToken();
      if (token) {
        try {
          const cleanToken = token.replace(/^"|"$/g, "");
          const res = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${cleanToken}` } });
          if (res.ok) {
            const data = await res.json();
            document.getElementById('profile-name').textContent = data.name || 'User';
            document.getElementById('profile-email').textContent = data.email || '';
            document.getElementById('profile-displayname').textContent = data.display_name || '';
            freshUserState['calendarify-display-name'] = data.display_name || '';
          } else {
            console.error('Failed to load profile: HTTP', res.status);
          }
        } catch (e) {
          console.error('Failed to load profile', e);
        }
      }
    }

    function closeProfileModal() {
      document.getElementById('profile-modal').classList.add('hidden');
      document.getElementById('modal-backdrop').classList.add('hidden');
    }

    function openChangeDisplayNameModal() {
      const displayName = localStorage.getItem('calendarify-display-name') || '';
      // Remove any surrounding quotes from the display name
      const cleanDisplayName = displayName.replace(/^["']|["']$/g, '');
      document.getElementById('change-displayname-input').value = cleanDisplayName;
      document.getElementById('change-displayname-modal').classList.remove('hidden');
      document.getElementById('modal-backdrop').classList.remove('hidden');
    }

    function closeChangeDisplayNameModal() {
      document.getElementById('change-displayname-modal').classList.add('hidden');
      // Only hide the backdrop if the profile modal is not open
      const profileModal = document.getElementById('profile-modal');
      if (!profileModal || profileModal.classList.contains('hidden')) {
        document.getElementById('modal-backdrop').classList.add('hidden');
      }
    }

    async function saveDisplayName() {
      const input = document.getElementById('change-displayname-input');
      const newName = input.value.trim();
      if (!newName) return;
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
        body: JSON.stringify({ displayName: newName })
      });
      if (res.ok) {
        const data = await res.json();
        // Clean the display name to remove any quotes
        const cleanDisplayName = data.display_name.replace(/^["']|["']$/g, '');
        document.getElementById('profile-displayname').textContent = cleanDisplayName;
        freshUserState['calendarify-display-name'] = cleanDisplayName;
        showNotification('Display name updated');
      } else {
        const text = await res.text();
        showNotification(text || 'Failed to update');
      }
      closeChangeDisplayNameModal();
    }

    window.openChangeDisplayNameModal = openChangeDisplayNameModal;
    window.closeChangeDisplayNameModal = closeChangeDisplayNameModal;
    window.saveDisplayName = saveDisplayName;

    // Close modals when clicking backdrop
    document.getElementById('modal-backdrop').addEventListener('click', function() {
      // Check if change display name modal is open
      const changeDisplayNameModal = document.getElementById('change-displayname-modal');
      const profileModal = document.getElementById('profile-modal');
      
      // If change display name modal is open, only close it and keep profile modal open
      if (changeDisplayNameModal && !changeDisplayNameModal.classList.contains('hidden')) {
        changeDisplayNameModal.classList.add('hidden');
        // Don't hide backdrop if profile modal is still open
        if (!profileModal || profileModal.classList.contains('hidden')) {
          document.getElementById('modal-backdrop').classList.add('hidden');
        }
        return;
      }
      
      // Otherwise, close all modals as usual
      document.querySelectorAll('.hidden').forEach(el => {
        if (el.id === 'modal-backdrop' || el.id === 'share-modal' || el.id === 'delete-event-type-confirm-modal' || el.id === 'cancel-meeting-confirm-modal' || el.id === 'delete-meeting-confirm-modal' || el.id === 'add-contact-modal' || el.id === 'delete-workflow-confirm-modal' || el.id === 'delete-contact-confirm-modal' || el.id === 'event-types-modal' || el.id === 'create-tag-modal' || el.id === 'tags-modal' || el.id === 'profile-modal' || el.id === 'change-displayname-modal' || el.id === 'reschedule-modal' || el.id === 'add-question-modal') {
          el.classList.add('hidden');
        }
      });
      // Reset backdrop z-index
      const backdrop = document.getElementById('modal-backdrop');
      backdrop.style.zIndex = '50';
      // Clear any stored data
      window.meetingToCancel = null;
      window.meetingToDelete = null;
      window.meetingToReschedule = null;
      window.workflowToDelete = null;
      window.contactToDelete = null;
      window.tagToDelete = null;
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.relative')) {
        document.querySelectorAll('.card-menu, #create-menu').forEach(menu => {
          menu.classList.add('hidden');
        });
      }
    });

    // --- 12h/24h Toggle Functionality ---
    function toggleClockFormat() {
      const is12h = getClockFormat() === '12h';
      const newFormat = is12h ? '24h' : '12h';
      
      // Store current time values before switching
      const timeInputs = document.querySelectorAll('input[type="time"]');
      const currentValues = Array.from(timeInputs).map(input => ({
        element: input,
        value: input.value,
        format: is12h ? '12h' : '24h'
      }));
      
      // Update format preference
      setClockFormat(newFormat);
      updateClockFormatUI();
      
      // Convert all time inputs to new format
      currentValues.forEach(({ element, value, format }) => {
        if (value) {
          const newValue = convertTimeFormat(value, format, newFormat);
          element.value = newValue;
        }
      });
      addAMPMDisplay();
      // Re-render meetings table to apply new format to Date/Time column
      try {
        const currentTab = getMeetingsTab ? getMeetingsTab() : 'upcoming';
        if (typeof updateMeetingsTable === 'function') {
          updateMeetingsTable(currentTab);
        }
      } catch (_) {}
    }

    function getClockFormat() {
      try {
        const stored = localStorage.getItem('calendarify-dashboard-clock-format');
        return stored === '12h' ? '12h' : '24h';
      } catch (_) {
      return '24h';
      }
    }

    function setClockFormat(format) {
      try {
        localStorage.setItem('calendarify-dashboard-clock-format', format === '12h' ? '12h' : '24h');
      } catch (_) {}
    }

    function updateClockFormatUI() {
      const is12h = getClockFormat() === '12h';
      // Availability section toggle
      const toggle = document.getElementById('clock-format-toggle');
      const circle = document.getElementById('toggle-circle');
      if (toggle && circle) {
        toggle.setAttribute('aria-pressed', is12h ? 'true' : 'false');
        toggle.classList.toggle('bg-[#34D399]', is12h);
        toggle.classList.toggle('bg-[#19342e]', !is12h);
        circle.style.transform = is12h ? 'translateX(20px)' : 'translateX(0)';
        circle.style.backgroundColor = is12h ? '#fff' : '#34D399';
      }
      // Meetings section toggle
      const meetingsToggle = document.getElementById('meetings-clock-format-toggle');
      const meetingsCircle = document.getElementById('meetings-toggle-circle');
      if (meetingsToggle && meetingsCircle) {
        meetingsToggle.setAttribute('aria-pressed', is12h ? 'true' : 'false');
        meetingsToggle.classList.toggle('bg-[#34D399]', is12h);
        meetingsToggle.classList.toggle('bg-[#19342e]', !is12h);
        meetingsCircle.style.transform = is12h ? 'translateX(20px)' : 'translateX(0)';
        meetingsCircle.style.backgroundColor = is12h ? '#fff' : '#34D399';
      }
    }

    function updateAllTimeInputs() {
      const is12h = getClockFormat() === '12h';
      document.querySelectorAll('input[type="time"]').forEach(input => {
        if (input.value) {
          // Convert from 24h (input default) to current format
          const newValue = convertTimeFormat(input.value, '24h', is12h ? '12h' : '24h');
          input.value = newValue;
        }
      });
      addAMPMDisplay();
    }

    // Converts time between formats, preserving the actual time
    function convertTimeFormat(value, fromFormat, toFormat) {
      if (!value || !/^\d{2}:\d{2}$/.test(value)) return value;
      
      let [hours, minutes] = value.split(':').map(Number);
      
      if (fromFormat === toFormat) {
        return value; // No conversion needed
      }
      
      if (fromFormat === '24h' && toFormat === '12h') {
        // Convert 24h to 12h
        if (hours === 0) {
          return `12:${minutes.toString().padStart(2, '0')}`;
        } else if (hours > 12) {
          return `${(hours - 12).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      } else if (fromFormat === '12h' && toFormat === '24h') {
        // Convert 12h to 24h
        // We need to determine AM/PM from context or assume AM for 1-11, PM for 12
        if (hours === 12) {
          return `12:${minutes.toString().padStart(2, '0')}`; // 12 PM
        } else if (hours >= 1 && hours <= 11) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`; // AM
        } else {
          // This shouldn't happen with valid 12h input, but fallback
          return value;
        }
      }
      
      return value;
    }

    // Add AM/PM display to time inputs
    function addAMPMDisplay() {
      const is12h = getClockFormat() === '12h';
      document.querySelectorAll('.time-input-wrap').forEach(wrapper => {
        const input = wrapper.querySelector('input[type="time"]');
        if (!input) return;
        let ampmSpan = wrapper.querySelector('.ampm-indicator');
        if (!ampmSpan) {
          ampmSpan = document.createElement('span');
          ampmSpan.className = 'ampm-indicator text-[#A3B3AF] text-sm ml-1';
          input.after(ampmSpan);
        }
        if (!is12h) {
          ampmSpan.textContent = '';
          ampmSpan.style.display = 'none';
          return;
        }
        ampmSpan.style.display = '';
        if (input.value) {
          let [hours] = input.value.split(':').map(Number);
          ampmSpan.textContent = (hours >= 12 ? 'PM' : 'AM');
        } else {
          ampmSpan.textContent = '';
        }
      });
    }

    // Update AM/PM display when time inputs change
    function setupTimeInputListeners() {
    document.querySelectorAll('input[type="time"]').forEach(input => {
        input.removeEventListener('change', addAMPMDisplay);
        input.removeEventListener('input', addAMPMDisplay);
        input.addEventListener('change', addAMPMDisplay);
        input.addEventListener('input', addAMPMDisplay);
      });
    }

    // Initialize the dashboard
    document.addEventListener('DOMContentLoaded', async function() {
      await initAuth('dashboard-body');
      await loadState();

      // Apply persisted time format to toggles, inputs, and pickers
      updateClockFormatUI();
      updateAllTimeInputs();
      updateAllCustomTimePickers();

      let sectionToShow = 'event-types';
      let navToShow = document.querySelector('.nav-item[data-section="event-types"]');

      const redirectTo = localStorage.getItem('calendarify-redirect-to');
      if (redirectTo) {
        localStorage.removeItem('calendarify-redirect-to');
        const targetNav = document.querySelector(`.nav-item[data-section="${redirectTo}"]`);
        if (targetNav) {
          sectionToShow = redirectTo;
          navToShow = targetNav;
        }
      } else {
        const savedSection = localStorage.getItem('calendarify-current-section');
        if (savedSection) {
          const savedNav = document.querySelector(`.nav-item[data-section="${savedSection}"]`);
          if (savedNav) {
            sectionToShow = savedSection;
            navToShow = savedNav;
          }
        }
      }

      // Check for workflow notification
      const notification = localStorage.getItem('calendarify-notification');
      if (notification) {
        localStorage.removeItem('calendarify-notification');
        showNotification(notification, 'success');
      }

      // Always use showSection, which now robustly restores availability UI
      showSection(sectionToShow, navToShow);

      setupTimeInputListeners();
      fetchTagsFromServer();
      fetchWorkflowsFromServer();
      fetchContactsFromServer();
      await fetchEventTypesFromServer();
      renderEventTypes();
      renderWorkflows();

      const avatar = document.getElementById('profile-avatar');
      if (avatar) avatar.addEventListener('click', openProfileModal);
    });

    // Expose toggle to window for inline onclick handlers in HTML
    window.toggleClockFormat = toggleClockFormat;

    // --- Custom Time Picker ---
    function showTimeDropdown(input) {
      const picker = input.closest('.custom-time-picker');
      const dropdown = picker.querySelector('.time-dropdown');
      if (dropdown.classList.contains('open')) return; // Don't re-open if already open
      closeAllTimeDropdowns();
      const hourSel = dropdown.querySelector('.hour-select');
      const minSel = dropdown.querySelector('.minute-select');
      const ampmSel = dropdown.querySelector('.ampm-select');
      const is12h = getClockFormat() === '12h';
      // Populate hours
      hourSel.innerHTML = '';
      if (is12h) {
        for (let h = 1; h <= 12; h++) {
          hourSel.innerHTML += `<option value="${h.toString().padStart(2, '0')}">${h.toString().padStart(2, '0')}</option>`;
        }
        ampmSel.style.display = '';
      } else {
        for (let h = 0; h < 24; h++) {
          hourSel.innerHTML += `<option value="${h.toString().padStart(2, '0')}">${h.toString().padStart(2, '0')}</option>`;
        }
        ampmSel.style.display = 'none';
      }
      // Populate minutes
      minSel.innerHTML = '';
      for (let m = 0; m < 60; m += 5) {
        minSel.innerHTML += `<option value="${m.toString().padStart(2, '0')}">${m.toString().padStart(2, '0')}</option>`;
      }
      // Set current value
      let val = input.value || input.placeholder || (is12h ? '09:00 AM' : '09:00');
      let [h, m, ap] = parseTimeString(val, is12h);
      hourSel.value = h;
      minSel.value = m;
      if (is12h) ampmSel.value = ap;
      dropdown.classList.remove('hidden');
      setTimeout(() => { dropdown.classList.add('open'); }, 10);
    }

    function setTimeFromDropdown(btn, setValue) {
      const dropdown = btn.closest('.time-dropdown');
      const picker = dropdown.closest('.custom-time-picker');
      const input = picker.querySelector('input');
      const hourSel = dropdown.querySelector('.hour-select');
      const minSel = dropdown.querySelector('.minute-select');
      const ampmSel = dropdown.querySelector('.ampm-select');
      const is12h = getClockFormat() === '12h';
      let h = hourSel.value;
      let m = minSel.value;
      let ap = is12h ? ampmSel.value : '';
      let display = is12h ? `${h}:${m} ${ap}` : `${h}:${m}`;
      if (setValue) input.value = display;

      const container = picker.closest('[id$="-times"]');
      if (container) {
        // No localStorage caching - just sync to backend
        syncAvailabilityRules();
        syncState();
      }
      closeTimeDropdown(btn);
    }

    function closeTimeDropdown(el) {
      const dropdown = el.closest('.time-dropdown');
      dropdown.classList.remove('open');
      setTimeout(() => { dropdown.classList.add('hidden'); }, 150);
    }

    function closeAllTimeDropdowns() {
      document.querySelectorAll('.time-dropdown.open').forEach(dd => {
        dd.classList.remove('open');
        setTimeout(() => { dd.classList.add('hidden'); }, 150);
      });
    }

    function parseTimeString(val, is12h) {
      val = val.trim();
      let h = '09', m = '00', ap = 'AM';
      if (is12h) {
        let match = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (match) {
          h = match[1].padStart(2, '0');
          m = match[2];
          ap = (match[3] || 'AM').toUpperCase();
        }
      } else {
        let match = val.match(/^(\d{2}):(\d{2})$/);
        if (match) {
          h = match[1];
          m = match[2];
        }
      }
      return [h, m, ap];
    }

    // When toggling 12h/24h, update all custom pickers
    function updateAllCustomTimePickers() {
      document.querySelectorAll('.custom-time-picker input').forEach(input => {
        let val = input.value || input.placeholder || '09:00';
        let targetIs12h = getClockFormat() === '12h';
        // Always treat as 24h format from backend/localStorage
        let [h, m] = parseTimeString(val, false); // false = 24h
        if (targetIs12h) {
          // Convert to 12h format for display
          let hour = parseInt(h, 10);
          let ap = hour >= 12 ? 'PM' : 'AM';
          let displayHour = hour % 12 || 12;
          input.value = `${displayHour.toString().padStart(2, '0')}:${m} ${ap}`;
        } else {
          // Display as 24h
          input.value = `${h}:${m}`;
        }
      });
    }

    // Update all pickers on toggle
    const origToggleClockFormat = toggleClockFormat;
    toggleClockFormat = function() {
      origToggleClockFormat.apply(this, arguments);
      restoreWeeklyHours(); // repopulate from localStorage (24h)
      // updateAllCustomTimePickers(); // no longer needed here, restoreWeeklyHours calls it
    };

    // Close dropdowns on outside click
    document.addEventListener('mousedown', function(e) {
      if (!e.target.closest('.custom-time-picker')) closeAllTimeDropdowns();
    });

    // --- Day Availability Toggle ---
    function toggleDayAvailability(day, button) {
      const timestamp = new Date().toISOString();
      const isAvailable = button.getAttribute('aria-pressed') === 'true';
      const timeContainer = document.getElementById(day + '-times');
      const circle = button.querySelector('div');
      
      
      
      if (isAvailable) {
        // Disable the day (unavailable)
        button.setAttribute('aria-pressed', 'false');
        button.classList.remove('bg-[#34D399]');
        button.classList.add('bg-[#19342e]');
        circle.style.transform = 'translateX(0)';
        circle.style.backgroundColor = '#34D399';
        
        // Disable time inputs
        timeContainer.classList.add('opacity-50');
        timeContainer.querySelectorAll('input').forEach(input => {
          input.disabled = true;
          input.classList.add('cursor-not-allowed', 'bg-[#111f1c]', 'text-[#6B7C78]');
          input.classList.remove('cursor-pointer', 'bg-[#19342e]', 'text-[#E0E0E0]');
        });
      } else {
        // Enable the day (available)
        button.setAttribute('aria-pressed', 'true');
        button.classList.remove('bg-[#19342e]');
        button.classList.add('bg-[#34D399]');
        circle.style.transform = 'translateX(20px)';
        circle.style.backgroundColor = '#fff';
        
        // Enable time inputs
        timeContainer.classList.remove('opacity-50');
        timeContainer.querySelectorAll('input').forEach(input => {
          input.disabled = false;
          input.classList.remove('cursor-not-allowed', 'bg-[#111f1c]', 'text-[#6B7C78]');
          input.classList.add('cursor-pointer', 'bg-[#19342e]', 'text-[#E0E0E0]');
        });
      }
      
      // Sync availability rules to backend (no localStorage caching)
      syncAvailabilityRules();
      syncState();
    }

    // Sync availability rules to backend
    async function syncAvailabilityRules() {
      const timestamp = new Date().toISOString();
      console.log(`[🔍 TEMP DEBUG ${timestamp}] ===== STARTING AVAILABILITY SYNC =====`);
      
      const token = getAnyToken();
      if (!token) {
        console.error(`[❌ TEMP DEBUG ${timestamp}] No authentication token found`);
        return;
      }
      
      const cleanToken = token.replace(/^"|"$/g, "");
      console.log(`[🔍 TEMP DEBUG ${timestamp}] Token found, length: ${cleanToken.length}`);
      
      // Get current availability from UI instead of localStorage
      const dayAvailability = {};
      const weeklyHours = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      console.log(`[🔍 TEMP DEBUG ${timestamp}] Reading availability from UI...`);
      
      dayNames.forEach((day, index) => {
        // Get day availability from toggle button
        const dayButton = document.querySelector(`button[onclick="toggleDayAvailability('${day}', this)"]`);
        if (dayButton) {
          const buttonState = dayButton.getAttribute('aria-pressed');
          dayAvailability[day] = buttonState === 'true';
          console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} button state: aria-pressed="${buttonState}" -> available=${dayAvailability[day]}`);
        } else {
          console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} button NOT FOUND`);
        }
        
        // Get time inputs from the day's time container
        const timeContainer = document.getElementById(day + '-times');
        if (timeContainer) {
          const inputs = timeContainer.querySelectorAll('input.time-input');
          console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time inputs found: ${inputs.length}`);
          if (inputs.length >= 2 && inputs[0].value && inputs[1].value) {
            const startTime = inputs[0].value;
            const endTime = inputs[1].value;
            
            console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} raw input values: start="${startTime}", end="${endTime}"`);
            
            // Validate that start and end times are different
            if (startTime !== endTime) {
              weeklyHours[day] = {
                start: startTime,
                end: endTime
              };
              console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time range stored: ${startTime} - ${endTime}`);
            } else {
              console.warn(`[⚠️ TEMP DEBUG ${timestamp}] ${day} has same start and end time: ${startTime}`);
            }
          } else {
            console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time inputs missing or empty: inputs=${inputs.length}, start="${inputs[0]?.value || 'EMPTY'}", end="${inputs[1]?.value || 'EMPTY'}"`);
          }
        } else {
          console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time container NOT FOUND`);
        }
      });
      
      console.log(`[🔍 TEMP DEBUG ${timestamp}] Final dayAvailability:`, dayAvailability);
      console.log(`[🔍 TEMP DEBUG ${timestamp}] Final weeklyHours:`, weeklyHours);
      
      // Convert to availability rules format
      const rules = [];
      
      dayNames.forEach((day, index) => {
        const isAvailable = dayAvailability[day] === true;
        console.log(`[🔍 TEMP DEBUG ${timestamp}] Processing ${day} (index ${index}): isAvailable=${isAvailable}, hasWeeklyHours=${!!weeklyHours[day]}`);
        
        if (isAvailable) {
          if (weeklyHours[day]) {
            const startTime = weeklyHours[day].start;
            const endTime = weeklyHours[day].end;
            
            // Convert local time to UTC minutes
            const startMinutes = convertLocalTimeToUTCMinutes(startTime);
            const endMinutes = convertLocalTimeToUTCMinutes(endTime);
            
            console.log(`[🔍 TEMP DEBUG ${timestamp}] Converting ${day} availability:`, {
              localStart: startTime,
              localEnd: endTime,
              utcStartMinutes: startMinutes,
              utcEndMinutes: endMinutes
            });
            
            // Validate that start time is before end time
            if (startMinutes >= endMinutes) {
              console.error(`[❌ TEMP DEBUG ${timestamp}] Invalid time range for ${day}: start (${startMinutes}) >= end (${endMinutes})`);
              return; // Skip this rule
            }
            
            const rule = {
              day_of_week: index,
              start_minute: startMinutes,
              end_minute: endMinutes
            };
            rules.push(rule);
            console.log(`[🔍 TEMP DEBUG ${timestamp}] Added rule for ${day}:`, rule);
          } else {
            // Day is available but has no time range - use default times
            console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} is available but has no time range, using default times`);
            const defaultStartMinutes = convertLocalTimeToUTCMinutes('09:00');
            const defaultEndMinutes = convertLocalTimeToUTCMinutes('17:00');
            
            const rule = {
              day_of_week: index,
              start_minute: defaultStartMinutes,
              end_minute: defaultEndMinutes
            };
            rules.push(rule);
            console.log(`[🔍 TEMP DEBUG ${timestamp}] Added default rule for ${day}:`, rule);
          }
        } else {
          console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} is marked as unavailable, will be removed from database`);
        }
      });
      
      // Don't send if no valid rules
      if (rules.length === 0) {
        console.log(`[🔍 TEMP DEBUG ${timestamp}] No valid availability rules to sync`);
        return;
      }
      
      console.log(`[🔍 TEMP DEBUG ${timestamp}] Sending ${rules.length} rules to backend:`, rules);
      
      try {
        const requestBody = { rules };
        console.log(`[🔍 TEMP DEBUG ${timestamp}] Request body:`, JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(`${API_URL}/availability/rules`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanToken}`,
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log(`[🔍 TEMP DEBUG ${timestamp}] Response status: ${response.status}`);
        console.log(`[🔍 TEMP DEBUG ${timestamp}] Response headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[❌ TEMP DEBUG ${timestamp}] Failed to sync availability rules: ${response.status} - ${errorText}`);
          console.error(`[❌ TEMP DEBUG ${timestamp}] Request body that failed:`, JSON.stringify(requestBody, null, 2));
        } else {
          const responseText = await response.text();
          console.log(`[✅ TEMP DEBUG ${timestamp}] Availability rules synced to backend successfully`);
          console.log(`[🔍 TEMP DEBUG ${timestamp}] Response body: ${responseText}`);
        }
      } catch (error) {
        console.error(`[❌ TEMP DEBUG ${timestamp}] Error syncing availability rules:`, error);
      }
      
      console.log(`[🔍 TEMP DEBUG ${timestamp}] ===== AVAILABILITY SYNC COMPLETE =====`);
    }

    // Helper function to parse time string to minutes
    function parseTimeToMinutes(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    }

    // Helper function to convert local time to UTC minutes
    function convertLocalTimeToUTCMinutes(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      // Convert local time to UTC
      const timezoneOffset = new Date().getTimezoneOffset(); // minutes (negative means local is ahead of UTC)
      const localMinutes = hours * 60 + minutes;
      const utcMinutes = localMinutes + timezoneOffset; // Add offset to convert local to UTC
      
      // Handle day wrapping (negative or > 1440 minutes)
      if (utcMinutes < 0) {
        return utcMinutes + 1440; // Add 24 hours
      } else if (utcMinutes >= 1440) {
        return utcMinutes - 1440; // Subtract 24 hours
      }
      
      return utcMinutes;
    }

    // Helper function to convert UTC time string to local time string
    function convertUTCTimeToLocalTime(utcTimeStr) {
      const [utcHours, utcMinutes] = utcTimeStr.split(':').map(Number);
      
      // Create a UTC date object
      const utcDate = new Date();
      utcDate.setUTCHours(utcHours, utcMinutes, 0, 0);
      
      // Convert to local time by adding timezone offset
      const timezoneOffset = utcDate.getTimezoneOffset(); // minutes
      const localDate = new Date(utcDate.getTime() + (timezoneOffset * 60000));
      
      const localHours = localDate.getHours();
      const localMinutes = localDate.getMinutes();
      
      return `${localHours.toString().padStart(2, '0')}:${localMinutes.toString().padStart(2, '0')}`;
    }

    // Helper function to convert UTC minutes back to time string
    function minutesToTimeString(minutes) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    // Debug function to check availability state
    window.debugAvailability = function() {
      console.log('🔍 Debugging availability state...\n');
      
      // Check what's in localStorage
      console.log('📋 Current localStorage calendarify data:');
      const calendarifyData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('calendarify-')) {
          try {
            const value = localStorage.getItem(key);
            calendarifyData[key] = value;
            console.log(`  ${key}: ${value}`);
          } catch (e) {
            console.log(`  ${key}: [Error reading]`);
          }
        }
      }
      
      console.log('\n📊 Parsed data:');
      if (calendarifyData['calendarify-weekly-hours']) {
        try {
          const weeklyHours = JSON.parse(calendarifyData['calendarify-weekly-hours']);
          console.log('  Weekly Hours:', weeklyHours);
        } catch (e) {
          console.log('  Weekly Hours: [Parse error]');
        }
      }
      
      if (calendarifyData['calendarify-day-availability']) {
        try {
          const dayAvailability = JSON.parse(calendarifyData['calendarify-day-availability']);
          console.log('  Day Availability:', dayAvailability);
        } catch (e) {
          console.log('  Day Availability: [Parse error]');
        }
      }
      
      console.log('\n🌍 Timezone Info:');
      console.log(`  Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      console.log(`  Timezone offset: ${new Date().getTimezoneOffset()} minutes`);
      console.log(`  Current local time: ${new Date().toLocaleTimeString()}`);
      console.log(`  Current UTC time: ${new Date().toUTCString()}`);
    };

    // Function to clear availability cache
    window.clearAvailabilityCache = function() {
      console.log('🗑️ Clearing availability cache...');
      localStorage.removeItem('calendarify-weekly-hours');
      localStorage.removeItem('calendarify-day-availability');
      console.log('✅ Cache cleared. Reload the page to see fresh data.');
      location.reload();
    };

    // --- Calendar Override System ---
    let currentDate = new Date();
    let selectedDate = null;
    let calendarOverrides = {};

    async function fetchCalendarOverrides() {
      try {
        const token = getAnyToken();
        if (!token) {
          console.log('[OVERRIDE DEBUG] No token available for fetching overrides');
          return;
        }
        
        const clean = token.replace(/^"|"$/g, '');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Get start and end of month
        const startDate = new Date(year, month, 1);
        // Fix: Use the last day of the month by getting the first day of next month and subtracting 1 day
        const endDate = new Date(year, month + 1, 0);
        // Ensure we include the full last day by adding 23:59:59
        endDate.setHours(23, 59, 59, 999);
        
        console.log('[OVERRIDE DEBUG] Fetching overrides for month:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        const response = await fetch(`${API_URL}/availability/overrides?start=${startDate.toISOString()}&end=${endDate.toISOString()}&t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${clean}` }
        });
        
        console.log('[OVERRIDE DEBUG] Overrides response status:', response.status);
        
        if (response.ok) {
          const overrides = await response.json();
          console.log('[OVERRIDE DEBUG] Fetched overrides:', overrides);
          console.log('[OVERRIDE DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));
          
          // Convert backend format to frontend format
          const oldCalendarOverrides = { ...calendarOverrides };
          calendarOverrides = {};
          overrides.forEach(override => {
            const dateString = override.date.split('T')[0];
            
            // Convert UTC minutes to local time for display
            let timeSlots = [];
            if (override.startMinute !== undefined && override.endMinute !== undefined) {
              // Create UTC midnight for the target date
              const [year, month, day] = dateString.split('-').map(n => parseInt(n));
              const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
              
              // Convert UTC minutes to local time by adding to UTC midnight
              const startUtc = new Date(utcMidnight.getTime() + override.startMinute * 60000);
              const endUtc = new Date(utcMidnight.getTime() + override.endMinute * 60000);
              
              // Convert to local time for display
              const startLocal = new Date(startUtc.getTime());
              const endLocal = new Date(endUtc.getTime());
              
              timeSlots = [{
                start: `${startLocal.getHours().toString().padStart(2, '0')}:${startLocal.getMinutes().toString().padStart(2, '0')}`,
                end: `${endLocal.getHours().toString().padStart(2, '0')}:${endLocal.getMinutes().toString().padStart(2, '0')}`
              }];
              
              console.log('[OVERRIDE DEBUG] Time conversion for', dateString, ':', {
                utcMinutes: { start: override.startMinute, end: override.endMinute },
                localTime: { start: timeSlots[0].start, end: timeSlots[0].end },
                utcMidnight: utcMidnight.toISOString(),
                startUtc: startUtc.toISOString(),
                endUtc: endUtc.toISOString(),
                startLocal: startLocal.toISOString(),
                endLocal: endLocal.toISOString()
              });
            }
            
            calendarOverrides[dateString] = {
              available: !override.isBusy,
              timeSlots: timeSlots
            };
          });
          
          console.log('[OVERRIDE DEBUG] Old calendarOverrides:', oldCalendarOverrides);
          console.log('[OVERRIDE DEBUG] New calendarOverrides:', calendarOverrides);
          console.log('[OVERRIDE DEBUG] Override count before:', Object.keys(oldCalendarOverrides).length);
          console.log('[OVERRIDE DEBUG] Override count after:', Object.keys(calendarOverrides).length);
        } else {
          console.error('[OVERRIDE DEBUG] Failed to fetch overrides:', response.status);
        }
      } catch (error) {
        console.error('[OVERRIDE DEBUG] Error fetching overrides:', error);
      }
    }

    async function initializeCalendar() {
      await fetchCalendarOverrides();
      renderCalendar();
    }

    function renderCalendar() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      console.log('[OVERRIDE DEBUG] renderCalendar called:', {
        year,
        month,
        calendarOverridesKeys: Object.keys(calendarOverrides),
        calendarOverridesCount: Object.keys(calendarOverrides).length
      });
      
      // Update month/year display
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;
      
      // Get first day of month and number of days
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Generate calendar days
      let calendarHTML = '';
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day"></div>';
      }
      
      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const override = calendarOverrides[dateString];
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        
        let dayClasses = 'calendar-day cursor-pointer';
        
        if (override) {
          console.log('[OVERRIDE DEBUG] Found override for', dateString, ':', override);
          // available=false -> fully unavailable (red)
          if (override.available === false) {
            dayClasses += ' override-unavailable';
          } else if (override.available === true && Array.isArray(override.timeSlots) && override.timeSlots.length > 0) {
            // has times -> partial (dark red)
            dayClasses += ' override-partial';
          } else {
            // available=true but no time slots - this shouldn't happen, but if it does, no highlighting
            console.log('[OVERRIDE DEBUG] Override exists but is available with no time slots - no highlighting applied');
          }
        }
        
        // Add today class if it's today (can be combined with override classes)
        if (isToday) {
          dayClasses += ' today';
        }
        
        if (!override && !isToday) {
          console.log('[OVERRIDE DEBUG] No override for', dateString, '- applying normal styling');
        }
        
        calendarHTML += `<div class="${dayClasses}" onclick="selectDate('${dateString}')">${day}</div>`;
      }
      
      document.getElementById('calendar-days').innerHTML = calendarHTML;
    }

    async function previousMonth() {
      currentDate.setMonth(currentDate.getMonth() - 1);
      await fetchCalendarOverrides();
      renderCalendar();
    }

    async function nextMonth() {
      currentDate.setMonth(currentDate.getMonth() + 1);
      await fetchCalendarOverrides();
      renderCalendar();
    }

    function selectDate(dateString) {
      selectedDate = dateString;
      const date = new Date(dateString);
      const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      document.getElementById('override-date').textContent = formattedDate;
      
      // Load existing override data if it exists
      const existingOverride = calendarOverrides[dateString];
      if (existingOverride) {
        loadOverrideData(existingOverride);
        // Show delete button if override exists
        document.getElementById('delete-override-btn').classList.remove('hidden');
        console.log('[OVERRIDE DEBUG] Delete button should be visible for', dateString);
      } else {
        resetOverrideForm();
        // Hide delete button if no override exists
        document.getElementById('delete-override-btn').classList.add('hidden');
        console.log('[OVERRIDE DEBUG] Delete button should be hidden for', dateString);
      }
      
      openOverrideModal();
    }

    function openOverrideModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('override-modal').classList.remove('hidden');
    }

    function closeOverrideModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('override-modal').classList.add('hidden');
      selectedDate = null;
    }

    function showDeleteOverrideConfirm() {
      console.log('[OVERRIDE DEBUG] showDeleteOverrideConfirm called');
      // Hide the override modal
      document.getElementById('override-modal').classList.add('hidden');
      // Show the delete confirmation modal (backdrop should already be visible)
      document.getElementById('delete-confirm-modal').classList.remove('hidden');
      console.log('[OVERRIDE DEBUG] Delete confirmation modal should now be visible');
    }

    function toggleOverrideAvailability(button) {
      const isAvailable = button.getAttribute('aria-pressed') === 'true';
      const timesContainer = document.getElementById('override-times');
      const circle = button.querySelector('div');
      
      if (isAvailable) {
        // Disable availability
        button.setAttribute('aria-pressed', 'false');
        button.classList.remove('bg-[#34D399]');
        button.classList.add('bg-[#19342e]');
        circle.style.transform = 'translateX(0)';
        circle.style.backgroundColor = '#34D399';
        
        timesContainer.style.opacity = '0.5';
        timesContainer.style.pointerEvents = 'none';
      } else {
        // Enable availability
        button.setAttribute('aria-pressed', 'true');
        button.classList.remove('bg-[#19342e]');
        button.classList.add('bg-[#34D399]');
        circle.style.transform = 'translateX(20px)';
        circle.style.backgroundColor = '#fff';
        
        timesContainer.style.opacity = '1';
        timesContainer.style.pointerEvents = 'auto';
      }
    }

    function addOverrideTimeSlot() {
      const container = document.getElementById('override-times');
      const newSlot = document.createElement('div');
      newSlot.className = 'flex items-center gap-2';
      newSlot.innerHTML = `
        <span class="custom-time-picker relative inline-flex items-center w-28">
          <input type="text" readonly class="time-input w-full flex-shrink-0 cursor-pointer bg-[#19342e] border border-[#2C4A43] text-[#E0E0E0] rounded px-3 py-2 focus:border-[#34D399] focus:ring-2 focus:ring-[#34D399]" placeholder="09:00 AM" onclick="showTimeDropdown(this)">
          <div class="time-dropdown absolute left-0 top-full mt-1 min-w-full bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg z-50 hidden p-2">
            <div class="flex gap-2 items-center justify-center">
              <select class="hour-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
              <span class="text-[#A3B3AF]">:</span>
              <select class="minute-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
              <select class="ampm-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]" style="display:none;"><option>AM</option><option>PM</option></select>
            </div>
            <div class="flex justify-end mt-2 gap-2 w-full">
              <button class="bg-[#34D399] text-[#1A2E29] px-3 py-1 rounded font-bold hover:bg-[#2C4A43] transition-colors" onclick="setTimeFromDropdown(this, true)">Set</button>
              <button class="text-[#A3B3AF] px-3 py-1 rounded hover:text-[#34D399]" onclick="closeTimeDropdown(this)">Cancel</button>
            </div>
          </div>
        </span>
        <span class="text-[#A3B3AF] flex-shrink-0">to</span>
        <span class="custom-time-picker relative inline-flex items-center w-28">
          <input type="text" readonly class="time-input w-full flex-shrink-0 cursor-pointer bg-[#19342e] border border-[#2C4A43] text-[#E0E0E0] rounded px-3 py-2 focus:border-[#34D399] focus:ring-2 focus:ring-[#34D399]" placeholder="17:00 PM" onclick="showTimeDropdown(this)">
          <div class="time-dropdown absolute left-0 top-full mt-1 min-w-full bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg z-50 hidden p-2">
            <div class="flex gap-2 items-center justify-center">
              <select class="hour-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
              <span class="text-[#A3B3AF]">:</span>
              <select class="minute-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
              <select class="ampm-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]" style="display:none;"><option>AM</option><option>PM</option></select>
            </div>
            <div class="flex justify-end mt-2 gap-2 w-full">
              <button class="bg-[#34D399] text-[#1A2E29] px-3 py-1 rounded font-bold hover:bg-[#2C4A43] transition-colors" onclick="setTimeFromDropdown(this, true)">Set</button>
              <button class="text-[#A3B3AF] px-3 py-1 rounded hover:text-[#34D399]" onclick="closeTimeDropdown(this)">Cancel</button>
            </div>
          </div>
        </span>
        <button class="text-[#A3B3AF] hover:text-[#34D399] transition-colors duration-200 p-1 rounded hover:bg-[#19342e] flex-shrink-0" onclick="removeOverrideTimeSlot(this)">
          <span class="material-icons-outlined text-lg">remove</span>
        </button>
      `;
      container.appendChild(newSlot);
    }

    function removeOverrideTimeSlot(button) {
      button.closest('.flex').remove();
    }

    function restoreDayAvailability() {
      // Always fetch fresh data from backend instead of using localStorage
      console.log('🔄 restoreDayAvailability called - fetching fresh data from backend');
      loadFreshAvailabilityData();
    }

    function restoreWeeklyHours() {
      // Always fetch fresh data from backend instead of using localStorage
      console.log('🔄 restoreWeeklyHours called - fetching fresh data from backend');
      loadFreshAvailabilityData();
    }

    // Load fresh availability data directly from backend
    async function loadFreshAvailabilityData() {
      const timestamp = new Date().toISOString();
      console.log(`[🔍 TEMP DEBUG ${timestamp}] ===== LOADING FRESH AVAILABILITY DATA =====`);
      
      const token = getAnyToken();
      if (!token) {
        console.log(`[🔍 TEMP DEBUG ${timestamp}] No token found, skipping load`);
        return;
      }
      
      const cleanToken = token.replace(/^"|"$/g, "");
      console.log(`[🔍 TEMP DEBUG ${timestamp}] Token found, length: ${cleanToken.length}`);
      
      try {
        // Fetch availability rules directly from the availability endpoint
        console.log(`[🔍 TEMP DEBUG ${timestamp}] Fetching from: ${API_URL}/availability/rules`);
        const res = await fetch(`${API_URL}/availability/rules`, {
          headers: { Authorization: `Bearer ${cleanToken}` },
        });
        
        console.log(`[🔍 TEMP DEBUG ${timestamp}] Response status: ${res.status}`);
        
        if (res.ok) {
          const availabilityRules = await res.json();
          console.log(`[🔍 TEMP DEBUG ${timestamp}] Raw availability rules from DB:`, availabilityRules);
          
          // Convert availability rules to the format expected by the frontend
          const dayAvailability = {};
          const weeklyHours = {};
          
          // Initialize all days as unavailable
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          dayNames.forEach(day => {
            dayAvailability[day] = false;
          });
          
          // Mark days with availability rules as available
          availabilityRules.forEach(rule => {
            const dayName = dayNames[rule.dayOfWeek];
            dayAvailability[dayName] = true;
            
            console.log(`[🔍 TEMP DEBUG ${timestamp}] Processing rule: dayOfWeek=${rule.dayOfWeek} -> dayName=${dayName}`);
            console.log(`[🔍 TEMP DEBUG ${timestamp}] Rule UTC times: startMinute=${rule.startMinute}, endMinute=${rule.endMinute}`);
            
            // Convert UTC minutes to local time strings for the frontend
            const localStartMinutes = convertUTCMinutesToLocalTime(rule.startMinute);
            const localEndMinutes = convertUTCMinutesToLocalTime(rule.endMinute);
            const localStartTime = minutesToTimeString(localStartMinutes);
            const localEndTime = minutesToTimeString(localEndMinutes);
            
            console.log(`[🔍 TEMP DEBUG ${timestamp}] Converted to local: startMinutes=${localStartMinutes} -> "${localStartTime}", endMinutes=${localEndMinutes} -> "${localEndTime}"`);
            
            weeklyHours[dayName] = {
              start: localStartTime,
              end: localEndTime
            };
          });
          
          // Apply frontend-only defaults if no availability data exists
          const hasAnyAvailability = Object.keys(dayAvailability).length > 0 || Object.keys(weeklyHours).length > 0;
          if (!hasAnyAvailability) {
            console.log('📅 No availability data found, applying frontend-only defaults');
          }
          
          console.log(`[🔍 TEMP DEBUG ${timestamp}] Final processed data:`, {
            dayAvailability,
            weeklyHours
          });
          
          // Update UI with fresh data
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          
          console.log(`[🔍 TEMP DEBUG ${timestamp}] Updating UI buttons...`);
          
          // Update day availability buttons
          days.forEach(day => {
            const button = document.querySelector(`button[onclick="toggleDayAvailability('${day}', this)"]`);
            if (button) {
              let isAvailable = dayAvailability.hasOwnProperty(day)
                ? dayAvailability[day]
                : false; // Frontend-only default - all days off by default
              
              console.log(`[🔍 TEMP DEBUG ${timestamp}] Setting ${day} button: isAvailable=${isAvailable}, aria-pressed="${isAvailable ? 'true' : 'false'}"`);
              
              button.setAttribute('aria-pressed', isAvailable ? 'true' : 'false');
              button.classList.toggle('bg-[#34D399]', isAvailable);
              button.classList.toggle('bg-[#19342e]', !isAvailable);
              
              const circle = button.querySelector('div');
              if (circle) {
                circle.style.transform = isAvailable ? 'translateX(20px)' : 'translateX(0)';
                circle.style.backgroundColor = isAvailable ? '#fff' : '#34D399';
              }
              
              const timeContainer = document.getElementById(day + '-times');
              if (timeContainer) {
                if (isAvailable) {
                  timeContainer.classList.remove('opacity-50');
                  timeContainer.querySelectorAll('input').forEach(input => {
                    input.disabled = false;
                    input.classList.remove('cursor-not-allowed', 'bg-[#111f1c]', 'text-[#6B7C78]');
                    input.classList.add('cursor-pointer', 'bg-[#19342e]', 'text-[#E0E0E0]');
                  });
                } else {
                  timeContainer.classList.add('opacity-50');
                  timeContainer.querySelectorAll('input').forEach(input => {
                    input.disabled = true;
                    input.classList.add('cursor-not-allowed', 'bg-[#111f1c]', 'text-[#6B7C78]');
                    input.classList.remove('cursor-pointer', 'bg-[#19342e]', 'text-[#E0E0E0]');
                  });
                }
              }
            }
          });
          
          // Update time inputs - convert UTC minutes to local times for display
          console.log(`[🔍 TEMP DEBUG ${timestamp}] Updating time inputs...`);
          days.forEach(day => {
            const container = document.getElementById(day + '-times');
            if (container) {
              const inputs = container.querySelectorAll('input');
              if (inputs.length >= 2) {
                const range = weeklyHours[day] || {};
                console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time range from weeklyHours:`, range);
                
                if (range.start) {
                  // The range.start is already a local time string, just use it directly
                  inputs[0].value = range.start;
                  console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} start time: "${range.start}" -> set directly`);
                } else if (!hasAnyAvailability) {
                  // Frontend-only default: 9:00 AM
                  inputs[0].value = '09:00';
                  console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} start time: using default "09:00"`);
                }
                if (range.end) {
                  // The range.end is already a local time string, just use it directly
                  inputs[1].value = range.end;
                  console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} end time: "${range.end}" -> set directly`);
                } else if (!hasAnyAvailability) {
                  // Frontend-only default: 5:00 PM
                  inputs[1].value = '17:00';
                  console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} end time: using default "17:00"`);
                }
              } else {
                console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time container found but has ${inputs.length} inputs (need 2)`);
              }
            } else {
              console.log(`[🔍 TEMP DEBUG ${timestamp}] ${day} time container NOT FOUND`);
            }
          });
          
          updateAllCustomTimePickers();
          console.log(`[✅ TEMP DEBUG ${timestamp}] Fresh availability data loaded successfully`);
          console.log(`[🔍 TEMP DEBUG ${timestamp}] ===== LOADING FRESH AVAILABILITY DATA COMPLETE =====`);
        } else {
          console.log(`[❌ TEMP DEBUG ${timestamp}] Failed to load availability data: ${res.status}`);
        }
      } catch (error) {
        console.error(`[❌ TEMP DEBUG ${timestamp}] Error loading fresh availability data:`, error);
      }
    }

    function loadOverrideData(override) {
      const toggleButton = document.querySelector('#override-modal button[onclick="toggleOverrideAvailability(this)"]');
      const timesContainer = document.getElementById('override-times');
      
      if (override.available) {
        toggleButton.setAttribute('aria-pressed', 'true');
        toggleButton.classList.add('bg-[#34D399]');
        toggleButton.classList.remove('bg-[#19342e]');
        toggleButton.querySelector('div').style.transform = 'translateX(20px)';
        toggleButton.querySelector('div').style.backgroundColor = '#fff';
        timesContainer.style.opacity = '1';
        timesContainer.style.pointerEvents = 'auto';
        
        // Load time slots
        timesContainer.innerHTML = '';
        if (override.timeSlots && override.timeSlots.length > 0) {
          override.timeSlots.forEach(slot => {
            addOverrideTimeSlot();
            const lastSlot = timesContainer.lastElementChild;
            const inputs = lastSlot.querySelectorAll('input');
            if (inputs && inputs.length >= 2) {
              inputs[0].value = slot.start || '';
              inputs[1].value = slot.end || '';
            }
          });
        } else {
          // Add default empty time slot
          addOverrideTimeSlot();
        }
      } else {
        toggleButton.setAttribute('aria-pressed', 'false');
        toggleButton.classList.remove('bg-[#34D399]');
        toggleButton.classList.add('bg-[#19342e]');
        toggleButton.querySelector('div').style.transform = 'translateX(0)';
        toggleButton.querySelector('div').style.backgroundColor = '#34D399';
        timesContainer.style.opacity = '0.5';
        timesContainer.style.pointerEvents = 'none';
      }
    }

    function resetOverrideForm() {
      const toggleButton = document.querySelector('#override-modal button[onclick="toggleOverrideAvailability(this)"]');
      const timesContainer = document.getElementById('override-times');
      
      toggleButton.setAttribute('aria-pressed', 'true');
      toggleButton.classList.add('bg-[#34D399]');
      toggleButton.classList.remove('bg-[#19342e]');
      toggleButton.querySelector('div').style.transform = 'translateX(20px)';
      toggleButton.querySelector('div').style.backgroundColor = '#fff';
      timesContainer.style.opacity = '1';
      timesContainer.style.pointerEvents = 'auto';
      
      // Reset to single time slot with proper structure
      timesContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="custom-time-picker relative inline-flex items-center w-28">
            <input type="text" readonly class="time-input w-full flex-shrink-0 cursor-pointer bg-[#19342e] border border-[#2C4A43] text-[#E0E0E0] rounded px-3 py-2 focus:border-[#34D399] focus:ring-2 focus:ring-[#34D399]" placeholder="09:00 AM" onclick="showTimeDropdown(this)">
            <div class="time-dropdown absolute left-0 top-full mt-1 min-w-full bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg z-50 hidden p-2">
              <div class="flex gap-2 items-center justify-center">
                <select class="hour-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
                <span class="text-[#A3B3AF]">:</span>
                <select class="minute-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
                <select class="ampm-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]" style="display:none;"><option>AM</option><option>PM</option></select>
              </div>
              <div class="flex justify-end mt-2 gap-2 w-full">
                <button class="bg-[#34D399] text-[#1A2E29] px-3 py-1 rounded font-bold hover:bg-[#2C4A43] transition-colors" onclick="setTimeFromDropdown(this, true)">Set</button>
                <button class="text-[#A3B3AF] px-3 py-1 rounded hover:text-[#34D399]" onclick="closeTimeDropdown(this)">Cancel</button>
              </div>
            </div>
          </span>
          <span class="text-[#A3B3AF] flex-shrink-0">to</span>
          <span class="custom-time-picker relative inline-flex items-center w-28">
            <input type="text" readonly class="time-input w-full flex-shrink-0 cursor-pointer bg-[#19342e] border border-[#2C4A43] text-[#E0E0E0] rounded px-3 py-2 focus:border-[#34D399] focus:ring-2 focus:ring-[#34D399]" placeholder="17:00 PM" onclick="showTimeDropdown(this)">
            <div class="time-dropdown absolute left-0 top-full mt-1 min-w-full bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg z-50 hidden p-2">
              <div class="flex gap-2 items-center justify-center">
                <select class="hour-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
                <span class="text-[#A3B3AF]">:</span>
                <select class="minute-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]"></select>
                <select class="ampm-select bg-[#19342e] text-[#E0E0E0] rounded p-1 focus:ring-2 focus:ring-[#34D399]" style="display:none;"><option>AM</option><option>PM</option></select>
              </div>
              <div class="flex justify-end mt-2 gap-2 w-full">
                <button class="bg-[#34D399] text-[#1A2E29] px-3 py-1 rounded font-bold hover:bg-[#2C4A43] transition-colors" onclick="setTimeFromDropdown(this, true)">Set</button>
                <button class="text-[#A3B3AF] px-3 py-1 rounded hover:text-[#34D399]" onclick="closeTimeDropdown(this)">Cancel</button>
              </div>
            </div>
          </span>
          <button class="text-[#A3B3AF] hover:text-[#34D399] transition-colors duration-200 p-1 rounded hover:bg-[#19342e] flex-shrink-0" onclick="addOverrideTimeSlot()">
            <span class="material-icons-outlined text-lg">add</span>
          </button>
        </div>
      `;
    }

    async function saveEventType() {
      // Safe access helpers
      const val = (id) => {
        const el = document.getElementById(id);
        return (el && typeof el.value !== 'undefined') ? String(el.value).trim() : '';
      };
      const numVal = (id) => {
        const v = parseInt(val(id), 10);
        return Number.isFinite(v) ? v : 0;
      };

      const name = val('event-type-name');
      const duration = val('event-type-duration');
      const description = val('event-type-description');
      // Collect locations
      const locations = [];
      if (document.getElementById('loc-zoom')?.checked) locations.push('zoom');
      if (document.getElementById('loc-google-meet')?.checked) locations.push('google-meet');
      if (document.getElementById('loc-phone')?.checked) locations.push('phone');
      if (document.getElementById('loc-office')?.checked) locations.push('office');
      if (document.getElementById('loc-custom')?.checked) locations.push('custom');
      const customLocation = val('event-type-custom-location');
      const link = val('event-type-link');
      const color = val('event-type-color') || '#34D399';
      // Handle buffer times with new structure
      const bufferBeforeValue = numVal('event-type-buffer-before-value');
      const bufferBeforeUnit = val('event-type-buffer-before-unit') || 'minutes';
      const bufferBefore = bufferBeforeUnit === 'hours' ? bufferBeforeValue * 60 : bufferBeforeValue;
      
      const bufferAfterValue = numVal('event-type-buffer-after-value');
      const bufferAfterUnit = val('event-type-buffer-after-unit') || 'minutes';
      const bufferAfter = bufferAfterUnit === 'hours' ? bufferAfterValue * 60 : bufferAfterValue;
      
      // Handle advance notice with new structure
      const advanceNoticeValue = numVal('event-type-advance-notice-value');
      const advanceNoticeUnit = val('event-type-advance-notice-unit') || '0';
      let advanceNotice = 0;
      
      if (advanceNoticeUnit === 'days') {
        advanceNotice = advanceNoticeValue * 1440; // Convert days to minutes
      } else if (advanceNoticeUnit === 'hours') {
        advanceNotice = advanceNoticeValue * 60; // Convert hours to minutes
      } else if (advanceNoticeUnit === 'minutes') {
        advanceNotice = advanceNoticeValue;
      }
      // If unit is '0', advanceNotice remains 0 (no minimum)
      
      // Handle booking limit with new structure
      const bookingLimitValue = numVal('event-type-booking-limit-value');
      const bookingLimitUnit = val('event-type-booking-limit-unit') || '0';
      let bookingLimit = 0;
      
      if (bookingLimitUnit === 'per_day') {
        bookingLimit = { count: bookingLimitValue, period: 'day' };
      } else if (bookingLimitUnit === 'per_week') {
        bookingLimit = { count: bookingLimitValue, period: 'week' };
      } else if (bookingLimitUnit === '0') {
        bookingLimit = 0; // No limit
      }
      const confirmationMessage = val('event-type-confirmation-message');
      const questions = getQuestionsData('questions-container');
      const availability = document.getElementById('event-type-availability')?.checked || false;
      const reminders = document.getElementById('event-type-reminders')?.checked || false;
      const followUp = document.getElementById('event-type-follow-up')?.checked || false;

      const rescheduleNotification = document.getElementById('event-type-reschedule-notification')?.checked || false;
      const secret = val('event-type-secret');
      const priority = val('event-type-priority');
      const tags = getEventTypeSelectedTags();
      const addToContacts = document.getElementById('event-type-add-to-contacts')?.checked || false;

      if (!name) {
        showNotification('Event type name is required');
        return;
      }
      if (!duration) {
        showNotification('Duration is required');
        return;
      }
      if (locations.length === 0) {
        showNotification('Select at least one location');
        return;
      }
      // No static link required; Zoom/Meet are created automatically if selected
      if (!color) {
        showNotification('Color is required');
        return;
      }

      try {
        const token = getAnyToken();
        if (token) {
          const clean = token.replace(/^"|"$/g, '');
          const res = await fetch(`${API_URL}/event-types`, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, (clean ? { Authorization: `Bearer ${clean}` } : {})),
            credentials: 'include',
            body: JSON.stringify({ 
              title: name, 
              slug: generateSlug(name, freshEventTypes || []), 
              description, 
              duration: parseInt(duration),
              questions: questions,
              requiredFields: {},
              bookingLimit: bookingLimit,
              confirmationMessage: confirmationMessage,
              bufferBefore: parseInt(bufferBefore),
              bufferAfter: parseInt(bufferAfter),
              advanceNotice: parseInt(advanceNotice),
              slotInterval: parseInt(duration)
            })
          });
          if (res.ok) {
            const savedEventType = await res.json();
            
            // Save additional settings to UserState
            const additionalSettings = {
              locations,
              customLocation: locations.includes('custom') ? customLocation : '',
              link: link || '',
              color,
              bufferBefore,
              bufferAfter,
              advanceNotice,
              bookingLimit,
              confirmationMessage,
              questions,
              addToContacts,
              tags
            };
            
            // Save to UserState
            await fetch(`${API_URL}/users/me/state`, {
              method: 'PATCH',
              headers: Object.assign({ 'Content-Type': 'application/json' }, (clean ? { Authorization: `Bearer ${clean}` } : {})),
              credentials: 'include',
              body: JSON.stringify({
                [`event-type-settings-${savedEventType.id}`]: additionalSettings
              })
            });
            
            // Refresh event types from server after successful save
            await fetchEventTypesFromServer();
            renderEventTypes();
            showNotification('Event type created successfully!');
            closeCreateEventTypeModal();
          } else {
            let message = 'Failed to create event type';
            try { const text = await res.text(); try { const j = JSON.parse(text); message = j?.message || message; } catch { if (text) message = text; } } catch {}
            showNotification(message);
          }
        }
      } catch (e) {
        console.error('Failed to save event type to server', e);
        showNotification('Failed to create event type');
      }
    }

    // Interactive form functionality

    function questionExists(containerId, questionText) {
      const container = document.getElementById(containerId);
      if (!container) return false;
      
      const questionDivs = container.querySelectorAll('[id^="question_div_question_"]');
      for (const div of questionDivs) {
        const questionId = div.id.replace('question_div_', '');
        const textInput = document.getElementById(`question_text_${questionId}`);
        if (textInput && textInput.value.trim() === questionText) {
          return true;
        }
      }
      return false;
    }

    function handleLocationChange() {
      const customLocationContainer = document.getElementById('custom-location-container');
      const meetingLinkContainer = document.getElementById('meeting-link-container');
      const customChecked = document.getElementById('loc-custom')?.checked;
      
      if (customLocationContainer) {
        customLocationContainer.style.display = customChecked ? 'block' : 'none';
      }
      if (meetingLinkContainer) {
        meetingLinkContainer.style.display = customChecked ? 'block' : 'none';
      }
      
      // Handle automatic question addition for Zoom/Google Meet (email required)
      const zoomChecked = document.getElementById('loc-zoom')?.checked;
      const meetChecked = document.getElementById('loc-google-meet')?.checked;
      const phoneChecked = document.getElementById('loc-phone')?.checked;
      
      const questionsContainer = 'questions-container';
      
      // Add email question for Zoom or Google Meet
      if ((zoomChecked || meetChecked) && !questionExists(questionsContainer, 'What is your email address?')) {
        addQuestion(questionsContainer, {
          text: 'What is your email address?',
          required: true
        });
      }
      
      // Remove email question if neither Zoom nor Google Meet is selected
      if (!zoomChecked && !meetChecked) {
        removeRequiredQuestionByText(questionsContainer, 'What is your email address?');
      }
      
      // Add phone question for phone calls
      if (phoneChecked && !questionExists(questionsContainer, 'What is your phone number?')) {
        addQuestion(questionsContainer, {
          text: 'What is your phone number?',
          required: true
        });
      }
      
      // Remove phone question if phone is not selected
      if (!phoneChecked) {
        removeRequiredQuestionByText(questionsContainer, 'What is your phone number?');
      }
    }

    async function updateLocationGates() {
      try {
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        const headers = clean ? { Authorization: `Bearer ${clean}` } : {};
        const [zoomRes, googleRes] = await Promise.all([
          fetch(`${API_URL}/integrations/zoom/status`, { headers }),
          fetch(`${API_URL}/integrations/google/status`, { headers })
        ]);
        const zoomJson = zoomRes.ok ? await zoomRes.json() : { connected: false };
        const googleJson = googleRes.ok ? await googleRes.json() : { connected: false };
        
        // Store previous states for comparison
        const previousZoomState = window.zoomIntegrationConnected;
        const previousGoogleState = window.googleIntegrationConnected;
        
        // Update current states
        window.zoomIntegrationConnected = zoomJson.connected;
        window.googleIntegrationConnected = googleJson.connected;
        
        // Update create form checkboxes
        const zoomCb = document.getElementById('loc-zoom');
        const zoomStatus = document.getElementById('loc-zoom-status');
        if (zoomCb) {
          zoomCb.disabled = !zoomJson.connected;
          if (!zoomJson.connected) {
            zoomCb.checked = false;
            updateCheckboxVisualState(zoomCb);
          }
        }
        if (zoomStatus) {
          zoomStatus.textContent = zoomJson.connected ? '' : '(connect Zoom to enable)';
        }
        
        const meetCb = document.getElementById('loc-google-meet');
        const meetStatus = document.getElementById('loc-meet-status');
        if (meetCb) {
          meetCb.disabled = !googleJson.connected;
          if (!googleJson.connected) {
            meetCb.checked = false;
            updateCheckboxVisualState(meetCb);
          }
        }
        if (meetStatus) {
          meetStatus.textContent = googleJson.connected ? '' : '(connect Google to enable)';
        }

        // Handle edit form checkboxes
        const editZoomCb = document.getElementById('edit-loc-zoom');
        const editZoomStatus = document.getElementById('edit-loc-zoom-status');
        if (editZoomCb) {
          editZoomCb.disabled = !zoomJson.connected;
          if (!zoomJson.connected) {
            editZoomCb.checked = false;
            updateCheckboxVisualState(editZoomCb);
          }
        }
        if (editZoomStatus) {
          editZoomStatus.textContent = zoomJson.connected ? '' : '(connect Zoom to enable)';
        }
        
        const editMeetCb = document.getElementById('edit-loc-google-meet');
        const editMeetStatus = document.getElementById('edit-loc-meet-status');
        if (editMeetCb) {
          editMeetCb.disabled = !googleJson.connected;
          if (!googleJson.connected) {
            editMeetCb.checked = false;
            updateCheckboxVisualState(editMeetCb);
          }
        }
        if (editMeetStatus) {
          editMeetStatus.textContent = googleJson.connected ? '' : '(connect Google to enable)';
        }
        
        // Check if integrations were disconnected and update existing event types
        if (previousZoomState && !zoomJson.connected) {
          await handleIntegrationDisconnection('zoom');
        }
        if (previousGoogleState && !googleJson.connected) {
          await handleIntegrationDisconnection('google');
        }
        
      } catch (e) {
        console.warn('Failed to update location gates', e);
      }
    }

    async function handleIntegrationDisconnection(integrationType) {
      try {
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        const headers = clean ? { Authorization: `Bearer ${clean}` } : {};
        
        // Get current user state to check existing event types
        const stateRes = await fetch(`${API_URL}/users/me/state`, { headers });
        if (!stateRes.ok) return;
        
        const userState = await stateRes.json();
        const data = userState || {};
        let updatedEventTypes = [];
        let affectedEventTypes = [];
        
        // Check all event type settings for the disconnected integration
        Object.keys(data).forEach(key => {
          if (key.startsWith('event-type-settings-')) {
            const settings = data[key];
            const locations = Array.isArray(settings.locations) ? settings.locations : [];
            const locationToRemove = integrationType === 'zoom' ? 'zoom' : 'google-meet';
            
            if (locations.includes(locationToRemove)) {
              // Remove the disconnected integration from locations
              const updatedLocations = locations.filter(loc => loc !== locationToRemove);
              const eventTypeId = key.replace('event-type-settings-', '');
              
              updatedEventTypes.push({
                key,
                settings: {
                  ...settings,
                  locations: updatedLocations
                }
              });
              
              // Get event type name for notification
              const eventType = freshEventTypes.find(et => et.id === eventTypeId);
              if (eventType) {
                affectedEventTypes.push(eventType.title || eventType.name || 'Untitled Event');
              }
            }
          }
        });
        
        // Update user state with modified event types
        if (updatedEventTypes.length > 0) {
          const updateData = {};
          updatedEventTypes.forEach(item => {
            updateData[item.key] = item.settings;
          });
          
          await fetch(`${API_URL}/users/me/state`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
            body: JSON.stringify(updateData)
          });
          
          // Refresh event types from server
          await fetchEventTypesFromServer();
          renderEventTypes();
          
          // Show notification to user
          const integrationName = integrationType === 'zoom' ? 'Zoom' : 'Google Calendar';
          const locationName = integrationType === 'zoom' ? 'Zoom' : 'Google Meet';
          
          if (affectedEventTypes.length === 1) {
            showNotification(`${integrationName} was disconnected. "${affectedEventTypes[0]}" has been updated to remove ${locationName} location.`);
          } else if (affectedEventTypes.length > 1) {
            showNotification(`${integrationName} was disconnected. ${affectedEventTypes.length} event types have been updated to remove ${locationName} location.`);
          }
        }
        
      } catch (e) {
        console.error('Failed to handle integration disconnection:', e);
      }
    }



    // Add event listeners for interactive form elements
    document.addEventListener('DOMContentLoaded', function() {
      
      // Add event listeners for form interactions
      ;['loc-custom','loc-zoom','loc-google-meet','loc-phone','loc-office'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', handleLocationChange);
      });
      
      // Add event listeners for edit form interactions
      ;['edit-loc-custom','edit-loc-zoom','edit-loc-google-meet','edit-loc-phone','edit-loc-office'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', handleEditLocationChange);
      });
      
      // Add custom checkbox styling functionality
      setupCustomCheckboxes();
      updateLocationGates();
      
      // Set up periodic integration status check (every 30 seconds)
      setInterval(async () => {
        await updateLocationGates();
      }, 30000);
    });

    function setupCustomCheckboxes() {
      // Setup for create event type modal
      const createCheckboxes = ['loc-zoom', 'loc-google-meet', 'loc-phone', 'loc-office', 'loc-custom'];
      createCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          checkbox.addEventListener('change', function() {
            // Prevent selection if disabled
            if (this.disabled) {
              this.checked = false;
              return;
            }
            updateCheckboxVisualState(this);
          });
          
          // Add click prevention for disabled checkboxes
          const label = checkbox.closest('label');
          if (label) {
            label.addEventListener('click', function(e) {
              if (checkbox.disabled) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show notification to user
                const integrationName = id.includes('zoom') ? 'Zoom' : 'Google Calendar';
                const locationName = id.includes('zoom') ? 'Zoom' : 'Google Meet';
                showNotification(`Please connect ${integrationName} in the Integrations section to use ${locationName} meetings.`);
                
                return false;
              }
            });
          }
        }
      });

      // Setup for edit event type modal
      const editCheckboxes = ['edit-loc-zoom', 'edit-loc-google-meet', 'edit-loc-phone', 'edit-loc-office', 'edit-loc-custom'];
      editCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          checkbox.addEventListener('change', function() {
            // Prevent selection if disabled
            if (this.disabled) {
              this.checked = false;
              return;
            }
            updateCheckboxVisualState(this);
          });
          
          // Add click prevention for disabled checkboxes
          const label = checkbox.closest('label');
          if (label) {
            label.addEventListener('click', function(e) {
              if (checkbox.disabled) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show notification to user
                const integrationName = id.includes('zoom') ? 'Zoom' : 'Google Calendar';
                const locationName = id.includes('zoom') ? 'Zoom' : 'Google Meet';
                showNotification(`Please connect ${integrationName} in the Integrations section to use ${locationName} meetings.`);
                
                return false;
              }
            });
          }
        }
      });
    }

    function updateCheckboxVisualState(checkbox) {
      const label = checkbox.closest('label');
      const checkmark = label.querySelector('svg');
      const checkboxContainer = label.querySelector('.w-5.h-5');
      
      if (checkbox.checked) {
        checkmark.classList.remove('opacity-0');
        checkmark.classList.add('opacity-100');
        checkboxContainer.classList.add('border-[#34D399]', 'bg-[#34D399]');
        checkboxContainer.classList.remove('border-[#2C4A43]');
        label.classList.add('border-[#34D399]', 'bg-[#1E3A34]');
        label.classList.remove('border-[#2C4A43]', 'bg-[#1E3A34]');
      } else {
        checkmark.classList.add('opacity-0');
        checkmark.classList.remove('opacity-100');
        checkboxContainer.classList.remove('border-[#34D399]', 'bg-[#34D399]');
        checkboxContainer.classList.add('border-[#2C4A43]');
        label.classList.remove('border-[#34D399]');
        label.classList.add('border-[#2C4A43]');
      }
    }

    function renderEventTypes() {
      console.log('=== RENDER EVENT TYPES DEBUG ===');
      const eventTypesGrid = document.getElementById('event-types-grid');
      console.log('Event types grid element:', eventTypesGrid);
      let eventTypes = freshEventTypes || [];
      console.log('Event types to render:', eventTypes);
      console.log('=== END RENDER DEBUG ===');

      // Ensure each event type has a color for the left border
      eventTypes = eventTypes.map(et => {
        if (!et.color) {
          et.color = '#34D399';
        }
        return et;
      });

      // Adjust grid width based on number of event types
      if (eventTypes.length <= 1) {
        eventTypesGrid.classList.add('limited-width');
      } else {
        eventTypesGrid.classList.remove('limited-width');
      }
      
      // Start with the default event type
      let html = '';
      
      // Add created event types
      eventTypes.forEach(eventType => {
        const durationText = eventType.duration === 60 ? '1 hour' : 
                           eventType.duration === 90 ? '1.5 hours' : 
                           eventType.duration === 120 ? '2 hours' : 
                           eventType.duration === 180 ? '3 hours' :
                           eventType.duration === 240 ? '4 hours' :
                           `${eventType.duration} min`;
        
        
        const locationText = eventType.location === 'zoom' ? 'Zoom' :
                            eventType.location === 'google-meet' ? 'Google Meet' :
                            eventType.location === 'teams' ? 'Microsoft Teams' :
                            eventType.location === 'skype' ? 'Skype' :
                            eventType.location === 'phone' ? 'Phone Call' :
                            eventType.location === 'office' ? 'In-person' :
                            eventType.location === 'custom' ? eventType.customLocation : 'Zoom';
        
        const visibilityBadge = eventType.visibility === 'secret' ? 
          '<span class="bg-[#FF6B6B] text-white px-2 py-1 rounded text-xs">Secret</span>' :
          eventType.visibility === 'private' ? 
          '<span class="bg-[#FFA500] text-white px-2 py-1 rounded text-xs">Private</span>' : '';
        
        const priorityBadge = eventType.priority === 'high' ? 
          '<span class="bg-[#FFD93D] text-[#1A2E29] px-2 py-1 rounded text-xs ml-2">High</span>' :
          eventType.priority === 'urgent' ? 
          '<span class="bg-[#FF6B6B] text-white px-2 py-1 rounded text-xs ml-2">Urgent</span>' : '';
        
        const tagsText = eventType.tags && eventType.tags.length > 0 ? 
          `<div class="flex flex-wrap gap-1 mt-1">${eventType.tags.map(tag => 
            `<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs">${tag}</span>`
          ).join('')}</div>` : '';
        
        html += `
          <div class="card flex flex-col gap-3" style="border-left: 4px solid ${eventType.color || '#34D399'}">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-lg font-bold text-white">${eventType.title || eventType.name || 'Untitled Event'}</h3>
                  ${visibilityBadge}
                  ${priorityBadge}
                </div>
                <div class="text-[#A3B3AF] text-sm">${durationText}</div>
                <div class="text-[#A3B3AF] text-sm mt-1">📍 ${locationText}</div>
                ${eventType.description ? `<div class="text-[#A3B3AF] text-sm mt-1">${eventType.description}</div>` : ''}
                ${tagsText}
              </div>
            </div>
            <div class="flex gap-2 mt-2">
              <button class="bg-[#19342e] text-[#34D399] px-3 py-1 rounded-lg flex items-center gap-1 text-sm" onclick="copyLink('${eventType.slug}')"><span class="material-icons-outlined text-base">link</span>Copy link</button>
              <div class="relative">
                <button class="text-[#A3B3AF] hover:text-[#34D399] px-2 py-1 rounded-full" onclick="toggleCardMenu(this)"><span class="material-icons-outlined">more_vert</span></button>
                <div class="absolute right-0 mt-2 w-40 bg-[#1E3A34] rounded-lg shadow-lg py-2 z-50 hidden card-menu">
                  <button class="block w-full text-left px-4 py-2 text-[#E0E0E0] hover:bg-[#19342e]" onclick="editEventType('${eventType.id}')">Edit</button>
                  <button class="block w-full text-left px-4 py-2 text-[#E0E0E0] hover:bg-[#19342e]" onclick="cloneEventType('${eventType.id}')">Clone</button>
                  <button class="block w-full text-left px-4 py-2 text-[#E0E0E0] hover:bg-[#19342e]">Add Note</button>
                  <button class="block w-full text-left px-4 py-2 text-[#E0E0E0] hover:bg-[#19342e]" onclick="deleteEventType('${eventType.id}')">Delete</button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
      
      console.log('Generated HTML length:', html.length);
      console.log('Generated HTML preview:', html.substring(0, 500));
      eventTypesGrid.innerHTML = html;
      console.log('HTML set to grid');
    }

    function deleteEventType(id) {
      // Store the event type ID to delete
      window.eventTypeToDelete = id;
      
      // Show custom confirmation modal
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('delete-event-type-confirm-modal').classList.remove('hidden');
    }

    async function confirmDeleteEventType() {
      const id = window.eventTypeToDelete;
      if (id) {
        try {
          const token = getAnyToken();
          if (token) {
            const clean = token.replace(/^"|"$/g, '');
            const res = await fetch(`${API_URL}/event-types/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clean}` } });
            if (res.ok) {
              // Clean up UserState for this event type
              await fetch(`${API_URL}/users/me/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
                body: JSON.stringify({
                  [`event-type-settings-${id}`]: null
                })
              });
              
              // Refresh event types from server after successful deletion
              await fetchEventTypesFromServer();
              renderEventTypes();
              showNotification('Event type deleted successfully!');
              closeDeleteEventTypeConfirmModal();
              window.eventTypeToDelete = null;
            } else {
              showNotification('Failed to delete event type');
            }
          }
        } catch (e) {
          console.error('Failed to delete event type from server', e);
          showNotification('Failed to delete event type');
        }
      }
    }

    function closeDeleteEventTypeConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-event-type-confirm-modal').classList.add('hidden');
      window.eventTypeToDelete = null;
    }

    async function cloneEventType(id) {
      const originalEventType = freshEventTypes.find(eventType => eventType.id === id);

      if (originalEventType) {
        const clonedName = `${originalEventType.title || originalEventType.name} (Copy)`;
        const clonedSlug = generateSlug(clonedName, freshEventTypes || []);

        try {
          const token = getAnyToken();
          if (token) {
            const clean = token.replace(/^"|"$/g, '');
            const res = await fetch(`${API_URL}/event-types`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
              body: JSON.stringify({ 
                title: clonedName, 
                slug: clonedSlug, 
                duration: originalEventType.duration, 
                description: originalEventType.description || ''
              })
            });
            if (res.ok) {
              const savedEventType = await res.json();
              
              // Clone additional settings to UserState
              const originalSettings = originalEventType.location ? {
                location: originalEventType.location,
                customLocation: originalEventType.customLocation || '',
                link: originalEventType.link || '',
                color: originalEventType.color || '#34D399',
                visibility: originalEventType.visibility || 'public',
                priority: originalEventType.priority || 'normal',
                tags: originalEventType.tags || [],
                notifications: originalEventType.notifications || {
                  availability: true,
                  reminders: true,
                  followUp: false,
                  reschedule: true
                }
              } : {};
              
              if (Object.keys(originalSettings).length > 0) {
                await fetch(`${API_URL}/users/me/state`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
                  body: JSON.stringify({
                    [`event-type-settings-${savedEventType.id}`]: originalSettings
                  })
                });
              }
              
              // Refresh event types from server after successful clone
              await fetchEventTypesFromServer();
              renderEventTypes();
              showNotification('Event type cloned successfully!');
            } else {
              showNotification('Failed to clone event type');
            }
          }
        } catch (e) {
          console.error('Failed to clone event type on server', e);
          showNotification('Failed to clone event type');
        }
      }
    }

    // Edit Event Type Tag Management Functions
    function updateEditEventTypeSelectedTags(tags) {
      const container = document.getElementById('edit-event-type-selected-tags');
      if (!container) return;
      
      container.innerHTML = '';
      tags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const tagElement = document.createElement('span');
        tagElement.className = 'bg-[#34D399] text-[#1A2E29] px-2 py-1 rounded text-xs flex items-center gap-1';
        tagElement.setAttribute('data-tag-name', tagName);
        tagElement.innerHTML = `
          ${tagName}
          <button onclick="removeEditEventTypeTag('${tagName}')" class="hover:text-red-500">
            <span class="material-icons-outlined text-xs">close</span>
          </button>
        `;
        container.appendChild(tagElement);
      });
    }

    function getEditEventTypeSelectedTags() {
      const container = document.getElementById('edit-event-type-selected-tags');
      if (!container) return [];
      
      const tagElements = container.querySelectorAll('span');
      return Array.from(tagElements).map(el => {
        return el.getAttribute('data-tag-name') || '';
      }).filter(tag => tag !== '');
    }

    function removeEditEventTypeTag(tagToRemove) {
      const currentTags = getEditEventTypeSelectedTags();
      const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
      updateEditEventTypeSelectedTags(updatedTags);
      
      // Update the add to contacts checkbox based on remaining tags
      updateAddToContactsCheckbox();
    }

    async function openEditEventTypeTagSelector() {
      const modal = document.getElementById('event-type-tag-selector-modal');
      if (modal) {
        modal.classList.remove('hidden');
        await populateEventTypeTagSelector();
      } else {
        console.error('Tag selector modal not found');
      }
    }

    async function populateEventTypeTagSelector() {
      const container = document.getElementById('event-type-tag-selector-list');
      if (!container) {
        console.error('Tag selector container not found');
        return;
      }
      
      const currentTags = getEditEventTypeSelectedTags();
      
      // Fetch tags from server
      let allTags = [];
      try {
        allTags = await fetchTagsFromServer();
      } catch (error) {
        console.error('Failed to fetch tags from server:', error);
        // Fallback to localStorage if server fetch fails
        allTags = JSON.parse(localStorage.getItem('tags') || '[]');
      }
      
      container.innerHTML = '';
      allTags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const isSelected = currentTags.includes(tagName);
        const button = document.createElement('button');
        button.className = `block w-full text-left px-4 py-2 text-[#E0E0E0] hover:bg-[#19342e] ${isSelected ? 'bg-[#34D399] text-[#1A2E29]' : ''}`;
        button.textContent = tagName;
        button.onclick = () => toggleEditEventTypeTag(tagName);
        container.appendChild(button);
      });
      
      if (allTags.length === 0) {
        container.innerHTML = '<p class="text-[#A3B3AF] text-center py-4">No tags available. Create some tags first.</p>';
      }
    }

    function toggleEditEventTypeTag(tag) {
      const currentTags = getEditEventTypeSelectedTags();
      const isSelected = currentTags.includes(tag);
      
      if (isSelected) {
        removeEditEventTypeTag(tag);
      } else {
        const updatedTags = [...currentTags, tag];
        updateEditEventTypeSelectedTags(updatedTags);
      }
      
      // Update the add to contacts checkbox based on tags
      updateAddToContactsCheckbox();
      
      // Refresh the selector to show updated selection state
      populateEventTypeTagSelector();
    }

    function updateAddToContactsCheckbox() {
      const currentTags = getEditEventTypeSelectedTags();
      const addToContactsCheckbox = document.getElementById('edit-event-type-add-to-contacts');
      
      if (addToContactsCheckbox) {
        if (currentTags.length > 0) {
          addToContactsCheckbox.checked = true;
          addToContactsCheckbox.disabled = true;
        } else {
          addToContactsCheckbox.disabled = false;
        }
      }
    }

    function closeEventTypeTagSelector() {
      const modal = document.getElementById('event-type-tag-selector-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }

    async function confirmEventTypeTagSelection() {
      closeEventTypeTagSelector();
      // Refresh the tag list in case new tags were created
      await populateEventTypeTagSelector();
    }

    // Create Event Type Tag Management Functions
    function updateEventTypeSelectedTags(tags) {
      const container = document.getElementById('event-type-selected-tags');
      if (!container) return;
      
      container.innerHTML = '';
      tags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const tagElement = document.createElement('span');
        tagElement.className = 'bg-[#34D399] text-[#1A2E29] px-2 py-1 rounded text-xs flex items-center gap-1';
        tagElement.setAttribute('data-tag-name', tagName);
        tagElement.innerHTML = `
          ${tagName}
          <button onclick="removeEventTypeTag('${tagName}')" class="hover:text-red-500">
            <span class="material-icons-outlined text-xs">close</span>
          </button>
        `;
        container.appendChild(tagElement);
      });
    }

    function getEventTypeSelectedTags() {
      const container = document.getElementById('event-type-selected-tags');
      if (!container) return [];
      
      const tagElements = container.querySelectorAll('span');
      return Array.from(tagElements).map(el => {
        return el.getAttribute('data-tag-name') || '';
      }).filter(tag => tag !== '');
    }

    function removeEventTypeTag(tagToRemove) {
      const currentTags = getEventTypeSelectedTags();
      const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
      updateEventTypeSelectedTags(updatedTags);
      
      // Update the add to contacts checkbox based on remaining tags
      updateCreateAddToContactsCheckbox();
    }

    function openEventTypeTagSelector() {
      const modal = document.getElementById('event-type-tag-selector-modal');
      if (modal) {
        modal.classList.remove('hidden');
        populateCreateEventTypeTagSelector();
      } else {
        console.error('Tag selector modal not found');
      }
    }

    async function populateCreateEventTypeTagSelector() {
      const container = document.getElementById('event-type-tag-selector-list');
      if (!container) {
        console.error('Tag selector container not found');
        return;
      }
      
      const currentTags = getEventTypeSelectedTags();
      
      // Fetch tags from server
      let allTags = [];
      try {
        allTags = await fetchTagsFromServer();
      } catch (error) {
        console.error('Failed to fetch tags from server:', error);
        // Fallback to localStorage if server fetch fails
        allTags = JSON.parse(localStorage.getItem('tags') || '[]');
      }
      
      container.innerHTML = '';
      allTags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const isSelected = currentTags.includes(tagName);
        const button = document.createElement('button');
        button.className = `block w-full text-left px-4 py-2 text-[#E0E0E0] hover:bg-[#19342e] ${isSelected ? 'bg-[#34D399] text-[#1A2E29]' : ''}`;
        button.textContent = tagName;
        button.onclick = () => toggleEventTypeTag(tagName);
        container.appendChild(button);
      });
      
      if (allTags.length === 0) {
        container.innerHTML = '<p class="text-[#A3B3AF] text-center py-4">No tags available. Create some tags first.</p>';
      }
    }

    function toggleEventTypeTag(tag) {
      const currentTags = getEventTypeSelectedTags();
      const isSelected = currentTags.includes(tag);
      
      if (isSelected) {
        removeEventTypeTag(tag);
      } else {
        const updatedTags = [...currentTags, tag];
        updateEventTypeSelectedTags(updatedTags);
      }
      
      // Update the add to contacts checkbox based on tags
      updateCreateAddToContactsCheckbox();
      
      // Refresh the selector to show updated selection state
      populateCreateEventTypeTagSelector();
    }

    function updateCreateAddToContactsCheckbox() {
      const currentTags = getEventTypeSelectedTags();
      const addToContactsCheckbox = document.getElementById('event-type-add-to-contacts');
      
      if (addToContactsCheckbox) {
        if (currentTags.length > 0) {
          addToContactsCheckbox.checked = true;
          addToContactsCheckbox.disabled = true;
        } else {
          addToContactsCheckbox.disabled = false;
        }
      }
    }

    // Make tag management functions globally accessible
    window.openEditEventTypeTagSelector = openEditEventTypeTagSelector;
    window.closeEventTypeTagSelector = closeEventTypeTagSelector;
    window.confirmEventTypeTagSelection = confirmEventTypeTagSelection;
    window.removeEditEventTypeTag = removeEditEventTypeTag;
    window.openEventTypeTagSelector = openEventTypeTagSelector;
    window.removeEventTypeTag = removeEventTypeTag;
    window.openCreateTagModal = openCreateTagModal;

    // Test function to verify editEventType is accessible
    window.testEditFunction = function() {
      console.log('Test function called');
      console.log('editEventType function exists:', typeof window.editEventType);
      console.log('freshEventTypes:', freshEventTypes);
      
      // Check if event types are rendered
      const eventTypesGrid = document.getElementById('event-types-grid');
      console.log('Event types grid:', eventTypesGrid);
      console.log('Event types grid innerHTML length:', eventTypesGrid ? eventTypesGrid.innerHTML.length : 'no grid');
      
      // Check for edit buttons
      const editButtons = document.querySelectorAll('[onclick*="editEventType"]');
      console.log('Found edit buttons:', editButtons.length);
      editButtons.forEach((btn, index) => {
        console.log(`Edit button ${index}:`, btn.outerHTML);
        console.log(`Edit button parent:`, btn.parentElement.outerHTML);
        console.log(`Edit button grandparent:`, btn.parentElement.parentElement.outerHTML);
      });
      
      
      // Try to manually trigger the edit button
      const editButton = document.querySelector('[onclick*="editEventType"]');
      if (editButton) {
        console.log('Attempting to manually click edit button...');
        editButton.click();
      } else {
        console.log('No edit button found to test');
      }
      
      return 'Test function working';
    };

    window.editEventType = async function editEventType(id) {
      if (!freshEventTypes || freshEventTypes.length === 0) {
        showNotification('No event types loaded. Please refresh the page.');
        return;
      }
      
      const eventType = freshEventTypes.find(eventType => eventType.id === id);
      
      if (eventType) {
        try {
          // Store the event type being edited
          window.editingEventType = eventType;
          
          // Update location gates before populating form
          await updateLocationGates();
          
          // Populate the form with existing data
          populateEditForm(eventType);
          
          // Show the edit modal
          const backdrop = document.getElementById('modal-backdrop');
          const modal = document.getElementById('edit-event-type-modal');
          
          if (backdrop && modal) {
            backdrop.classList.remove('hidden');
            modal.classList.remove('hidden');
          } else {
            console.error('Modal elements not found');
          }
        } catch (error) {
          console.error('Error in editEventType:', error);
          showNotification('Error opening edit modal: ' + error.message);
        }
      } else {
        console.error('Event type not found for id:', id);
        showNotification('Event type not found for id: ' + id);
      }
    }

    function populateEditForm(eventType) {
      // Basic Information
      const nameElement = document.getElementById('edit-event-type-name');
      const durationElement = document.getElementById('edit-event-type-duration');
      const descriptionElement = document.getElementById('edit-event-type-description');
      
      if (nameElement) nameElement.value = eventType.title || eventType.name || '';
      if (durationElement) durationElement.value = eventType.duration;
      if (descriptionElement) descriptionElement.value = eventType.description || '';
      // Locations
      const locs = Array.isArray(eventType.locations) ? eventType.locations : (eventType.location ? [eventType.location] : []);
      const editLocZoom = document.getElementById('edit-loc-zoom');
      const editLocGoogleMeet = document.getElementById('edit-loc-google-meet');
      const editLocPhone = document.getElementById('edit-loc-phone');
      const editLocOffice = document.getElementById('edit-loc-office');
      const editLocCustom = document.getElementById('edit-loc-custom');
      
      if (editLocZoom) {
        editLocZoom.checked = locs.includes('zoom');
        updateCheckboxVisualState(editLocZoom);
      }
      if (editLocGoogleMeet) {
        editLocGoogleMeet.checked = locs.includes('google-meet');
        updateCheckboxVisualState(editLocGoogleMeet);
      }
      if (editLocPhone) {
        editLocPhone.checked = locs.includes('phone');
        updateCheckboxVisualState(editLocPhone);
      }
      if (editLocOffice) {
        editLocOffice.checked = locs.includes('office');
        updateCheckboxVisualState(editLocOffice);
      }
      if (editLocCustom) {
        editLocCustom.checked = locs.includes('custom');
        updateCheckboxVisualState(editLocCustom);
      }
      document.getElementById('edit-event-type-custom-location').value = eventType.customLocation || '';
      document.getElementById('edit-event-type-link').value = eventType.link || '';
      document.getElementById('edit-event-type-color').value = eventType.color || '#34D399';
      
      // Trigger location change to show/hide appropriate fields
      handleEditLocationChange();
      
      // Scheduling
      // Handle buffer times with new structure
      if (eventType.bufferBefore) {
        const bufferBeforeValue = eventType.bufferBefore;
        if (bufferBeforeValue >= 60) {
          document.getElementById('edit-event-type-buffer-before-value').value = Math.floor(bufferBeforeValue / 60);
          document.getElementById('edit-event-type-buffer-before-unit').value = 'hours';
        } else {
          document.getElementById('edit-event-type-buffer-before-value').value = bufferBeforeValue;
          document.getElementById('edit-event-type-buffer-before-unit').value = 'minutes';
        }
      } else {
        document.getElementById('edit-event-type-buffer-before-value').value = 0;
        document.getElementById('edit-event-type-buffer-before-unit').value = 'minutes';
      }
      
      if (eventType.bufferAfter) {
        const bufferAfterValue = eventType.bufferAfter;
        if (bufferAfterValue >= 60) {
          document.getElementById('edit-event-type-buffer-after-value').value = Math.floor(bufferAfterValue / 60);
          document.getElementById('edit-event-type-buffer-after-unit').value = 'hours';
        } else {
          document.getElementById('edit-event-type-buffer-after-value').value = bufferAfterValue;
          document.getElementById('edit-event-type-buffer-after-unit').value = 'minutes';
        }
      } else {
        document.getElementById('edit-event-type-buffer-after-value').value = 0;
        document.getElementById('edit-event-type-buffer-after-unit').value = 'minutes';
      }
      
      // Handle advance notice with new structure
      if (eventType.advanceNotice) {
        const advanceNoticeValue = eventType.advanceNotice;
        if (advanceNoticeValue >= 1440) {
          document.getElementById('edit-event-type-advance-notice-value').value = Math.floor(advanceNoticeValue / 1440);
          document.getElementById('edit-event-type-advance-notice-unit').value = 'days';
        } else if (advanceNoticeValue >= 60) {
          document.getElementById('edit-event-type-advance-notice-value').value = Math.floor(advanceNoticeValue / 60);
          document.getElementById('edit-event-type-advance-notice-unit').value = 'hours';
        } else {
          document.getElementById('edit-event-type-advance-notice-value').value = advanceNoticeValue;
          document.getElementById('edit-event-type-advance-notice-unit').value = 'minutes';
        }
      } else {
        document.getElementById('edit-event-type-advance-notice-value').value = 0;
        document.getElementById('edit-event-type-advance-notice-unit').value = '0';
      }
      
      // Booking limits
      if (typeof eventType.bookingLimit === 'object') {
        // Handle custom booking limit object
        const limitValue = eventType.bookingLimit.count;
        const limitPeriod = eventType.bookingLimit.period;
        
        document.getElementById('edit-event-type-booking-limit-value').value = limitValue;
        if (limitPeriod === 'day') {
          document.getElementById('edit-event-type-booking-limit-unit').value = 'per_day';
        } else if (limitPeriod === 'week') {
          document.getElementById('edit-event-type-booking-limit-unit').value = 'per_week';
        } else {
          document.getElementById('edit-event-type-booking-limit-unit').value = 'per_day'; // default
        }
      } else {
        // Handle simple booking limit (number or 0)
        const limitValue = eventType.bookingLimit || 0;
        if (limitValue === 0) {
          document.getElementById('edit-event-type-booking-limit-value').value = 0;
          document.getElementById('edit-event-type-booking-limit-unit').value = '0';
        } else {
          // Assume it's per day if it's a simple number
          document.getElementById('edit-event-type-booking-limit-value').value = limitValue;
          document.getElementById('edit-event-type-booking-limit-unit').value = 'per_day';
        }
      }
      
      // Booking Form
      document.getElementById('edit-event-type-confirmation-message').value = eventType.confirmationMessage || '';
      loadQuestionsData('edit-questions-container', eventType.questions || []);
      
      // Required Fields - removed, now handled by questions system
      
      // Advanced Settings (reduced)
      const addBox = document.getElementById('edit-event-type-add-to-contacts');
      if (addBox) addBox.checked = !!eventType.addToContacts;
      updateEditEventTypeSelectedTags(eventType.tags || []);
      
      // Update the add to contacts checkbox based on tags
      updateAddToContactsCheckbox();
      
      // Update form visibility based on current values
      handleEditLocationChange();
    }

    async function updateEventType() {
      const eventType = window.editingEventType;
      if (!eventType) return;
      
      // Collect all form data (same as saveEventType but with edit- prefixes)
      const name = document.getElementById('edit-event-type-name').value.trim();
      const duration = document.getElementById('edit-event-type-duration').value;
      const description = document.getElementById('edit-event-type-description').value.trim();
      const editLocations = [];
      if (document.getElementById('edit-loc-zoom')?.checked) editLocations.push('zoom');
      if (document.getElementById('edit-loc-google-meet')?.checked) editLocations.push('google-meet');
      if (document.getElementById('edit-loc-phone')?.checked) editLocations.push('phone');
      if (document.getElementById('edit-loc-office')?.checked) editLocations.push('office');
      if (document.getElementById('edit-loc-custom')?.checked) editLocations.push('custom');
      const customLocation = document.getElementById('edit-event-type-custom-location').value.trim();
      const link = document.getElementById('edit-event-type-link').value.trim();
      const color = document.getElementById('edit-event-type-color').value;
      // Handle buffer times with new structure
      const bufferBeforeValue = parseInt(document.getElementById('edit-event-type-buffer-before-value').value) || 0;
      const bufferBeforeUnit = document.getElementById('edit-event-type-buffer-before-unit').value;
      const bufferBefore = bufferBeforeUnit === 'hours' ? bufferBeforeValue * 60 : bufferBeforeValue;
      
      const bufferAfterValue = parseInt(document.getElementById('edit-event-type-buffer-after-value').value) || 0;
      const bufferAfterUnit = document.getElementById('edit-event-type-buffer-after-unit').value;
      const bufferAfter = bufferAfterUnit === 'hours' ? bufferAfterValue * 60 : bufferAfterValue;
      
      // Handle advance notice with new structure
      const advanceNoticeValue = parseInt(document.getElementById('edit-event-type-advance-notice-value').value) || 0;
      const advanceNoticeUnit = document.getElementById('edit-event-type-advance-notice-unit').value;
      let advanceNotice = 0;
      
      if (advanceNoticeUnit === 'days') {
        advanceNotice = advanceNoticeValue * 1440; // Convert days to minutes
      } else if (advanceNoticeUnit === 'hours') {
        advanceNotice = advanceNoticeValue * 60; // Convert hours to minutes
      } else if (advanceNoticeUnit === 'minutes') {
        advanceNotice = advanceNoticeValue;
      }
      // If unit is '0', advanceNotice remains 0 (no minimum)
      
      // Handle booking limit with new structure
      const bookingLimitValue = parseInt(document.getElementById('edit-event-type-booking-limit-value').value) || 0;
      const bookingLimitUnit = document.getElementById('edit-event-type-booking-limit-unit').value;
      let bookingLimit = 0;
      
      if (bookingLimitUnit === 'per_day') {
        bookingLimit = { count: bookingLimitValue, period: 'day' };
      } else if (bookingLimitUnit === 'per_week') {
        bookingLimit = { count: bookingLimitValue, period: 'week' };
      } else if (bookingLimitUnit === '0') {
        bookingLimit = 0; // No limit
      }
      const confirmationMessage = document.getElementById('edit-event-type-confirmation-message').value.trim();
      const questions = getQuestionsData('edit-questions-container');
      const addToContacts = document.getElementById('edit-event-type-add-to-contacts')?.checked || false;
      const tags = getEditEventTypeSelectedTags();

      if (!name) {
        showNotification('Event type name is required');
        return;
      }
      if (!duration) {
        showNotification('Duration is required');
        return;
      }
      if (editLocations.length === 0) {
        showNotification('Select at least one location');
        return;
      }
      // No static link required for Zoom/Meet when selected
      if (!color) {
        showNotification('Color is required');
        return;
      }

      try {
        const token = getAnyToken();
        if (token) {
          const clean = token.replace(/^"|"$/g, '');
          
          // Generate new slug if name changed
          let slug = eventType.slug;
          if (name !== (eventType.title || eventType.name)) {
            slug = generateSlug(name, freshEventTypes || []);
          }
          
          const res = await fetch(`${API_URL}/event-types/${eventType.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
            body: JSON.stringify({ 
              title: name, 
              slug, 
              description, 
              duration: parseInt(duration),
              questions: questions,
              requiredFields: {},
              bookingLimit: bookingLimit,
              confirmationMessage: confirmationMessage,
              bufferBefore: parseInt(bufferBefore),
              bufferAfter: parseInt(bufferAfter),
              advanceNotice: parseInt(advanceNotice),
              slotInterval: parseInt(duration)
            })
          });
          if (res.ok) {
            // Save additional settings to UserState
            const additionalSettings = {
              locations: editLocations,
              customLocation: editLocations.includes('custom') ? customLocation : '',
              link: link || '',
              color,
              bufferBefore,
              bufferAfter,
              advanceNotice,
              bookingLimit,
              confirmationMessage,
              questions,
              addToContacts,
              tags
            };
            
            // Save to UserState
            await fetch(`${API_URL}/users/me/state`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
              body: JSON.stringify({
                [`event-type-settings-${eventType.id}`]: additionalSettings
              })
            });
            
            // Refresh event types from server after successful update
            await fetchEventTypesFromServer();
            renderEventTypes();
            showNotification('Event type updated successfully!');
            closeEditEventTypeModal();
          } else {
            console.error('Failed to update event type:', res.status, res.statusText);
            showNotification('Failed to update event type');
          }
        }
      } catch (e) {
        console.error('Failed to update event type on server', e);
        showNotification('Failed to update event type');
      }
    }

    function closeEditEventTypeModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('edit-event-type-modal').classList.add('hidden');
      window.editingEventType = null;
      // Clear questions container
      document.getElementById('edit-questions-container').innerHTML = '';
      questionCounter = 0;
    }

    // Edit form interactive functions

    function handleEditLocationChange() {
      const customLocationContainer = document.getElementById('edit-custom-location-container');
      const meetingLinkContainer = document.getElementById('edit-meeting-link-container');
      const customChecked = document.getElementById('edit-loc-custom')?.checked;
      
      if (customLocationContainer) {
        customLocationContainer.style.display = customChecked ? 'block' : 'none';
      }
      if (meetingLinkContainer) {
        meetingLinkContainer.style.display = customChecked ? 'block' : 'none';
      }
      
      // Handle automatic question addition for Zoom/Google Meet (email required)
      const zoomChecked = document.getElementById('edit-loc-zoom')?.checked;
      const meetChecked = document.getElementById('edit-loc-google-meet')?.checked;
      const phoneChecked = document.getElementById('edit-loc-phone')?.checked;
      
      const questionsContainer = 'edit-questions-container';
      
      // Add email question for Zoom or Google Meet
      if ((zoomChecked || meetChecked) && !questionExists(questionsContainer, 'What is your email address?')) {
        addQuestion(questionsContainer, {
          text: 'What is your email address?',
          required: true
        });
      }
      
      // Remove email question if neither Zoom nor Google Meet is selected
      if (!zoomChecked && !meetChecked) {
        removeRequiredQuestionByText(questionsContainer, 'What is your email address?');
      }
      
      // Add phone question for phone calls
      if (phoneChecked && !questionExists(questionsContainer, 'What is your phone number?')) {
        addQuestion(questionsContainer, {
          text: 'What is your phone number?',
          required: true
        });
      }
      
      // Remove phone question if phone is not selected
      if (!phoneChecked) {
        removeRequiredQuestionByText(questionsContainer, 'What is your phone number?');
      }
    }



    // Initialize event types on page load
    document.addEventListener('DOMContentLoaded', function() {
      // Add event listeners for form interactions
      const locationSelect = document.getElementById('event-type-location');
      
      if (locationSelect) {
        locationSelect.addEventListener('change', handleLocationChange);
      }
    });

    // This function is deprecated - using the updated version below
    function cancelMeeting(meetingId) {
      // This function is kept for backward compatibility but should not be used
      console.log('Deprecated cancelMeeting function called');
    }

    // Removed duplicate confirmCancelMeeting function - using the updated version below

    // --- Meeting 3-dots menu logic ---
    function toggleMeetingMenu(btn) {
      // Close all other menus
      document.querySelectorAll('.meeting-menu').forEach(menu => menu.classList.remove('open'));
      // Toggle this one
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle('open');
    }
    document.addEventListener('click', function(e) {
      // If not clicking the kebab or menu, close all
      if (!e.target.closest('.kebab-btn') && !e.target.closest('.meeting-menu')) {
        document.querySelectorAll('.meeting-menu').forEach(menu => menu.classList.remove('open'));
      }
    });

    // --- Contact menu logic ---
    function toggleContactMenu(btn) {
      // Close all other menus
      document.querySelectorAll('.contact-menu').forEach(menu => menu.classList.remove('open'));
    // Toggle this one with fixed positioning near the button
    const menu = btn.nextElementSibling;
    if (!menu) return;
    const rect = btn.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + scrollY + 8}px`;
    menu.style.left = `${rect.right + scrollX - 160}px`;
    menu.classList.toggle('open');
    }
    
    // Contact actions
    async function viewContact(email) {
      try {
        const contacts = await fetchContactsFromServer();
        const contact = contacts.find(c => c.email === email);
        
        if (!contact) {
          showNotification('Contact not found');
          return;
        }
        
        console.log('[CONTACT VIEW] Contact data:', contact);
        
        // Open the contact view modal
        const modal = document.getElementById('contact-view-modal');
        const title = document.getElementById('contact-view-title');
        const content = document.getElementById('contact-view-content');
        
        title.textContent = contact.name;
        
        // Build comprehensive contact view
        let contentHtml = '';
        
        // Basic Information Section
        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">info</span>
              Basic Information
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex items-center gap-3">
                <span class="material-icons-outlined text-[#34D399]">email</span>
                <div class="flex-1">
                  <div class="text-[#A3B3AF] text-sm">Email</div>
                  <div class="text-[#E0E0E0] font-medium" id="contact-email-display">${contact.email}</div>
                  <input type="email" id="contact-email-edit" value="${contact.email}" class="hidden w-full bg-[#223c36] border border-[#2C4A43] rounded px-2 py-1 text-[#E0E0E0] text-sm" />
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="material-icons-outlined text-[#34D399]">phone</span>
                <div class="flex-1">
                  <div class="text-[#A3B3AF] text-sm">Phone</div>
                  <div class="text-[#E0E0E0] font-medium" id="contact-phone-display">${contact.phone || '-'}</div>
                  <input type="tel" id="contact-phone-edit" value="${contact.phone || ''}" class="hidden w-full bg-[#223c36] border border-[#2C4A43] rounded px-2 py-1 text-[#E0E0E0] text-sm" />
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="material-icons-outlined text-[#34D399]">business</span>
                <div class="flex-1">
                  <div class="text-[#A3B3AF] text-sm">Company</div>
                  <div class="text-[#E0E0E0] font-medium" id="contact-company-display">${contact.company || '-'}</div>
                  <input type="text" id="contact-company-edit" value="${contact.company || ''}" class="hidden w-full bg-[#223c36] border border-[#2C4A43] rounded px-2 py-1 text-[#E0E0E0] text-sm" />
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="material-icons-outlined text-[#34D399]">star</span>
                <div class="flex-1">
                  <div class="text-[#A3B3AF] text-sm">Status</div>
                  <div class="text-[#E0E0E0] font-medium" id="contact-favorite-display">${contact.favorite ? 'Favorite' : 'Regular Contact'}</div>
                  <select id="contact-favorite-edit" class="hidden w-full bg-[#223c36] border border-[#2C4A43] rounded px-2 py-1 text-[#E0E0E0] text-sm">
                    <option value="false" ${!contact.favorite ? 'selected' : ''}>Regular Contact</option>
                    <option value="true" ${contact.favorite ? 'selected' : ''}>Favorite</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Tags Section
        let tagsHtml = '';
        if (contact.tags && contact.tags.length > 0) {
          tagsHtml = contact.tags.map(tag => `<span class="bg-[#2C4A43] text-[#34D399] px-3 py-1 rounded-full text-sm font-medium">${tag}</span>`).join('');
        } else {
          tagsHtml = '<span class="text-[#A3B3AF] italic">No tags assigned</span>';
        }
        
        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">local_offer</span>
              Tags & Categories
            </h4>
            <div class="flex flex-wrap gap-2">
              ${tagsHtml}
            </div>
          </div>
        `;

        // Field Keys Section
        const keyRows = [];
        keyRows.push({ key: 'contact.id', value: contact.id || '-' });
        keyRows.push({ key: 'contact.fullName', value: contact.name || '-' });
        keyRows.push({ key: 'contact.email', value: contact.email || '-' });
        keyRows.push({ key: 'contact.phone', value: contact.phone || '-' });
        keyRows.push({ key: 'contact.company', value: contact.company || '-' });
        keyRows.push({ key: 'contact.tags', value: (contact.tags && contact.tags.length ? contact.tags.join(', ') : '-') });
        keyRows.push({ key: 'contact.notes', value: contact.notes || '-' });
        keyRows.push({ key: 'contact.createdAt', value: contact.createdAt ? new Date(contact.createdAt).toISOString() : '-' });
        keyRows.push({ key: 'contact.updatedAt', value: contact.updatedAt ? new Date(contact.updatedAt).toISOString() : '-' });

        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">key</span>
              Field Keys
            </h4>
            <div class="text-[#A3B3AF] text-sm mb-2">Click to copy a key to the clipboard.</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              ${keyRows.map(r => `
                <div class=\"flex items-center justify-between gap-2 bg-[#10231f] border border-[#2C4A43] rounded px-2 py-1\">
                  <code class=\"text-[#E0E0E0] text-xs\">${r.key}</code>
                  <button type=\"button\" class=\"text-[#34D399] hover:text-[#A3B3AF]\" onclick=\"navigator.clipboard.writeText('${r.key}').then(() => showNotification('Key copied')).catch(() => showNotification('Failed to copy key','error'))\" title=\"Copy key\">
                    <span class=\"material-icons-outlined\" style=\"font-size:16px\">content_copy</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        // Notes Section
        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">note</span>
              Notes
            </h4>
            <div class="text-[#E0E0E0] bg-[#223c36] p-3 rounded border border-[#2C4A43]" id="contact-notes-display">
              ${contact.notes || 'No notes available'}
            </div>
            <textarea id="contact-notes-edit" class="hidden w-full bg-[#223c36] border border-[#2C4A43] rounded px-3 py-2 text-[#E0E0E0] text-sm h-24 resize-none" placeholder="Enter notes...">${contact.notes || ''}</textarea>
          </div>
        `;
        
        // Meeting History Section
        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">event</span>
              Meeting History
            </h4>
            <div id="meeting-history-content" class="text-[#A3B3AF] italic">
              Loading meeting history...
            </div>
          </div>
        `;
        
        // Custom Fields Section (Future-proof)
        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">tune</span>
              Additional Information
            </h4>
            <div id="custom-fields-content" class="text-[#A3B3AF] italic">
              No additional fields available
            </div>
          </div>
        `;
        
        // Contact Activity Section
        contentHtml += `
          <div class="bg-[#19342e] rounded-lg p-4 border border-[#2C4A43]">
            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span class="material-icons-outlined text-[#34D399]">timeline</span>
              Contact Activity
            </h4>
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 bg-[#34D399] rounded-full"></div>
                <div class="flex-1">
                  <div class="text-[#E0E0E0] text-sm">Contact created</div>
                  <div class="text-[#A3B3AF] text-xs">${new Date(contact.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 bg-[#34D399] rounded-full"></div>
                <div class="flex-1">
                  <div class="text-[#E0E0E0] text-sm">Last updated</div>
                  <div class="text-[#A3B3AF] text-xs">${new Date(contact.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>
        `;
        
        content.innerHTML = contentHtml;
        
        // Load meeting history
        await loadMeetingHistory(contact.email);
        
        // Store current contact for editing
        currentEditingContact = contact;
        
        // Load custom fields (future-proof)
        await loadCustomFields(contact);
        
        document.getElementById('modal-backdrop').classList.remove('hidden');
        modal.classList.remove('hidden');
      } catch (error) {
        console.error('Error viewing contact:', error);
        showNotification('Failed to load contact details');
      }
    }
    
    function bookContact(email) {
      showNotification(`Booking meeting with: ${email}`);
      // Here you would typically open the booking flow
    }
    
    function removeContact(email) {
      window.contactToDelete = email;
      document.getElementById('delete-contact-message').textContent = `Are you sure you want to remove ${email} from your contacts?`;
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('delete-contact-confirm-modal').classList.remove('hidden');
    }

    async function confirmDeleteContact() {
      const email = window.contactToDelete;
      if (!email) return;
      try {
        // Prefer ID from the rendered row if available
        const row = document.getElementById(`contact-${email}`);
        let contactId = row && row.dataset ? row.dataset.contactId : null;
        // Fallback: search local cache
        if (!contactId) {
          const contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
          const contact = contacts.find(c => c.email === email);
          if (contact && contact.id) contactId = contact.id;
        }
        if (!contactId) {
          showNotification('Failed to remove contact: missing ID');
          closeDeleteContactConfirmModal();
          return;
        }
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        const res = await fetch(`${API_URL}/contacts/${contactId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clean}` } });
        if (!res.ok) {
          showNotification('Failed to remove contact');
        } else {
          // Remove from local storage cache
          let contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
          contacts = contacts.filter(c => c.email !== email && c.id !== contactId);
          localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
          // Remove from DOM and refresh list
          if (row) row.remove();
          await renderContacts();
          showNotification(`Contact removed: ${email}`);
        }
      } catch (e) {
        console.error('Error deleting contact:', e);
        showNotification('Failed to remove contact');
      } finally {
        closeDeleteContactConfirmModal();
      }
    }

    function closeDeleteContactConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-contact-confirm-modal').classList.add('hidden');
      window.contactToDelete = null;
    }
    
    let favoritesFilterActive = false;
    let searchFilter = '';

    function toggleFavorites() {
      favoritesFilterActive = !favoritesFilterActive;
      const btn = document.getElementById('favorites-filter-btn');
      
      if (favoritesFilterActive) {
        btn.classList.add('favorites-filter-active');
        showNotification('Showing favorites only');
      } else {
        btn.classList.remove('favorites-filter-active');
        showNotification('Showing all contacts');
      }
      
      filterContacts();
    }

    function filterContacts() {
      const rows = document.querySelectorAll('#contacts-section tbody tr');
      
      rows.forEach(row => {
        const favoriteBtn = row.querySelector('.favorite-btn');
        if (!favoriteBtn) return;
        
        const name = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const email = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
        const isFavorited = favoriteBtn.querySelector('.material-icons-outlined').textContent === 'star';
        
        let showRow = true;
        
        // Apply search filter
        if (searchFilter && !name.includes(searchFilter) && !email.includes(searchFilter)) {
          showRow = false;
        }
        
        // Apply favorites filter
        if (favoritesFilterActive && !isFavorited) {
          showRow = false;
        }
        
        row.style.display = showRow ? '' : 'none';
      });
    }
    
    function toggleFavorite(email, button) {
      const starIcon = button.querySelector('.material-icons-outlined');
      const isFavorited = starIcon.textContent === 'star';

      if (isFavorited) {
        // Remove from favorites
        starIcon.textContent = 'star_border';
        button.classList.remove('favorited');
        button.classList.remove('text-[#34D399]');
        button.classList.add('text-[#A3B3AF]');
        showNotification(`${email} removed from favorites`);
      } else {
        // Add to favorites
        starIcon.textContent = 'star';
        button.classList.add('favorited');
        button.classList.remove('text-[#A3B3AF]');
        button.classList.add('text-[#34D399]');
        showNotification(`${email} added to favorites`);
      }

      // Re-apply filters after changing favorite status
      filterContacts();
      const contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
      const contact = contacts.find(c => c.email === email);
      if (contact) {
        contact.favorite = !isFavorited;
        localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        fetch(`${API_URL}/contacts/${contact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ favorite: contact.favorite })
        });
      }
    }

    async function renderTagOptions() {
      const container = document.getElementById('contact-tag-options');
      if (!container) return;
      container.innerHTML = '';

      try {
        const tags = await fetchTagsFromServer();
        
        if (tags.length === 0) {
          container.innerHTML = '<p class="text-[#A3B3AF] text-sm">No tags available</p>';
          return;
        }
        
        tags.forEach(tag => {
          const name = (typeof tag === 'string') ? tag : (tag?.name || '');
          if (!name) return;
          const id = 'tag-option-' + name.replace(/\s+/g, '-');
          container.innerHTML += `<label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="${name}" class="w-4 h-4 text-[#34D399] bg-[#19342e] border-[#2C4A43] rounded focus:ring-[#34D399] focus:ring-2">
              <span class="text-[#E0E0E0] text-sm">${name}</span>
            </label>`;
        });
      } catch (error) {
        console.error('Error loading tags:', error);
        container.innerHTML = '<p class="text-red-400 text-sm">Error loading tags</p>';
      }
    }

    function openCreateTagModal() {
      const backdrop = document.getElementById('modal-backdrop');
      backdrop.classList.remove('hidden');
      backdrop.style.zIndex = '55'; // Higher than tags modal but lower than create tag modal
      document.getElementById('create-tag-modal').classList.remove('hidden');
      document.getElementById('new-tag-name').value = '';
    }

    function closeCreateTagModal() {
      const backdrop = document.getElementById('modal-backdrop');
      backdrop.classList.add('hidden');
      backdrop.style.zIndex = '50'; // Reset to original z-index
      document.getElementById('create-tag-modal').classList.add('hidden');
    }

    async function saveTag() {
      const name = document.getElementById('new-tag-name').value.trim();
      if (!name) {
        showNotification('Tag name required');
        return;
      }

      try {
        const token = getAnyToken();
        const clean = token.replace(/^"|"$/g, '');
        const res = await fetch(`${API_URL}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const tag = await res.json();
        const tags = JSON.parse(localStorage.getItem('calendarify-tags') || '[]');
        const map = JSON.parse(localStorage.getItem('calendarify-tag-map') || '{}');
        if (!tags.includes(tag.name)) tags.push(tag.name);
        map[tag.name] = tag.id;
        localStorage.setItem('calendarify-tags', JSON.stringify(tags));
        localStorage.setItem('calendarify-tag-map', JSON.stringify(map));
        
        showNotification(`Tag "${name}" created`);
        closeCreateTagModal();
        await renderTagOptions();
        
        // Check if tags modal is open and refresh it
        const tagsModal = document.getElementById('tags-modal');
        if (!tagsModal.classList.contains('hidden')) {
          // Check if it's the manage tags modal or contact tags modal
          const tagsList = document.getElementById('tags-list');
          if (tagsList && tagsList.innerHTML.includes('Current Tags:')) {
            // It's a contact tags modal, use the stored contact email
            const currentContactEmail = tagsModal.getAttribute('data-current-contact');
            if (currentContactEmail) {
              // Small delay to ensure the create tag modal is fully closed
              setTimeout(async () => {
                await showContactTagsModal(currentContactEmail);
              }, 100);
            }
          } else {
            // It's the manage tags modal
            openManageTagsModal();
          }
        }
      } catch (error) {
        console.error('Error creating tag:', error);
        showNotification('Failed to create tag');
      }
    }

    async function openManageTagsModal() {
      const modal = document.getElementById('tags-modal');
      const list = document.getElementById('tags-list');
      const title = document.getElementById('tags-modal-title');
      
      // Set modal title
      title.textContent = 'Manage Tags';
      
      // Clear previous content
      list.innerHTML = '';
      
      try {
        const tags = await fetchTagsFromServer();
        
        // Add tags to the list
        if (tags && tags.length > 0) {
          tags.forEach((tag, index) => {
            // Handle both string and object tag formats
            const tagName = typeof tag === 'string' ? tag : (tag.name || tag.id || 'Unknown Tag');
            const tagId = typeof tag === 'string' ? tag : tag.id;
            
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg hover:border-[#34D399] transition-colors';
            item.innerHTML = `
              <div class="flex items-center gap-3">
                <span class="material-icons-outlined text-[#34D399]">local_offer</span>
                <span class="text-[#E0E0E0] font-medium">${tagName}</span>
              </div>
              <button onclick="removeTag('${tagId}')" class="p-1 text-[#A3B3AF] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Remove tag">
                <span class="material-icons-outlined text-sm">delete</span>
              </button>
            `;
            list.appendChild(item);
          });
        } else {
          const item = document.createElement('div');
          item.className = 'flex items-center gap-3 p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg';
          item.innerHTML = `
            <span class="material-icons-outlined text-[#A3B3AF]">local_offer</span>
            <span class="text-[#A3B3AF]">No tags available</span>
          `;
          list.appendChild(item);
        }
        
        // Add create tag button
        const createButton = document.createElement('div');
        createButton.className = 'mt-4 pt-4 border-t border-[#2C4A43]';
        createButton.innerHTML = `
          <button onclick="openCreateTagModal()" class="w-full bg-[#34D399] text-[#1A2E29] px-4 py-2 rounded-lg hover:bg-[#2C4A43] transition-colors font-bold flex items-center justify-center gap-2">
            <span class="material-icons-outlined text-sm">add</span>
            Create New Tag
          </button>
        `;
        list.appendChild(createButton);
        
        // Show modal
        document.getElementById('modal-backdrop').classList.remove('hidden');
        modal.classList.remove('hidden');
      } catch (error) {
        console.error('Error loading tags:', error);
        showNotification('Error loading tags');
      }
    }

    function closeTagsModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('tags-modal').classList.add('hidden');
    }

    function openZoomModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('zoom-modal').classList.remove('hidden');
    }

    function closeZoomModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('zoom-modal').classList.add('hidden');
    }

    async function activateZoom() {
      try {
        const token = getAnyToken();
        if (!token) return;
        const clean = token.replace(/^"|"$/g, '');
        const res = await fetch(`${API_URL}/integrations/zoom/auth-url`, {
          headers: { Authorization: `Bearer ${clean}` },
        });
        console.log('[DEBUG] activateZoom status:', res.status);
        if (res.ok) {
          const data = await res.json();
          window.location.href = data.url;
        } else {
          showNotification('Failed to connect Zoom');
        }
      } catch (e) {
        console.error(e);
        showNotification('Failed to connect Zoom');
      }
      closeZoomModal();
    }


    async function connectGoogleCalendar() {
      console.log('connectGoogleCalendar called');
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/integrations/google/auth-url`, {
        headers: { Authorization: `Bearer ${clean}` },
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        showNotification('Failed to start Google OAuth');
      }
    }

    async function showContactTagsModal(contactEmail) {
      const modal = document.getElementById('tags-modal');
      const list = document.getElementById('tags-list');
      const title = document.getElementById('tags-modal-title');
      
      modal.setAttribute('data-current-contact', contactEmail);
      list.innerHTML = '';

      try {
        const contacts = await fetchContactsFromServer();
        const contact = contacts.find(c => c.email === contactEmail);
        
        if (!contact) {
          showNotification('Contact not found');
          return;
        }
      
      // Set modal title
      title.textContent = `${contact.name}'s Tags`;
      
      // Add contact info header
      const contactInfo = document.createElement('div');
      contactInfo.className = 'flex items-center justify-between p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg mb-4';
      contactInfo.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="material-icons-outlined text-[#34D399]">person</span>
          <div>
            <span class="text-[#E0E0E0] font-medium">${contact.name}</span>
            <div class="text-[#A3B3AF] text-sm">${contact.email}</div>
          </div>
        </div>
      `;
      list.appendChild(contactInfo);
      
      // Add tags section
      const tagsHeader = document.createElement('div');
      tagsHeader.className = 'text-[#A3B3AF] text-sm font-medium mb-2';
      tagsHeader.textContent = 'Current Tags:';
      list.appendChild(tagsHeader);
      
      if (!contact.tags || contact.tags.length === 0) {
        const noTags = document.createElement('div');
        noTags.className = 'flex items-center gap-3 p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg mb-4';
        noTags.innerHTML = `
          <span class="material-icons-outlined text-[#A3B3AF]">local_offer</span>
          <span class="text-[#A3B3AF]">No tags assigned</span>
        `;
        list.appendChild(noTags);
      } else {
        contact.tags.forEach(tag => {
          const tagItem = document.createElement('div');
          tagItem.className = 'flex items-center justify-between p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg mb-2 hover:border-[#34D399] transition-colors';
          tagItem.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="material-icons-outlined text-[#34D399]">local_offer</span>
              <span class="text-[#E0E0E0] font-medium">${tag}</span>
            </div>
            <button onclick="removeTagFromContact('${contact.email}', '${tag}')" class="p-1 text-[#A3B3AF] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Remove tag">
              <span class="material-icons-outlined text-sm">remove_circle</span>
            </button>
          `;
          list.appendChild(tagItem);
        });
      }
      
      // Add available tags section for adding new tags
      const availableTagsHeader = document.createElement('div');
      availableTagsHeader.className = 'text-[#A3B3AF] text-sm font-medium mb-2 mt-4';
      availableTagsHeader.textContent = 'Add Tags:';
      list.appendChild(availableTagsHeader);
      
      // Get all available tags from server
      const token = getAnyToken();
      const clean = token ? token.replace(/^"|"$/g, '') : '';
      const tagsRes = await fetch(`${API_URL}/tags`, { headers: { Authorization: `Bearer ${clean}` } });
      let allTags = [];
      if (tagsRes.ok) {
        const serverTags = await tagsRes.json();
        allTags = serverTags.map(tag => tag.name);
      }
      const availableTags = allTags.filter(tag => !contact.tags || !contact.tags.includes(tag));
      
      if (availableTags.length === 0) {
        const noAvailableTags = document.createElement('div');
        noAvailableTags.className = 'flex items-center gap-3 p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg mb-4';
        noAvailableTags.innerHTML = `
          <span class="material-icons-outlined text-[#A3B3AF]">local_offer</span>
          <span class="text-[#A3B3AF]">No available tags to add</span>
        `;
        list.appendChild(noAvailableTags);
      } else {
        availableTags.forEach(tag => {
          const tagItem = document.createElement('div');
          tagItem.className = 'flex items-center justify-between p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg mb-2 hover:border-[#34D399] transition-colors';
          tagItem.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="material-icons-outlined text-[#A3B3AF]">local_offer</span>
              <span class="text-[#E0E0E0] font-medium">${tag}</span>
            </div>
            <button onclick="addTagToContact('${contact.email}', '${tag}')" class="p-1 text-[#A3B3AF] hover:text-[#34D399] hover:bg-[#34D399]/10 rounded transition-colors" title="Add tag">
              <span class="material-icons-outlined text-sm">add_circle</span>
            </button>
          `;
          list.appendChild(tagItem);
        });
      }
      
      // Add create tag button
      const createButton = document.createElement('div');
      createButton.className = 'mt-4 pt-4 border-t border-[#2C4A43]';
      createButton.innerHTML = `
        <button onclick="openCreateTagModal()" class="w-full bg-[#34D399] text-[#1A2E29] px-4 py-2 rounded-lg hover:bg-[#2C4A43] transition-colors font-bold flex items-center justify-center gap-2">
          <span class="material-icons-outlined text-sm">add</span>
          Create New Tag
        </button>
      `;
      list.appendChild(createButton);
      
      // Show modal
      document.getElementById('modal-backdrop').classList.remove('hidden');
      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Error showing contact tags modal:', error);
      showNotification('Failed to load contact tags');
    }
    }

    async function removeTag(tagName) {
      try {
        const map = JSON.parse(localStorage.getItem('calendarify-tag-map') || '{}');
        const tagId = map[tagName];
        if (tagId) {
          const token = getAnyToken();
          const clean = token.replace(/^"|"$/g, '');
          await fetch(`${API_URL}/tags/${tagId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clean}` } });
        }
        const tags = JSON.parse(localStorage.getItem('calendarify-tags') || '[]');
        const updatedTags = tags.filter(tag => tag !== tagName);
        delete map[tagName];
        localStorage.setItem('calendarify-tags', JSON.stringify(updatedTags));
        localStorage.setItem('calendarify-tag-map', JSON.stringify(map));
        
        showNotification('Tag removed successfully');
        
        // Refresh the contacts table
        await renderContacts();
        
        // Check if tags modal is open and refresh it instead of closing
        const tagsModal = document.getElementById('tags-modal');
        if (!tagsModal.classList.contains('hidden')) {
          // Check if it's the manage tags modal or contact tags modal
          const tagsList = document.getElementById('tags-list');
          if (tagsList && tagsList.innerHTML.includes('Current Tags:')) {
            // It's a contact tags modal, use the stored contact email
            const currentContactEmail = tagsModal.getAttribute('data-current-contact');
            if (currentContactEmail) {
              await showContactTagsModal(currentContactEmail);
            }
          } else {
            // It's the manage tags modal, refresh it
            openManageTagsModal();
          }
        }
      } catch (error) {
        console.error('Error removing tag:', error);
        showNotification('Failed to remove tag');
      }
    }

    async function addTagToContact(contactEmail, tagName) {
      try {
        const contacts = await fetchContactsFromServer();
        const contact = contacts.find(c => c.email === contactEmail);

        if (!contact) {
          showNotification('Contact not found');
          return;
        }

        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        await fetch(`${API_URL}/contacts/${contact.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ tagName })
        });

        showNotification(`Tag "${tagName}" added to ${contact.name}`);
        await renderContacts();
        await showContactTagsModal(contactEmail);
      } catch (error) {
        console.error('Error adding tag to contact:', error);
        showNotification('Failed to add tag to contact');
      }
    }

    async function removeTagFromContact(contactEmail, tagName) {
      try {
        const contacts = await fetchContactsFromServer();
        const contact = contacts.find(c => c.email === contactEmail);

        if (!contact) {
          showNotification('Contact not found');
          return;
        }

        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        await fetch(`${API_URL}/contacts/${contact.id}/tags/${encodeURIComponent(tagName)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${clean}` }
        });

          showNotification(`Tag "${tagName}" removed from ${contact.name}`);
          await renderContacts();
          await showContactTagsModal(contactEmail);
      } catch (error) {
        console.error('Error removing tag from contact:', error);
        showNotification('Failed to remove tag from contact');
      }
    }

    function formatTimeAgo(date) {
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) {
        return 'Just now';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 31536000) {
        const months = Math.floor(diffInSeconds / 2592000);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      } else {
        const years = Math.floor(diffInSeconds / 31536000);
        return `${years} year${years > 1 ? 's' : ''} ago`;
      }
    }

    function addContactRow(contact) {
      const tbody = document.querySelector('#contacts-section tbody');
      if (!tbody) return;
      
      console.log('[DEBUG] Adding contact row:', contact);
      console.log('[DEBUG] Contact tags:', contact.tags);
      console.log('[DEBUG] Tags type:', typeof contact.tags);
      console.log('[DEBUG] Tags is array:', Array.isArray(contact.tags));
      
      // Ensure tags is always an array of strings
      let tags = [];
      if (contact.tags && Array.isArray(contact.tags)) {
        tags = contact.tags.map(tag => {
          if (typeof tag === 'string') {
            return tag;
          } else if (typeof tag === 'object' && tag !== null) {
            console.log('[DEBUG] Tag object found:', tag);
            // Try to extract the name from the tag object
            if (tag.name) return tag.name;
            if (tag.tag && tag.tag.name) return tag.tag.name;
            return JSON.stringify(tag);
          }
          return String(tag);
        });
      }
      
      console.log('[DEBUG] Processed tags:', tags);
      
      let tagsHtml = '';
      if (tags.length === 0) {
        tagsHtml = '<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal(\'' + contact.email + '\')">No Tags</span>';
      } else if (tags.length <= 2) {
        tagsHtml = tags.map(t => `<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal('${contact.email}')">${t}</span>`).join('');
      } else {
        tagsHtml = `<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal('${contact.email}')">${tags[0]}</span><span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal('${contact.email}')">+${tags.length - 1}</span>`;
      }
      // Format the last updated time
      const lastUpdated = contact.updatedAt ? formatTimeAgo(new Date(contact.updatedAt)) : 'Never';
      
      const row = document.createElement('tr');
      row.className = 'table-row';
      row.id = `contact-${contact.email}`;
      if (contact.id) row.dataset.contactId = contact.id;
      row.innerHTML = `
        <td class="py-2 text-center">
          <button class="favorite-btn ${contact.favorite ? 'text-[#34D399]' : 'text-[#A3B3AF]'} hover:text-[#34D399] transition-colors" onclick="toggleFavorite('${contact.email}', this)">
            <span class="material-icons-outlined text-xl">${contact.favorite ? 'star' : 'star_border'}</span>
          </button>
        </td>
        <td class="py-2 text-center">${contact.name}</td>
        <td class="py-2 text-center">${contact.email}</td>
        <td class="py-2 text-center text-[#A3B3AF]">${lastUpdated}</td>
        <td class="py-2 text-center"><div class="flex flex-wrap gap-1 justify-center">${tagsHtml}</div></td>
        <td class="py-2 text-center">
          <div class="flex gap-2 justify-center">
            <button class="btn-secondary" onclick="viewContact('${contact.email}')">View</button>
            <div class="relative inline-block text-left">
              <button class="kebab-btn flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#223c36] transition-colors" type="button" onclick="toggleContactMenu(this)">
                <span class="material-icons-outlined">more_vert</span>
              </button>
              <div class="contact-menu absolute bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg z-[9999]">
                <button class="w-full flex items-center gap-2 px-4 py-2 text-[#34D399] hover:bg-[#223c36] text-sm font-semibold" onclick="bookContact('${contact.email}')">
                  <span class="material-icons-outlined text-xs">event</span>Book
                </button>
                <button class="w-full flex items-center gap-2 px-4 py-2 text-[#EF4444] hover:bg-[#223c36] text-sm font-semibold" onclick="removeContact('${contact.email}')">
                  <span class="material-icons-outlined text-xs">delete</span>Remove
                </button>
              </div>
            </div>
          </div>
        </td>`;
      tbody.appendChild(row);
    }

    async function renderContacts() {
      const tbody = document.querySelector('#contacts-section tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      try {
        const contacts = await fetchContactsFromServer();
        
        // Sort contacts by last updated time (newest first)
        contacts.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
          const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
          return dateB - dateA;
        });
        
        contacts.forEach(c => addContactRow(c));
        filterContacts();
      } catch (error) {
        console.error('Error loading contacts:', error);
        showNotification('Error loading contacts');
      }
    }
    
    // Close contact dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.kebab-btn') && !e.target.closest('.contact-menu')) {
        document.querySelectorAll('.contact-menu').forEach(menu => menu.classList.remove('open'));
      }
    });

    function closeAddContactModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('add-contact-modal').classList.add('hidden');
      // Clear form fields
      document.getElementById('contact-name').value = '';
      document.getElementById('contact-email').value = '';
      document.getElementById('contact-phone').value = '';
      document.getElementById('contact-company').value = '';
      document.getElementById('contact-notes').value = '';
      document.getElementById('contact-favorite').checked = false;
      const tagContainer = document.getElementById('contact-tag-options');
      if (tagContainer) tagContainer.innerHTML = '';
    }

    function closeContactViewModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('contact-view-modal').classList.add('hidden');
      
      // Reset edit mode
      if (currentEditingContact) {
        exitContactEditMode();
        currentEditingContact = null;
      }
    }

    async function loadMeetingHistory(contactEmail) {
      try {
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        
        const res = await fetch(`${API_URL}/bookings`, { headers: { Authorization: `Bearer ${clean}` } });
        if (res.ok) {
          const bookings = await res.json();
          const contactBookings = bookings.filter(booking => booking.email === contactEmail);
          
          const historyContent = document.getElementById('meeting-history-content');
          if (contactBookings.length === 0) {
            historyContent.innerHTML = '<span class="text-[#A3B3AF] italic">No meetings found</span>';
          } else {
            const historyHtml = contactBookings.map(booking => `
              <div class="flex items-center justify-between p-3 bg-[#223c36] rounded border border-[#2C4A43] mb-2">
                <div class="flex-1">
                  <div class="text-[#E0E0E0] font-medium">${booking.event_type?.title || 'Unknown Event'}</div>
                  <div class="text-[#A3B3AF] text-sm">${new Date(booking.starts_at).toLocaleDateString()} at ${new Date(booking.starts_at).toLocaleTimeString()}</div>
                </div>
                <div class="text-[#34D399] text-sm font-medium">
                  ${new Date(booking.starts_at) > new Date() ? 'Upcoming' : 'Completed'}
                </div>
              </div>
            `).join('');
            historyContent.innerHTML = historyHtml;
          }
        }
      } catch (error) {
        console.error('Error loading meeting history:', error);
        const historyContent = document.getElementById('meeting-history-content');
        historyContent.innerHTML = '<span class="text-[#EF4444] italic">Failed to load meeting history</span>';
      }
    }

    async function loadCustomFields(contact) {
      try {
        const customFieldsContent = document.getElementById('custom-fields-content');
        
        // This function is designed to be future-proof
        // It will automatically detect and display any additional fields added to contacts
        const standardFields = ['id', 'userId', 'name', 'email', 'phone', 'company', 'notes', 'favorite', 'tags', 'createdAt', 'updatedAt'];
        const customFields = Object.keys(contact).filter(key => !standardFields.includes(key));
        
        if (customFields.length === 0) {
          customFieldsContent.innerHTML = '<span class="text-[#A3B3AF] italic">No additional fields available</span>';
        } else {
          let customFieldsHtml = '';
          customFields.forEach(field => {
            const value = contact[field];
            if (value !== null && value !== undefined && value !== '') {
              let displayValue = value;
              if (typeof value === 'object') {
                displayValue = JSON.stringify(value);
              }
              customFieldsHtml += `
                <div class="flex items-center gap-3 mb-2">
                  <span class="material-icons-outlined text-[#34D399]">add_circle</span>
                  <div>
                    <div class="text-[#A3B3AF] text-sm capitalize">${field.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div class="text-[#E0E0E0] font-medium">${displayValue}</div>
                  </div>
                </div>
              `;
            }
          });
          
          if (customFieldsHtml) {
            customFieldsContent.innerHTML = customFieldsHtml;
          } else {
            customFieldsContent.innerHTML = '<span class="text-[#A3B3AF] italic">No additional fields available</span>';
          }
        }
      } catch (error) {
        console.error('Error loading custom fields:', error);
        const customFieldsContent = document.getElementById('custom-fields-content');
        customFieldsContent.innerHTML = '<span class="text-[#EF4444] italic">Failed to load custom fields</span>';
      }
    }

    // Quick Action Functions
    function copyContactEmail() {
      const emailElement = document.querySelector('#contact-view-content .text-[#E0E0E0].font-medium');
      if (emailElement) {
        const email = emailElement.textContent;
        navigator.clipboard.writeText(email).then(() => {
          showNotification('Email copied to clipboard!');
        }).catch(() => {
          showNotification('Failed to copy email');
        });
      }
    }

    function copyContactPhone() {
      const phoneElement = document.querySelector('#contact-view-content .text-[#E0E0E0].font-medium');
      if (phoneElement) {
        const phone = phoneElement.textContent;
        if (phone && phone.includes('@') === false) { // Simple check to ensure it's a phone number
          navigator.clipboard.writeText(phone).then(() => {
            showNotification('Phone number copied to clipboard!');
          }).catch(() => {
            showNotification('Failed to copy phone number');
          });
        } else {
          showNotification('No phone number available');
        }
      }
    }

    function sendEmailToContact() {
      const emailElement = document.querySelector('#contact-view-content .text-[#E0E0E0].font-medium');
      if (emailElement) {
        const email = emailElement.textContent;
        if (email && email.includes('@')) {
          window.open(`mailto:${email}`, '_blank');
        } else {
          showNotification('No valid email address found');
        }
      }
    }

    function duplicateContact() {
      showNotification('Duplicate contact functionality coming soon!');
    }

    // Contact Edit Mode Functions
    let currentEditingContact = null;

    function toggleContactEditMode() {
      const editBtn = document.getElementById('edit-contact-btn');
      const saveSection = document.getElementById('contact-save-section');
      
      if (editBtn.classList.contains('editing')) {
        // Exit edit mode
        exitContactEditMode();
      } else {
        // Enter edit mode
        enterContactEditMode();
      }
    }

    function enterContactEditMode() {
      const editBtn = document.getElementById('edit-contact-btn');
      const saveSection = document.getElementById('contact-save-section');
      
      // Show edit mode
      editBtn.classList.add('editing');
      editBtn.innerHTML = '<span class="material-icons-outlined">visibility</span>';
      editBtn.title = 'Exit Edit Mode';
      
      // Show save section
      saveSection.classList.remove('hidden');
      
      // Hide display elements and show edit elements
      document.getElementById('contact-email-display').classList.add('hidden');
      document.getElementById('contact-email-edit').classList.remove('hidden');
      document.getElementById('contact-phone-display').classList.add('hidden');
      document.getElementById('contact-phone-edit').classList.remove('hidden');
      document.getElementById('contact-company-display').classList.add('hidden');
      document.getElementById('contact-company-edit').classList.remove('hidden');
      document.getElementById('contact-favorite-display').classList.add('hidden');
      document.getElementById('contact-favorite-edit').classList.remove('hidden');
      document.getElementById('contact-notes-display').classList.remove('hidden');
      document.getElementById('contact-notes-edit').classList.remove('hidden');
    }

    function exitContactEditMode() {
      const editBtn = document.getElementById('edit-contact-btn');
      const saveSection = document.getElementById('contact-save-section');
      
      // Hide edit mode
      editBtn.classList.remove('editing');
      editBtn.innerHTML = '<span class="material-icons-outlined">edit</span>';
      editBtn.title = 'Edit Contact';
      
      // Hide save section
      saveSection.classList.add('hidden');
      
      // Show display elements and hide edit elements
      document.getElementById('contact-email-display').classList.remove('hidden');
      document.getElementById('contact-email-edit').classList.add('hidden');
      document.getElementById('contact-phone-display').classList.remove('hidden');
      document.getElementById('contact-phone-edit').classList.add('hidden');
      document.getElementById('contact-company-display').classList.remove('hidden');
      document.getElementById('contact-company-edit').classList.add('hidden');
      document.getElementById('contact-favorite-display').classList.remove('hidden');
      document.getElementById('contact-favorite-edit').classList.add('hidden');
      document.getElementById('contact-notes-display').classList.remove('hidden');
      document.getElementById('contact-notes-edit').classList.add('hidden');
    }

    function cancelContactEdit() {
      // Reset form values to original
      if (currentEditingContact) {
        document.getElementById('contact-email-edit').value = currentEditingContact.email;
        document.getElementById('contact-phone-edit').value = currentEditingContact.phone || '';
        document.getElementById('contact-company-edit').value = currentEditingContact.company || '';
        document.getElementById('contact-favorite-edit').value = currentEditingContact.favorite.toString();
        document.getElementById('contact-notes-edit').value = currentEditingContact.notes || '';
      }
      
      exitContactEditMode();
    }

    async function saveContactChanges() {
      try {
        const email = document.getElementById('contact-email-edit').value;
        const phone = document.getElementById('contact-phone-edit').value;
        const company = document.getElementById('contact-company-edit').value;
        const favorite = document.getElementById('contact-favorite-edit').value === 'true';
        const notes = document.getElementById('contact-notes-edit').value;

        if (!email) {
          showNotification('Email is required');
          return;
        }

        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';
        
        // Update contact
        const res = await fetch(`${API_URL}/contacts/${currentEditingContact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({
            email,
            phone: phone || null,
            company: company || null,
            favorite,
            notes: notes || null
          })
        });

        if (res.ok) {
          showNotification('Contact updated successfully!');
          
          // Update the current contact object
          currentEditingContact.email = email;
          currentEditingContact.phone = phone || null;
          currentEditingContact.company = company || null;
          currentEditingContact.favorite = favorite;
          currentEditingContact.notes = notes || null;
          
          // Update display values
          document.getElementById('contact-email-display').textContent = email;
          document.getElementById('contact-phone-display').textContent = phone || '-';
          document.getElementById('contact-company-display').textContent = company || '-';
          document.getElementById('contact-favorite-display').textContent = favorite ? 'Favorite' : 'Regular Contact';
          document.getElementById('contact-notes-display').textContent = notes || 'No notes available';
          
          // Exit edit mode
          exitContactEditMode();
          
          // Refresh contacts list
          await renderContacts();
        } else {
          showNotification('Failed to update contact');
        }
      } catch (error) {
        console.error('Error updating contact:', error);
        showNotification('Failed to update contact');
      }
    }

    async function saveContact() {
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      const company = document.getElementById('contact-company').value.trim();
      const notes = document.getElementById('contact-notes').value.trim();
      const favorite = document.getElementById('contact-favorite').checked;

      if (!name || !email) {
        showNotification('Name and email are required');
        return;
      }

      if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address');
        return;
      }

      const tags = Array.from(document.querySelectorAll('#contact-tag-options input:checked')).map(cb => cb.value);

      try {
        const token = getAnyToken();
        const clean = token ? token.replace(/^"|"$/g, '') : '';

        const res = await fetch(`${API_URL}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ name, email, phone, company, notes, favorite, tags })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const newContact = await res.json();

        // Refresh contacts data from server
        await fetchContactsFromServer();
        addContactRow(newContact);

        showNotification(`Contact "${name}" added successfully!`);
        closeAddContactModal();
      } catch (error) {
        console.error('Error creating contact:', error);
        showNotification('Failed to create contact');
      }
    }

    function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    function handleSearch(event) {
      searchFilter = event.target.value.toLowerCase();
      filterContacts();
    }

    function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    // Meetings search functionality
    let meetingsSearchFilter = '';

    function handleMeetingsSearch(event) {
      meetingsSearchFilter = event.target.value.toLowerCase();
      filterMeetings();
    }

    function filterMeetings() {
      const rows = document.querySelectorAll('#meetings-section tbody tr');
      
      rows.forEach(row => {
        const inviteeName = row.querySelector('td:nth-child(1) .text-white').textContent.toLowerCase();
        const inviteeEmail = row.querySelector('td:nth-child(1) .text-\\[\\#A3B3AF\\]').textContent.toLowerCase();
        const eventType = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const dateTime = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
        
        let showRow = true;
        
        // Apply search filter
        if (meetingsSearchFilter && 
            !inviteeName.includes(meetingsSearchFilter) && 
            !inviteeEmail.includes(meetingsSearchFilter) && 
            !eventType.includes(meetingsSearchFilter) && 
            !dateTime.includes(meetingsSearchFilter)) {
          showRow = false;
        }
        
        row.style.display = showRow ? '' : 'none';
      });
    }

    // Export CSV functionality
    function exportCSV() {
      console.log('exportCSV called');
      
      const activeTabButton = document.querySelector('#meetings-section button.active-tab');
      if (!activeTabButton) {
        showNotification('Could not determine current tab');
        return;
      }
      
      const currentTab = activeTabButton.getAttribute('data-tab');
      console.log('Current tab:', currentTab);
      
      const meetings = getMeetingsData(currentTab);
      console.log('Meetings to export:', meetings);
      
      if (meetings.length === 0) {
        showNotification('No meetings to export');
        return;
      }
      
      // Create CSV content
      let csvContent = 'Invitee,Email,Event Type,Date/Time,Status\n';
      
      meetings.forEach(meeting => {
        const row = [
          meeting.invitee,
          meeting.email,
          meeting.eventType,
          meeting.date,
          meeting.status
        ].map(field => `"${field}"`).join(',');
        csvContent += row + '\n';
      });
      
      console.log('CSV content:', csvContent);
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `meetings_${currentTab}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification(`Exported ${meetings.length} meetings to CSV`);
    }

    // Meeting action functions
    function joinMeeting(meetingId) {
      const id = meetingId; // Keep as string for UUID compatibility
      const meeting = getMeetingsData('upcoming').find(m => m.id === id) || 
                     getMeetingsData('past').find(m => m.id === id) ||
                     getMeetingsData('pending').find(m => m.id === id);
      
      if (meeting) {
        if (meeting.zoom_link) {
          // Open Zoom link in new tab
          window.open(meeting.zoom_link, '_blank');
          showNotification(`Opening Zoom meeting with ${meeting.invitee}`);
        } else if (meeting.google_meet_link) {
          // Open Google Meet link in new tab
          window.open(meeting.google_meet_link, '_blank');
          showNotification(`Opening Google Meet with ${meeting.invitee}`);
        } else {
          showNotification(`No meeting link available for ${meeting.invitee}`);
        }
      }
    }

    function rescheduleMeeting(meetingId) {
      // Handle ID properly - don't convert UUIDs to numbers
      const id = meetingId;
      
      const meeting = getMeetingsData('upcoming').find(m => m.id === id) ||
                     getMeetingsData('pending').find(m => m.id === id);

      if (meeting) {
        window.meetingToReschedule = meeting;
        const start = new Date(meeting.start);
        const dateInput = document.getElementById('reschedule-date');
        dateInput.value = start.toISOString().split('T')[0];
        document.getElementById('modal-backdrop').classList.remove('hidden');
        document.getElementById('reschedule-modal').classList.remove('hidden');
        loadRescheduleSlots();
      } else {
        showNotification('Meeting not found or cannot be rescheduled');
      }
    }

    function cancelMeeting(meetingId) {
      console.log('cancelMeeting called with ID:', meetingId, 'Type:', typeof meetingId);
      
      // Handle ID properly - don't convert UUIDs to numbers
      const id = meetingId;
      console.log('Using ID as-is:', id);
      
      // Check all tabs to find the meeting
      const upcomingMeeting = getMeetingsData('upcoming').find(m => m.id === id);
      const pendingMeeting = getMeetingsData('pending').find(m => m.id === id);
      const pastMeeting = getMeetingsData('past').find(m => m.id === id);
      
      console.log('Found meetings:', { upcomingMeeting, pendingMeeting, pastMeeting });
      
      if (pastMeeting) {
        console.log('Past meeting found, cannot cancel');
        showNotification('Cannot cancel past meetings');
        return;
      }
      
      const meeting = upcomingMeeting || pendingMeeting;
      if (meeting) {
        console.log('Valid meeting found, showing confirmation modal');
        // Store meeting info for cancellation
        window.meetingToCancel = { id: meeting.id, invitee: meeting.invitee };
        
        // Show themed confirmation modal
        const backdrop = document.getElementById('modal-backdrop');
        const modal = document.getElementById('cancel-meeting-confirm-modal');
        
        if (backdrop && modal) {
          backdrop.classList.remove('hidden');
          modal.classList.remove('hidden');
          console.log('Cancel modal should be visible now');
        } else {
          console.error('Cancel modal elements not found:', { backdrop, modal });
          showNotification('Error: Modal not found');
        }
      } else {
        console.log('No valid meeting found');
        showNotification('Meeting not found');
      }
    }

    function deleteMeeting(meetingId) {
      console.log('deleteMeeting called with ID:', meetingId, 'Type:', typeof meetingId);
      
      // Convert to number if it's a string
      const id = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId;
      console.log('Converted ID:', id);
      
      const meeting = getMeetingsData('past').find(m => m.id === id);
      
      if (meeting) {
        console.log('Found meeting to delete:', meeting);
        // Store meeting info for deletion
        window.meetingToDelete = { id: id, invitee: meeting.invitee };
        
        // Show themed confirmation modal
        const backdrop = document.getElementById('modal-backdrop');
        const modal = document.getElementById('delete-meeting-confirm-modal');
        
        if (backdrop && modal) {
          backdrop.classList.remove('hidden');
          modal.classList.remove('hidden');
          console.log('Modal should be visible now');
        } else {
          console.error('Modal elements not found:', { backdrop, modal });
          showNotification('Error: Modal not found');
        }
      } else {
        console.log('Meeting not found in past meetings');
        showNotification('Meeting not found');
      }
    }

    async function confirmCancelMeeting() {
      const meetingInfo = window.meetingToCancel;
      if (meetingInfo) {
        console.log('Confirming cancellation for meeting:', meetingInfo);
        
        try {
          // Call server to cancel the meeting
          const token = getAnyToken();
          const clean = token ? token.replace(/^"|"$/g, '') : '';
          const res = await fetch(`${API_URL}/bookings/${meetingInfo.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${clean}` }
          });
          
          if (res.ok) {
            // First, close the modal
            closeCancelMeetingConfirmModal();
            window.meetingToCancel = null;
            
            // Show notification
            showNotification(`Meeting with ${meetingInfo.invitee} has been cancelled`);
            
            // Immediately refresh data from server to ensure consistency
            console.log('[DEBUG] Refreshing meetings data from server after cancellation...');
            await fetchMeetingsFromServer();
            
            // Update the table with fresh server data
            let currentTab = 'upcoming'; // default fallback
            const activeTabButton = document.querySelector('#meetings-section button.active-tab');
            if (activeTabButton) {
              currentTab = activeTabButton.getAttribute('data-tab');
            }
            
            console.log('Refreshing table for tab:', currentTab);
            updateMeetingsTable(currentTab);
          } else {
            console.error('Failed to cancel meeting on server:', res.status);
            showNotification('Failed to cancel meeting. Please try again.');
          }
        } catch (error) {
          console.error('Error cancelling meeting:', error);
          showNotification('Failed to cancel meeting. Please try again.');
        }
      }
    }

    function closeCancelMeetingConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('cancel-meeting-confirm-modal').classList.add('hidden');
      window.meetingToCancel = null;
    }

    function confirmDeleteMeeting() {
      const meetingInfo = window.meetingToDelete;
      if (meetingInfo) {
        console.log('Confirming deletion for meeting:', meetingInfo);
        
        // First, close the modal
        closeDeleteMeetingConfirmModal();
        window.meetingToDelete = null;
        
        // Then remove meeting from data
        removeMeetingFromData(meetingInfo.id);
        console.log('Meeting removed from data. Current data:', meetingsData);

        // Persist updated meetings to localStorage
        localStorage.setItem('calendarify-meetings', JSON.stringify(meetingsData));
        
        // Show notification
        showNotification(`Meeting with ${meetingInfo.invitee} has been deleted`);
        
        // Finally, refresh the meetings table - try multiple ways to find current tab
        let currentTab = 'past'; // default fallback for delete
        const activeTabButton = document.querySelector('#meetings-section button.active-tab');
        if (activeTabButton) {
          currentTab = activeTabButton.getAttribute('data-tab');
        }
        
        console.log('Refreshing table for tab:', currentTab);
        // Use setTimeout to ensure the modal is fully closed before updating
        setTimeout(() => {
          updateMeetingsTable(currentTab);
        }, 100);
      }
    }

    function closeDeleteMeetingConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-meeting-confirm-modal').classList.add('hidden');
      window.meetingToDelete = null;
    }

    function closeRescheduleModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('reschedule-modal').classList.add('hidden');
      window.meetingToReschedule = null;
    }

    async function loadRescheduleSlots() {
      const meeting = window.meetingToReschedule;
      if (!meeting) return;
      const dateStr = document.getElementById('reschedule-date').value;
      const res = await fetch(`${API_URL}/event-types/${meeting.slug}/slots?date=${dateStr}&exclude=${meeting.id}`);
      const select = document.getElementById('reschedule-time');
      select.innerHTML = '';
      if (res.ok) {
        const slots = await res.json();
        const is12h = getClockFormat() === '12h';
        slots.forEach(iso => {
          const d = new Date(iso);
          const display = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: is12h });
          const opt = document.createElement('option');
          opt.value = iso;
          opt.textContent = display;
          select.appendChild(opt);
        });
      }
    }

    async function confirmReschedule() {
      const meeting = window.meetingToReschedule;
      if (!meeting) return;
      const iso = document.getElementById('reschedule-time').value;
      if (!iso) {
        showNotification('Please select a new time');
        return;
      }
      const start = new Date(iso);
      const end = new Date(start.getTime() + meeting.duration * 60000);
      const token = getAnyToken();
      const clean = token ? token.replace(/^"|"$/g, '') : '';
      
      console.log('[DEBUG] Rescheduling meeting:', {
        meetingId: meeting.id,
        newStart: start.toISOString(),
        newEnd: end.toISOString(),
        duration: meeting.duration
      });
      
      try {
        const res = await fetch(`${API_URL}/bookings/${meeting.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() })
        });
        
        console.log('[DEBUG] Reschedule response status:', res.status);
        
        if (res.ok) {
          const updatedBooking = await res.json();
          console.log('[DEBUG] Server returned updated booking:', updatedBooking);
          
          showNotification(`Meeting with ${meeting.invitee} rescheduled`);
          closeRescheduleModal();
          
          // Immediately refresh data from server to ensure consistency
          console.log('[DEBUG] Refreshing meetings data from server after reschedule...');
          await fetchMeetingsFromServer();
          
          // Update the table with fresh server data
          const activeTabButton = document.querySelector('#meetings-section button.active-tab');
          const currentTab = activeTabButton ? activeTabButton.getAttribute('data-tab') : 'upcoming';
          updateMeetingsTable(currentTab);
        } else {
          const errorData = await res.json();
          console.error('[DEBUG] Reschedule failed:', errorData);
          showNotification('Failed to reschedule meeting. Please try again.');
        }
      } catch (error) {
        console.error('[DEBUG] Reschedule error:', error);
        showNotification('Failed to reschedule meeting. Please try again.');
      }
    }

    document.getElementById('reschedule-date').addEventListener('change', loadRescheduleSlots);

    // Test function to verify everything is working
    function testMeetingsFunctionality() {
      console.log('=== Testing Meetings Functionality ===');
      console.log('Current meetings data:', meetingsData);
      
      // Test export
      console.log('Testing export...');
      exportCSV();
      
      // Test tab detection
      const activeButton = document.querySelector('#meetings-section button.active-tab');
      console.log('Active button found:', activeButton);
      if (activeButton) {
        console.log('Active tab:', activeButton.getAttribute('data-tab'));
      }
      
      // Test table update
      console.log('Testing table update...');
      updateMeetingsTable('upcoming');
    }

    // Simple test function to check if table updates work
    function testTableUpdate() {
      console.log('=== Testing Table Update ===');
      
      // Check if meetings section exists
      const meetingsSection = document.getElementById('meetings-section');
      console.log('Meetings section found:', meetingsSection);
      
      // Check if table exists
      const table = document.querySelector('#meetings-section table');
      console.log('Table found:', table);
      
      // Check if tbody exists
      const tbody = document.querySelector('#meetings-section tbody');
      console.log('Tbody found:', tbody);
      
      // Try to update the table
      console.log('Attempting to update table...');
      updateMeetingsTable('upcoming');
      
      // Check if content was added
      console.log('Tbody innerHTML after update:', tbody ? tbody.innerHTML : 'No tbody');
    }

    // Test function to manually trigger a meeting cancellation
    function testCancelMeeting() {
      console.log('=== Testing Cancel Meeting ===');
      
      // Create a test meeting
      const testMeeting = {
        id: 999,
        invitee: 'Test User',
        email: 'test@example.com',
        eventType: 'Test Meeting',
        date: 'Today, 1:00 PM',
        status: 'Confirmed'
      };
      
      // Add to upcoming meetings
      meetingsData.upcoming.push(testMeeting);
      console.log('Added test meeting to data:', meetingsData);
      
      // Set as meeting to cancel
      window.meetingToCancel = testMeeting;
      
      // Show confirmation modal
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('cancel-meeting-confirm-modal').classList.remove('hidden');
      
      console.log('Test modal should be visible now');
    }

    function handleGlobalSearch(event) {
      const query = event.target.value.trim().toLowerCase();
      const resultsContainer = document.getElementById('global-search-results');
      if (!query) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        resultsContainer.onclick = null;
        return;
      }
      // Gather data
      let workflows = JSON.parse(localStorage.getItem('calendarify-workflows') || '[]');
      let contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
      let meetings = [];
      try {
        const meetingsData = JSON.parse(localStorage.getItem('calendarify-meetings') || '[]');
        if (Array.isArray(meetingsData)) {
          meetings = meetingsData;
        } else if (typeof meetingsData === 'object') {
          meetings = Object.values(meetingsData).flat();
        }
      } catch {}
      // Filter
      const workflowResults = workflows.filter(w => w.name && w.name.toLowerCase().includes(query));
      const contactResults = contacts.filter(c => (c.name && c.name.toLowerCase().includes(query)) || (c.email && c.email.toLowerCase().includes(query)));
      const meetingResults = meetings.filter(m => (m.invitee && m.invitee.toLowerCase().includes(query)) || (m.email && m.email.toLowerCase().includes(query)) || (m.eventType && m.eventType.toLowerCase().includes(query)));
      // Build results HTML
      let html = '';
      if (workflowResults.length) {
        html += `<div class='px-4 py-2 text-[#34D399] font-bold text-sm'>Workflows</div>`;
        workflowResults.forEach(w => {
          html += `<div class='search-result px-4 py-2 hover:bg-[#19342e] cursor-pointer rounded flex items-center gap-2' data-type='workflow' data-id='${w.id}'><span class='material-icons-outlined text-[#34D399]'>workflow</span>${w.name}</div>`;
        });
      }
      if (contactResults.length) {
        html += `<div class='px-4 py-2 text-[#34D399] font-bold text-sm'>Contacts</div>`;
        contactResults.forEach(c => {
          html += `<div class='search-result px-4 py-2 hover:bg-[#19342e] cursor-pointer rounded flex items-center gap-2' data-type='contact' data-email='${c.email}'><span class='material-icons-outlined text-[#34D399]'>person</span>${c.name || ''} <span class='text-[#A3B3AF] text-xs'>${c.email || ''}</span></div>`;
        });
      }
      if (meetingResults.length) {
        html += `<div class='px-4 py-2 text-[#34D399] font-bold text-sm'>Meetings</div>`;
        meetingResults.forEach(m => {
          html += `<div class='search-result px-4 py-2 hover:bg-[#19342e] cursor-pointer rounded flex items-center gap-2' data-type='meeting' data-id='${m.id}'><span class="material-icons-outlined text-[#34D399]">event</span>${m.invitee || ''} <span class="text-[#A3B3AF] text-xs">${m.eventType || ''}</span></div>`;
        });
      }
      if (!html) {
        html = `<div class='px-4 py-2 text-[#A3B3AF] text-sm'>No results found</div>`;
      }
      resultsContainer.innerHTML = html;
      resultsContainer.classList.remove('hidden');
      resultsContainer.onclick = handleSearchResultClick;
    }
    // Hide results on click outside
    window.addEventListener('click', function(e) {
      const container = document.getElementById('global-search-container');
      if (!container.contains(e.target)) {
        document.getElementById('global-search-results').classList.add('hidden');
      }
    });

    function highlightWorkflow(id) {
      setTimeout(() => {
        const row = document.getElementById(`workflow-${id}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('bg-[#34D399]', 'text-[#1A2E29]');
          setTimeout(() => row.classList.remove('bg-[#34D399]', 'text-[#1A2E29]'), 1500);
        }
      }, 200);
    }
    function highlightContact(email) {
      setTimeout(() => {
        const row = document.getElementById(`contact-${email}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('bg-[#34D399]', 'text-[#1A2E29]');
          setTimeout(() => row.classList.remove('bg-[#34D399]', 'text-[#1A2E29]'), 1500);
        }
      }, 200);
    }
    function highlightMeeting(id) {
      setTimeout(() => {
        const row = document.getElementById(`meeting-${id}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('bg-[#34D399]', 'text-[#1A2E29]');
          setTimeout(() => row.classList.remove('bg-[#34D399]', 'text-[#1A2E29]'), 1500);
        }
      }, 200);
    }

    // Add a helper to find the tab for a meeting id
    function getMeetingTabById(meetingId) {
      let meetingsDataObj = {};
      try {
        meetingsDataObj = JSON.parse(localStorage.getItem('calendarify-meetings') || '{}');
      } catch {}
      for (const tab of ['upcoming', 'past', 'pending']) {
        if (Array.isArray(meetingsDataObj[tab]) && meetingsDataObj[tab].some(m => String(m.id) === String(meetingId))) {
          return tab;
        }
      }
      return 'upcoming'; // fallback
    }

    function handleSearchResultClick(e) {
      const item = e.target.closest('.search-result');
      if (!item) return;
      const type = item.dataset.type;
      if (type === 'workflow') {
        showSection('workflows', document.querySelector(".nav-item[data-section='workflows']"));
        highlightWorkflow(item.dataset.id);
      } else if (type === 'contact') {
        showSection('contacts', document.querySelector(".nav-item[data-section='contacts']"));
        highlightContact(item.dataset.email);
      } else if (type === 'meeting') {
        showSection('meetings', document.querySelector(".nav-item[data-section='meetings']"));
        setTimeout(function(){
          showMeetingsTab(getMeetingTabById(item.dataset.id));
          setTimeout(function(){highlightMeeting(item.dataset.id);}, 200);
        }, 200);
      }
      document.getElementById('global-search-results').classList.add('hidden');
    }


    function updateGoogleCalendarButton() {
      const btn = document.getElementById('google-calendar-connect-btn');
      console.log('[DEBUG] updateGoogleCalendarButton called', btn);
      if (!btn) return;
      const token = getAnyToken();
      if (!token) {
        btn.textContent = 'Not Connected';
        btn.style.backgroundColor = '#ef4444';
        btn.style.color = '#fff';
        btn.onclick = connectGoogleCalendar;
        console.log('[DEBUG] No token found, set to Not Connected');
        return;
      }
      const clean = token.replace(/^\"|\"$/g, '');
      fetch(`${API_URL}/integrations/google/status`, {
        headers: { Authorization: `Bearer ${clean}` },
      })
        .then(res => {
          console.log('[DEBUG] /integrations/google/status response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('[DEBUG] /integrations/google/status response data:', data);
          if (data.connected) {
            btn.textContent = 'Connected';
            btn.style.backgroundColor = '#34D399';
            btn.style.color = '#1A2E29';
            btn.onclick = openDisconnectGoogleModal;
            console.log('[DEBUG] Button set to Connected (#34D399)');
          } else {
            btn.textContent = 'Not Connected';
            btn.style.backgroundColor = '#ef4444';
            btn.style.color = '#fff';
            btn.onclick = connectGoogleCalendar;
            console.log('[DEBUG] Button set to Not Connected');
          }
        })
        .catch(e => {
          btn.textContent = 'Not Connected';
          btn.style.backgroundColor = '#ef4444';
          btn.style.color = '#fff';
          btn.onclick = connectGoogleCalendar;
          console.log('[DEBUG] Error fetching status:', e);
        });
    }
    window.updateGoogleCalendarButton = updateGoogleCalendarButton;

    async function connectGoogleCalendar() {
      console.log('connectGoogleCalendar called');
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/integrations/google/auth-url`, {
        headers: { Authorization: `Bearer ${clean}` },
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        showNotification('Failed to start Google OAuth');
      }
    }
    window.connectGoogleCalendar = connectGoogleCalendar;

    function openDisconnectGoogleModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('disconnect-google-modal').classList.remove('hidden');
    }

    function closeDisconnectGoogleModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('disconnect-google-modal').classList.add('hidden');
    }

    async function confirmDisconnectGoogle() {
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/integrations/google/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clean}` },
      });
      if (res.ok) {
        localStorage.setItem('calendarify-google-calendar-connected', 'false');
        showNotification('Google Calendar disconnected');
        updateGoogleCalendarButton();
      } else {
        showNotification('Failed to disconnect Google Calendar');
      }
      closeDisconnectGoogleModal();
    }
    window.openDisconnectGoogleModal = openDisconnectGoogleModal;
    window.closeDisconnectGoogleModal = closeDisconnectGoogleModal;
    window.confirmDisconnectGoogle = confirmDisconnectGoogle;

    function updateZoomButton() {
      const btn = document.getElementById('zoom-connect-btn');
      console.log('[DEBUG] updateZoomButton called', btn);
      if (!btn) return;
      const token = getAnyToken();
      if (!token) {
        btn.textContent = 'Not Connected';
        btn.style.backgroundColor = '#ef4444';
        btn.style.color = '#fff';
        btn.onclick = connectZoomOAuth;
        console.log('[DEBUG] No token found, set to Not Connected');
        return;
      }
      const clean = token.replace(/^\"|\"$/g, '');
      fetch(`${API_URL}/integrations/zoom/status`, {
        headers: { Authorization: `Bearer ${clean}` },
      })
        .then(res => {
          console.log('[DEBUG] /integrations/zoom/status response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('[DEBUG] /integrations/zoom/status response data:', data);
          if (data.connected) {
            btn.textContent = 'Connected';
            btn.style.backgroundColor = '#34D399';
            btn.style.color = '#1A2E29';
            btn.onclick = openDisconnectZoomModal;
            console.log('[DEBUG] Button set to Connected (#34D399)');
          } else {
            btn.textContent = 'Not Connected';
            btn.style.backgroundColor = '#ef4444';
            btn.style.color = '#fff';
            btn.onclick = connectZoomOAuth;
            console.log('[DEBUG] Button set to Not Connected');
          }
        })
        .catch(e => {
          btn.textContent = 'Not Connected';
          btn.style.backgroundColor = '#ef4444';
          btn.style.color = '#fff';
          btn.onclick = connectZoomOAuth;
          console.log('[DEBUG] Error fetching status:', e);
        });
    }

    async function connectZoomOAuth() {
      console.log('connectZoomOAuth called');
      const token = getAnyToken();
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      const clean = token.replace(/^"|"$/g, '');
      console.log('Making request to Zoom auth URL...');
      try {
      const res = await fetch(`${API_URL}/integrations/zoom/auth-url`, {
        headers: { Authorization: `Bearer ${clean}` },
      });
      console.log('[DEBUG] /integrations/zoom/auth-url status:', res.status);
        console.log('[DEBUG] /integrations/zoom/auth-url headers:', Object.fromEntries(res.headers.entries()));
        
      if (res.ok) {
        const data = await res.json();
          console.log('[DEBUG] Zoom auth URL response:', data);
          console.log('[DEBUG] Redirecting to:', data.url);
          
          // Add a small delay to ensure logs are visible
          setTimeout(() => {
        window.location.href = data.url;
          }, 100);
        } else {
          const errorText = await res.text();
          console.error('[DEBUG] Zoom auth URL failed:', res.status, errorText);
          alert('Failed to get Zoom authorization URL. Please try again.');
        }
      } catch (error) {
        console.error('[DEBUG] Zoom auth URL request failed:', error);
        alert('Network error while connecting to Zoom. Please check your connection and try again.');
      }
    }
    window.connectZoomOAuth = connectZoomOAuth;
    window.updateZoomButton = updateZoomButton;

    function openDisconnectZoomModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('disconnect-zoom-modal').classList.remove('hidden');
    }
    function closeDisconnectZoomModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('disconnect-zoom-modal').classList.add('hidden');
    }
    async function confirmDisconnectZoom() {
      console.log('confirmDisconnectZoom called');
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/integrations/zoom/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clean}` },
      });
      console.log('[DEBUG] /integrations/zoom/disconnect status:', res.status);
      if (res.ok) {
        showNotification('Zoom disconnected');
        updateZoomButton();
      } else {
        showNotification('Failed to disconnect Zoom');
      }
      closeDisconnectZoomModal();
    }
    window.openDisconnectZoomModal = openDisconnectZoomModal;
    window.closeDisconnectZoomModal = closeDisconnectZoomModal;
    window.confirmDisconnectZoom = confirmDisconnectZoom;

    function updateOutlookCalendarButton() {
      const btn = document.getElementById('outlook-calendar-connect-btn');
      console.log('[DEBUG] updateOutlookCalendarButton called', btn);
      if (!btn) return;
      const token = getAnyToken();
      if (!token) {
        btn.textContent = 'Not Connected';
        btn.style.backgroundColor = '#ef4444';
        btn.style.color = '#fff';
        btn.onclick = connectOutlookCalendar;
        return;
      }
      const clean = token.replace(/^\"|\"$/g, '');
      fetch(`${API_URL}/integrations/outlook/status`, {
        headers: { Authorization: `Bearer ${clean}` },
      })
        .then(res => {
          console.log('[DEBUG] /integrations/outlook/status response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('[DEBUG] /integrations/outlook/status response data:', data);
          if (data.connected) {
            btn.textContent = 'Connected';
            btn.style.backgroundColor = '#34D399';
            btn.style.color = '#1A2E29';
            btn.onclick = openDisconnectOutlookModal;
            console.log('[DEBUG] Outlook button set to Connected');
          } else {
            btn.textContent = 'Not Connected';
            btn.style.backgroundColor = '#ef4444';
            btn.style.color = '#fff';
            btn.onclick = connectOutlookCalendar;
            console.log('[DEBUG] Outlook button set to Not Connected');
          }
        })
        .catch(() => {
          btn.textContent = 'Not Connected';
          btn.style.backgroundColor = '#ef4444';
          btn.style.color = '#fff';
          btn.onclick = connectOutlookCalendar;
          console.log('[DEBUG] Error fetching Outlook status');
        });
    }
    window.updateOutlookCalendarButton = updateOutlookCalendarButton;

    async function connectOutlookCalendar() {
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      const res = await fetch(`${API_URL}/integrations/outlook/auth-url`, {
        headers: { Authorization: `Bearer ${clean}` },
      });
      console.log('[DEBUG] /integrations/outlook/auth-url status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[DEBUG] Redirecting to', data.url);
        window.location.href = data.url;
      } else {
        showNotification('Failed to start Outlook OAuth');
      }
    }
    window.connectOutlookCalendar = connectOutlookCalendar;

    function openDisconnectOutlookModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('disconnect-outlook-modal').classList.remove('hidden');
    }
    function closeDisconnectOutlookModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('disconnect-outlook-modal').classList.add('hidden');
    }
    async function confirmDisconnectOutlook() {
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      const res = await fetch(`${API_URL}/integrations/outlook/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clean}` },
      });
      console.log('[DEBUG] /integrations/outlook/disconnect status:', res.status);
      if (res.ok) {
        showNotification('Outlook disconnected');
        updateOutlookCalendarButton();
      } else {
        showNotification('Failed to disconnect Outlook');
      }
      closeDisconnectOutlookModal();
    }
    window.openDisconnectOutlookModal = openDisconnectOutlookModal;
    window.closeDisconnectOutlookModal = closeDisconnectOutlookModal;
    window.confirmDisconnectOutlook = confirmDisconnectOutlook;

    function updateAppleCalendarButton() {
      const btn = document.getElementById('apple-calendar-connect-btn');
      if (!btn) return;
      const token = getAnyToken();
      if (!token) {
        btn.textContent = 'Not Connected';
        btn.style.backgroundColor = '#ef4444';
        btn.style.color = '#fff';
        btn.onclick = connectAppleCalendar;
        return;
      }
      const clean = token.replace(/^\"|\"$/g, '');
      fetch(`${API_URL}/integrations/apple/status`, { headers: { Authorization: `Bearer ${clean}` } })
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            btn.textContent = 'Connected';
            btn.style.backgroundColor = '#34D399';
            btn.style.color = '#1A2E29';
            btn.onclick = openDisconnectAppleModal;
          } else {
            btn.textContent = 'Not Connected';
            btn.style.backgroundColor = '#ef4444';
            btn.style.color = '#fff';
            btn.onclick = connectAppleCalendar;
          }
        })
        .catch(() => {
          btn.textContent = 'Not Connected';
          btn.style.backgroundColor = '#ef4444';
          btn.style.color = '#fff';
          btn.onclick = connectAppleCalendar;
        });
    }
    window.updateAppleCalendarButton = updateAppleCalendarButton;

    function connectAppleCalendar() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('connect-apple-modal').classList.remove('hidden');
    }
    window.connectAppleCalendar = connectAppleCalendar;

    function closeConnectAppleModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('connect-apple-modal').classList.add('hidden');
    }
    window.closeConnectAppleModal = closeConnectAppleModal;

    async function submitAppleConnect() {
      console.log('[DEBUG] submitAppleConnect called');
      const email = document.getElementById('apple-email').value.trim();
      const password = document.getElementById('apple-password').value.trim();
      if (!email || !password) {
        showNotification('Email and password required');
        return;
      }
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      console.log('[DEBUG] Connecting to Apple Calendar with email:', email);
      const res = await fetch(`${API_URL}/integrations/apple/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
        body: JSON.stringify({ email, password }),
      });
      console.log('[DEBUG] Apple connect response status:', res.status);
      if (res.ok) {
        console.log('[DEBUG] Apple Calendar connected successfully, fetching calendars...');
        // After successful connection, fetch available calendars
        await fetchAndShowAppleCalendars();
      } else if (res.status === 400) {
        showNotification('Invalid Apple credentials');
      } else if (res.status === 503) {
        showNotification('Unable to reach Apple Calendar');
      } else {
        showNotification('Failed to connect Apple Calendar');
      }
    }

    async function fetchAndShowAppleCalendars() {
      console.log('[DEBUG] fetchAndShowAppleCalendars called');
      const token = getAnyToken();
      if (!token) {
        console.log('[DEBUG] No token found');
        return;
      }
      const clean = token.replace(/^\"|\"$/g, '');
      console.log('[DEBUG] Fetching calendars from:', `${API_URL}/integrations/apple/calendars`);
      
      try {
        const res = await fetch(`${API_URL}/integrations/apple/calendars`, {
          headers: { Authorization: `Bearer ${clean}` },
        });
        
        console.log('[DEBUG] Calendar fetch response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[DEBUG] Calendar data received:', data);
          showAppleCalendarSelectionModal(data.calendars);
        } else {
          console.log('[DEBUG] Calendar fetch failed with status:', res.status);
          // Show the modal anyway, but with an error message
          showAppleCalendarSelectionModal([]);
          showNotification('Connected but failed to fetch calendars. You can still save your connection.');
        }
      } catch (error) {
        console.error('[DEBUG] Error fetching Apple calendars:', error);
        showNotification('Failed to fetch Apple calendars');
        closeConnectAppleModal();
      }
    }

    function showAppleCalendarSelectionModal(calendars) {
      console.log('[DEBUG] showAppleCalendarSelectionModal called with calendars:', calendars);
      const modal = document.getElementById('apple-calendar-selection-modal');
      const listContainer = document.getElementById('apple-calendars-list');
      
      console.log('[DEBUG] Modal element:', modal);
      console.log('[DEBUG] List container element:', listContainer);
      
      if (!modal || !listContainer) {
        console.error('[DEBUG] Modal elements not found!');
        return;
      }
      
      // Clear existing content
      listContainer.innerHTML = '';
      
      // Populate calendar list
      if (calendars.length === 0) {
        const div = document.createElement('div');
        div.className = 'p-3 text-center text-[#A3B3AF]';
        div.innerHTML = 'No calendars found or failed to fetch calendars. Your connection will still be saved.';
        listContainer.appendChild(div);
      } else {
        calendars.forEach(calendar => {
          const div = document.createElement('div');
          div.className = 'flex items-center gap-3 p-3 bg-[#19342e] rounded-lg border border-[#2C4A43]';
          div.innerHTML = `
            <input type="checkbox" id="calendar-${calendar.href}" value="${calendar.href}" class="w-4 h-4 text-[#34D399] bg-[#19342e] border-[#2C4A43] rounded focus:ring-[#34D399] focus:ring-2">
            <label for="calendar-${calendar.href}" class="text-white cursor-pointer flex-1">${calendar.name}</label>
          `;
          listContainer.appendChild(div);
        });
      }
      
      console.log('[DEBUG] About to show modal');
      // Show modal
      document.getElementById('modal-backdrop').classList.remove('hidden');
      modal.classList.remove('hidden');
      console.log('[DEBUG] Modal should now be visible');
    }

    function closeAppleCalendarSelectionModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('apple-calendar-selection-modal').classList.add('hidden');
    }

    function selectAllAppleCalendars() {
      const checkboxes = document.querySelectorAll('#apple-calendars-list input[type="checkbox"]');
      checkboxes.forEach(checkbox => checkbox.checked = true);
    }

    function deselectAllAppleCalendars() {
      const checkboxes = document.querySelectorAll('#apple-calendars-list input[type="checkbox"]');
      checkboxes.forEach(checkbox => checkbox.checked = false);
    }

    async function confirmAppleCalendarSelection() {
      const checkboxes = document.querySelectorAll('#apple-calendars-list input[type="checkbox"]:checked');
      const selectedCalendars = Array.from(checkboxes).map(cb => cb.value);
      
      // Allow saving even if no calendars are selected (in case of connection issues)
      if (selectedCalendars.length === 0) {
        console.log('[DEBUG] No calendars selected, but proceeding with empty selection');
      }
      
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      
      try {
        const res = await fetch(`${API_URL}/integrations/apple/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ selectedCalendars }),
        });
        
        if (res.ok) {
          showNotification(`Selected ${selectedCalendars.length} calendar(s)`);
          closeAppleCalendarSelectionModal();
          closeConnectAppleModal();
          updateAppleCalendarButton();
        } else {
          showNotification('Failed to save calendar selection');
        }
      } catch (error) {
        console.error('Error saving calendar selection:', error);
        showNotification('Failed to save calendar selection');
      }
    }
    window.submitAppleConnect = submitAppleConnect;
    window.closeAppleCalendarSelectionModal = closeAppleCalendarSelectionModal;
    window.selectAllAppleCalendars = selectAllAppleCalendars;
    window.deselectAllAppleCalendars = deselectAllAppleCalendars;
    window.confirmAppleCalendarSelection = confirmAppleCalendarSelection;

    function openDisconnectAppleModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('disconnect-apple-modal').classList.remove('hidden');
    }
    function closeDisconnectAppleModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('disconnect-apple-modal').classList.add('hidden');
    }
    async function confirmDisconnectApple() {
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      const res = await fetch(`${API_URL}/integrations/apple/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clean}` },
      });
      if (res.ok) {
        showNotification('Apple Calendar disconnected');
        updateAppleCalendarButton();
        closeDisconnectAppleModal();
      } else {
        showNotification('Failed to disconnect Apple Calendar');
      }
    }
    window.submitAppleConnect = submitAppleConnect;
    window.confirmDisconnectApple = confirmDisconnectApple;

    function openDisconnectAppleModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('disconnect-apple-modal').classList.remove('hidden');
    }
    function closeDisconnectAppleModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('disconnect-apple-modal').classList.add('hidden');
    }
    async function confirmDisconnectApple() {
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      const res = await fetch(`${API_URL}/integrations/apple/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clean}` },
      });
      if (res.ok) {
        showNotification('Apple Calendar disconnected');
        updateAppleCalendarButton();
        closeDisconnectAppleModal();
      } else {
        showNotification('Failed to disconnect Apple Calendar');
      }
    }
    window.submitAppleConnect = submitAppleConnect;
    window.confirmDisconnectApple = confirmDisconnectApple;

    // Number input increment/decrement functions
    function incrementNumber(inputId) {
      const input = document.getElementById(inputId);
      const currentValue = parseInt(input.value) || 0;
      const max = parseInt(input.max) || 999;
      if (currentValue < max) {
        input.value = currentValue + 1;
        input.dispatchEvent(new Event('change'));
      }
    }

    function decrementNumber(inputId) {
      const input = document.getElementById(inputId);
      const currentValue = parseInt(input.value) || 0;
      const min = parseInt(input.min) || 0;
      if (currentValue > min) {
        input.value = currentValue - 1;
        input.dispatchEvent(new Event('change'));
      }
    }

    // Question management functions
    let questionCounter = 0;
    let currentQuestionContainer = 'questions-container';

    function openAddQuestionModal() {
      console.log('openAddQuestionModal called');
      currentQuestionContainer = 'questions-container';
      resetAddQuestionModal();
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('add-question-modal').classList.remove('hidden');
      console.log('Modal should be visible now');
    }

    function openAddEditQuestionModal() {
      console.log('openAddEditQuestionModal called');
      currentQuestionContainer = 'edit-questions-container';
      resetAddQuestionModal();
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('add-question-modal').classList.remove('hidden');
      console.log('Modal should be visible now');
    }

    function closeAddQuestionModal() {
      document.getElementById('add-question-modal').classList.add('hidden');
      // Only hide backdrop if no other modals are open
      const profileModal = document.getElementById('profile-modal');
      const createModal = document.getElementById('create-event-type-modal');
      const editModal = document.getElementById('edit-event-type-modal');
      
      if ((!profileModal || profileModal.classList.contains('hidden')) &&
          (!createModal || createModal.classList.contains('hidden')) &&
          (!editModal || editModal.classList.contains('hidden'))) {
        document.getElementById('modal-backdrop').classList.add('hidden');
      }
    }

    function resetAddQuestionModal() {
      // Reset radio buttons
      document.querySelectorAll('input[name="question-type"]').forEach(radio => {
        radio.checked = false;
      });
      
      // Hide custom question input
      document.getElementById('custom-question-input').classList.add('hidden');
      
      // Reset custom question text
      document.getElementById('custom-question-text').value = '';
      
      // Reset required checkbox
      document.getElementById('question-required').checked = false;
    }

    function slugifyKeyForQuestion(label) {
      return (label || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 64);
    }

    function addQuestion(containerId = 'questions-container', questionData = null) {
      const container = document.getElementById(containerId);
      const questionId = `question_${questionCounter++}`;
      
      const questionDiv = document.createElement('div');
      questionDiv.className = 'bg-[#19342e] border border-[#2C4A43] rounded-lg p-4';
      questionDiv.id = `question_div_${questionId}`;
      
      const initialText = questionData ? questionData.text : 'Question';
      const initialKey = slugifyKeyForQuestion(initialText);
      questionDiv.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex-1 mr-3">
            <input type="text" 
                   id="question_text_${questionId}" 
                   class="w-full bg-[#1A2E29] border border-[#2C4A43] rounded px-3 py-2 text-[#E0E0E0] placeholder-[#A3B3AF] focus:border-[#34D399] focus:outline-none" 
                   value="${initialText}" 
                   placeholder="Enter your question">
            <div class="mt-2 text-xs text-[#A3B3AF] flex items-center gap-2">
              <span>Key:</span>
              <code id="question_key_${questionId}" class="px-2 py-0.5 rounded bg-[#10231f] border border-[#2C4A43] text-[#E0E0E0]">booking.answers.${initialKey}</code>
              <button type="button" class="text-[#34D399] hover:text-[#A3B3AF]" onclick="copyQuestionKey('${questionId}')" title="Copy key">
                <span class="material-icons-outlined" style="font-size:16px">content_copy</span>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" onclick="moveQuestionUp('${questionId}')" class="text-[#A3B3AF] hover:text-[#34D399] transition-colors" title="Move up">
              <span class="material-icons-outlined text-lg">keyboard_arrow_up</span>
            </button>
            <button type="button" onclick="moveQuestionDown('${questionId}')" class="text-[#A3B3AF] hover:text-[#34D399] transition-colors" title="Move down">
              <span class="material-icons-outlined text-lg">keyboard_arrow_down</span>
            </button>
          <button type="button" onclick="removeQuestion('${questionId}')" class="text-red-400 hover:text-red-300 transition-colors">
            <span class="material-icons-outlined text-lg">delete</span>
          </button>
          </div>
        </div>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="question_required_${questionId}" class="w-4 h-4 text-[#34D399] bg-[#1A2E29] border-[#2C4A43] rounded focus:ring-[#34D399] focus:ring-2" ${questionData && questionData.required ? 'checked' : ''}>
              <span class="text-[#E0E0E0] text-sm">Required</span>
            </label>
          </div>
        </div>
      `;
      
      container.appendChild(questionDiv);

      // Live-update the computed key on text change
      const textInput = document.getElementById(`question_text_${questionId}`);
      textInput.addEventListener('input', () => updateQuestionKeyDisplay(questionId));
    }

    function updateQuestionKeyDisplay(questionId) {
      const textInput = document.getElementById(`question_text_${questionId}`);
      const keyEl = document.getElementById(`question_key_${questionId}`);
      if (!textInput || !keyEl) return;
      const key = slugifyKeyForQuestion(textInput.value || '');
      keyEl.textContent = `booking.answers.${key}`;
    }

    async function copyQuestionKey(questionId) {
      try {
        const keyEl = document.getElementById(`question_key_${questionId}`);
        if (!keyEl) return;
        await navigator.clipboard.writeText(keyEl.textContent);
        showNotification('Key copied');
      } catch (e) {
        console.warn('Copy failed', e);
        showNotification('Failed to copy key', 'error');
      }
    }

    function moveQuestionUp(questionId) {
      const questionDiv = document.getElementById(`question_div_${questionId}`);
      if (!questionDiv) return;
      
      const previousSibling = questionDiv.previousElementSibling;
      if (previousSibling && previousSibling.id.startsWith('question_div_')) {
        questionDiv.parentNode.insertBefore(questionDiv, previousSibling);
      }
    }

    function moveQuestionDown(questionId) {
      const questionDiv = document.getElementById(`question_div_${questionId}`);
      if (!questionDiv) return;
      
      const nextSibling = questionDiv.nextElementSibling;
      if (nextSibling && nextSibling.id.startsWith('question_div_')) {
        questionDiv.parentNode.insertBefore(nextSibling, questionDiv);
      }
    }

    function removeRequiredQuestionByText(containerId, questionText) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      const questionDivs = container.querySelectorAll('[id^="question_div_question_"]');
      for (const div of questionDivs) {
        const questionId = div.id.replace('question_div_', '');
        const textInput = document.getElementById(`question_text_${questionId}`);
        const requiredCheckbox = document.getElementById(`question_required_${questionId}`);
        
        if (textInput && requiredCheckbox && requiredCheckbox.checked && textInput.value.trim() === questionText) {
          div.remove();
          break;
        }
      }
    }

    function removeQuestion(questionId) {
      const questionDiv = document.getElementById(`question_div_${questionId}`);
      if (!questionDiv) return;
      
      // Check if this is a required question that can't be deleted
      const textInput = document.getElementById(`question_text_${questionId}`);
      const requiredCheckbox = document.getElementById(`question_required_${questionId}`);
      
      if (textInput && requiredCheckbox && requiredCheckbox.checked) {
        const questionText = textInput.value.trim();
        
        // Check if this is an email question and Zoom/Google Meet is still selected
        if (questionText === 'What is your email address?' || questionText.includes('email')) {
          const zoomChecked = document.getElementById('loc-zoom')?.checked || document.getElementById('edit-loc-zoom')?.checked;
          const meetChecked = document.getElementById('loc-google-meet')?.checked || document.getElementById('edit-loc-google-meet')?.checked;
          
          if (zoomChecked || meetChecked) {
            showNotification('Cannot delete email question while Zoom or Google Meet is selected. Please deselect these locations first.');
            return;
          }
        }
        
        // Check if this is a phone question and phone is still selected
        if (questionText === 'What is your phone number?' || questionText.includes('phone')) {
          const phoneChecked = document.getElementById('loc-phone')?.checked || document.getElementById('edit-loc-phone')?.checked;
          
          if (phoneChecked) {
            showNotification('Cannot delete phone question while phone location is selected. Please deselect phone location first.');
            return;
          }
        }
      }
      
      // If we get here, it's safe to delete the question
      questionDiv.remove();
    }

    function getQuestionsData(containerId) {
      const container = document.getElementById(containerId);
      const questions = [];
      
      // Get all question divs
      const questionDivs = container.querySelectorAll('[id^="question_div_question_"]');
      
      questionDivs.forEach(div => {
        const questionId = div.id.replace('question_div_', '');
        const textInput = document.getElementById(`question_text_${questionId}`);
        const requiredCheckbox = document.getElementById(`question_required_${questionId}`);
        
        if (textInput && textInput.value.trim()) {
          questions.push({
            text: textInput.value.trim(),
            required: requiredCheckbox ? requiredCheckbox.checked : false
          });
        }
      });
      
      return questions;
    }

    function loadQuestionsData(containerId, questions) {
      const container = document.getElementById(containerId);
      container.innerHTML = ''; // Clear existing questions
      
      if (questions && questions.length > 0) {
        questions.forEach(question => {
          addQuestion(containerId, question);
        });
      }
    }

    function confirmAddQuestion() {
      const selectedType = document.querySelector('input[name="question-type"]:checked');
      if (!selectedType) {
        showNotification('Please select a question type');
        return;
      }

      const isRequired = document.getElementById('question-required').checked;
      let questionText = '';

      if (selectedType.value === 'custom') {
        questionText = document.getElementById('custom-question-text').value.trim();
        if (!questionText) {
          showNotification('Please enter a custom question');
          return;
        }
      } else {
        // Pre-made questions
        const questionMap = {
          'name': 'What is your full name?',
          'email': 'What is your email address?',
          'phone': 'What is your phone number?',
          'company': 'What company do you work for?'
        };
        questionText = questionMap[selectedType.value];
      }

      // Add the question to the current container
      addQuestion(currentQuestionContainer, {
        text: questionText,
        required: isRequired
      });

      closeAddQuestionModal();
    }

    // Event listener for question type selection
    document.addEventListener('DOMContentLoaded', function() {
      const questionTypeRadios = document.querySelectorAll('input[name="question-type"]');
      questionTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
          const customInput = document.getElementById('custom-question-input');
          if (this.value === 'custom') {
            customInput.classList.remove('hidden');
          } else {
            customInput.classList.add('hidden');
          }
        });
      });
    });

    // Function to clear all localStorage data except authentication tokens and tab memory (for debugging)
    window.clearAllLocalStorage = function() {
      console.log('🗑️ Clearing all localStorage data except auth tokens and tab memory...');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('calendarify-') && 
            key !== 'calendarify-token' && 
            key !== 'calendarify-current-section' && 
            key !== 'calendarify-meetings-tab') {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`Removed: ${key}`);
      });
      console.log('✅ All localStorage data cleared (auth tokens and tab memory preserved)');
    };

    // Function to manually clear tab memory (for testing)
    window.clearTabMemoryOnly = function() {
      console.log('🗑️ Clearing ONLY tab memory...');
      localStorage.removeItem('calendarify-current-section');
      localStorage.removeItem('calendarify-meetings-tab');
      console.log('✅ Tab memory cleared. Refresh the page to see the default section.');
    };

    // Function to check authentication status (for debugging)
    window.checkAuthStatus = function() {
      console.log('🔐 Checking authentication status...');
      const sessionToken = sessionStorage.getItem('calendarify-token');
      const persistentToken = localStorage.getItem('calendarify-token');
      
      console.log('Session token:', sessionToken ? 'Present' : 'None');
      console.log('Persistent token:', persistentToken ? 'Present' : 'None');
      
      if (sessionToken || persistentToken) {
        console.log('✅ User is authenticated');
        return true;
      } else {
        console.log('❌ User is not authenticated');
        return false;
      }
    };

    // Function to check tab memory status (for debugging)
    window.checkTabMemory = function() {
      console.log('📋 Checking tab memory status...');
      const currentSection = getCurrentSection();
      const meetingsTab = getMeetingsTab();
      
      console.log('Current section:', currentSection);
      console.log('Meetings tab:', meetingsTab);
      
      return { currentSection, meetingsTab };
    };

    // Function to manually set current section (for testing)
    window.setCurrentSection = function(section) {
      console.log(`🔧 Manually setting current section to: ${section}`);
      saveCurrentSection(section);
      console.log('✅ Section saved. Refresh the page to see the change.');
    };

    // Function to test section switching (for debugging)
    window.testSectionSwitch = function(section) {
      console.log(`🧪 Testing section switch to: ${section}`);
      const sectionEl = document.querySelector(`[onclick*="showSection('${section}', this)"]`);
      if (sectionEl) {
        console.log(`Found section element:`, sectionEl);
        showSection(section, sectionEl);
      } else {
        console.log(`❌ Could not find section element for: ${section}`);
      }
    };

    // Function to test tab memory (for debugging)
    window.testTabMemory = function() {
      console.log('🧪 Testing tab memory...');
      console.log('1. Current localStorage:', {
        'calendarify-current-section': localStorage.getItem('calendarify-current-section'),
        'calendarify-meetings-tab': localStorage.getItem('calendarify-meetings-tab')
      });
      
      console.log('2. Switching to availability...');
      testSectionSwitch('availability');
      
      setTimeout(() => {
        console.log('3. After switch, localStorage:', {
          'calendarify-current-section': localStorage.getItem('calendarify-current-section'),
          'calendarify-meetings-tab': localStorage.getItem('calendarify-meetings-tab')
        });
        console.log('4. Now refresh the page to test if it remembers!');
      }, 1000);
    };

    // Function to clear tab memory (for testing)
    window.clearTabMemory = function() {
      console.log('🗑️ Clearing tab memory...');
      localStorage.removeItem('calendarify-current-section');
      localStorage.removeItem('calendarify-meetings-tab');
      console.log('✅ Tab memory cleared. Refresh the page to see the default section.');
    };

    // Initialize dashboard with fresh data (preserving auth tokens and tab memory)
    async function initializeDashboard() {
      console.log('🚀 Initializing dashboard with fresh data...');
      
      // Get saved section BEFORE clearing localStorage
      const savedSection = getCurrentSection();
      const savedMeetingsTab = getMeetingsTab();
      
      console.log(`📋 Saved section: ${savedSection}, saved meetings tab: ${savedMeetingsTab}`);
      
      // Load fresh data from server
      await loadState();
      await fetchEventTypesFromServer();
      await fetchContactsFromServer();
      await fetchWorkflowsFromServer();
      await fetchTagsFromServer();
      await fetchMeetingsFromServer();
      
      // Render initial sections
      renderEventTypes();
      renderContacts();
      renderWorkflows();
      
      // Restore saved section and tab
      console.log(`🔍 Looking for section element: [onclick*="showSection('${savedSection}', this)"]`);
      const savedSectionEl = document.querySelector(`[onclick*="showSection('${savedSection}', this)"]`);
      console.log(`🔍 Found element:`, savedSectionEl);
      
      if (savedSectionEl) {
        console.log(`🔄 Restoring saved section: ${savedSection}`);
        showSection(savedSection, savedSectionEl);
      } else {
        console.log('🔄 No saved section found, defaulting to event-types');
        const defaultSectionEl = document.querySelector('[onclick*="showSection(\'event-types\', this)"]');
        console.log(`🔍 Default element found:`, defaultSectionEl);
        if (defaultSectionEl) {
          showSection('event-types', defaultSectionEl);
        }
      }
      
      // Also try alternative selector method
      setTimeout(() => {
        console.log('🔄 Trying alternative selector method...');
        const altSavedSectionEl = document.querySelector(`[data-section="${savedSection}"]`);
        console.log(`🔍 Alternative element found:`, altSavedSectionEl);
        if (altSavedSectionEl && !document.querySelector('.nav-item.active')) {
          console.log(`🔄 Restoring saved section via alternative method: ${savedSection}`);
          showSection(savedSection, altSavedSectionEl);
        }
      }, 100);
      
      console.log('✅ Dashboard initialized with fresh data (auth and tab memory preserved)');
    }

    // Initialize when page loads
    document.addEventListener('DOMContentLoaded', function() {
      console.log('🔍 DOM Content Loaded - Debug Info:');
      console.log('Current localStorage before init:', {
        'calendarify-current-section': localStorage.getItem('calendarify-current-section'),
        'calendarify-meetings-tab': localStorage.getItem('calendarify-meetings-tab'),
        'calendarify-token': localStorage.getItem('calendarify-token') ? 'Present' : 'None'
      });
      
      initializeDashboard();
    });

    // Helper function to convert UTC minutes back to local minutes
    function convertUTCMinutesToLocalTime(utcMinutes) {
      const timezoneOffset = new Date().getTimezoneOffset(); // minutes (negative means local is ahead of UTC)
      const localMinutes = utcMinutes - timezoneOffset; // Subtract offset to convert UTC to local
      
      // Handle day wrapping
      if (localMinutes < 0) {
        return localMinutes + 1440;
      } else if (localMinutes >= 1440) {
        return localMinutes - 1440;
      }
      
      return localMinutes;
    }

    // Helper function to convert local time to UTC minutes
