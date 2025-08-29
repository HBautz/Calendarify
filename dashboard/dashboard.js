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
              status: 'Confirmed'
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
      } else if (section === 'workflows') {
        await fetchWorkflowsFromServer();
        renderWorkflows();
      } else if (section === 'integrations') {
        setTimeout(() => {
          updateGoogleCalendarButton();
          updateZoomButton();
          updateOutlookCalendarButton();
          updateAppleCalendarButton();
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
      
      // Sort meetings by date (newest first)
      const sortedMeetings = meetings.sort((a, b) => {
        const dateA = new Date(a.start);
        const dateB = new Date(b.start);
        return dateB - dateA; // Newest first (descending order)
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
        <tr class="table-row" id="meeting-${meeting.id}">
          <td class="py-2">
            <div class="flex items-center gap-2 justify-center">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(meeting.invitee)}&amp;background=34D399&amp;color=1A2E29" alt="${meeting.invitee}" class="w-8 h-8 rounded-full">
              <div>
                <div class="text-white font-medium">${meeting.invitee}</div>
                <div class="text-[#A3B3AF] text-sm">${meeting.email}</div>
              </div>
            </div>
          </td>
          <td class="py-2 text-center">${meeting.eventType}</td>
          <td class="py-2 text-center">${displayDate}</td>
          <td class="py-2 text-center"><span class="${badgeClass}">${meeting.status}</span></td>
          <td class="py-2 text-center">
            <div class="relative inline-block text-left">
              <button class="kebab-btn flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#223c36] transition-colors" type="button" onclick="toggleMeetingMenu(this)">
                <span class="material-icons-outlined">more_vert</span>
              </button>
              <div class="meeting-menu absolute bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg">
                <button class="w-full flex items-center gap-2 px-4 py-2 text-[#34D399] hover:bg-[#223c36] text-sm font-semibold" onclick="joinMeeting('${meeting.id}')">
                  <span class="material-icons-outlined text-xs">video_call</span>Join
                </button>
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

    function openCreateEventTypeModal() {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('create-event-type-modal').classList.remove('hidden');
      document.getElementById('create-menu').classList.add('hidden');
    }

    function closeCreateEventTypeModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('create-event-type-modal').classList.add('hidden');
      // Clear questions container
      document.getElementById('questions-container').innerHTML = '';
      questionCounter = 0;
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
      const name = document.getElementById('event-type-name').value.trim();
      const duration = document.getElementById('event-type-duration').value;
      const description = document.getElementById('event-type-description').value.trim();
      const location = document.getElementById('event-type-location').value;
      const customLocation = document.getElementById('event-type-custom-location').value.trim();
      const link = document.getElementById('event-type-link').value.trim();
      const color = document.getElementById('event-type-color').value;
      // Handle buffer times with new structure
      const bufferBeforeValue = parseInt(document.getElementById('event-type-buffer-before-value').value) || 0;
      const bufferBeforeUnit = document.getElementById('event-type-buffer-before-unit').value;
      const bufferBefore = bufferBeforeUnit === 'hours' ? bufferBeforeValue * 60 : bufferBeforeValue;
      
      const bufferAfterValue = parseInt(document.getElementById('event-type-buffer-after-value').value) || 0;
      const bufferAfterUnit = document.getElementById('event-type-buffer-after-unit').value;
      const bufferAfter = bufferAfterUnit === 'hours' ? bufferAfterValue * 60 : bufferAfterValue;
      
      // Handle advance notice with new structure
      const advanceNoticeValue = parseInt(document.getElementById('event-type-advance-notice-value').value) || 0;
      const advanceNoticeUnit = document.getElementById('event-type-advance-notice-unit').value;
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
      const bookingLimitValue = parseInt(document.getElementById('event-type-booking-limit-value').value) || 0;
      const bookingLimitUnit = document.getElementById('event-type-booking-limit-unit').value;
      let bookingLimit = 0;
      
      if (bookingLimitUnit === 'per_day') {
        bookingLimit = { count: bookingLimitValue, period: 'day' };
      } else if (bookingLimitUnit === 'per_week') {
        bookingLimit = { count: bookingLimitValue, period: 'week' };
      } else if (bookingLimitUnit === '0') {
        bookingLimit = 0; // No limit
      }
      const confirmationMessage = document.getElementById('event-type-confirmation-message').value.trim();
      const questions = getQuestionsData('questions-container');
      const availability = document.getElementById('event-type-availability').checked;
      const reminders = document.getElementById('event-type-reminders').checked;
      const followUp = document.getElementById('event-type-follow-up').checked;

      const rescheduleNotification = document.getElementById('event-type-reschedule-notification').checked;
      const secret = document.getElementById('event-type-secret').value;
      const priority = document.getElementById('event-type-priority').value;
      const tags = document.getElementById('event-type-tags').value.trim();

      if (!name) {
        showNotification('Event type name is required');
        return;
      }
      if (!duration) {
        showNotification('Duration is required');
        return;
      }
      if (!location) {
        showNotification('Location is required');
        return;
      }
      if (location !== 'office' && location !== 'custom' && !link) {
        showNotification('Meeting link is required');
        return;
      }
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
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
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
              location,
              customLocation: location === 'custom' ? customLocation : '',
              link: location !== 'office' ? link : '',
              color,
              visibility: secret,
              priority,
              tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
              notifications: {
                availability,
                reminders,
                followUp,
                reschedule: rescheduleNotification
              }
            };
            
            // Save to UserState
            await fetch(`${API_URL}/users/me/state`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
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
            showNotification('Failed to create event type');
          }
        }
      } catch (e) {
        console.error('Failed to save event type to server', e);
        showNotification('Failed to create event type');
      }
    }

    // Interactive form functionality

    function handleLocationChange() {
      const location = document.getElementById('event-type-location').value;
      const customLocationContainer = document.getElementById('custom-location-container');
      const meetingLinkContainer = document.getElementById('meeting-link-container');
      
      if (location === 'custom') {
        customLocationContainer.style.display = 'block';
        meetingLinkContainer.style.display = 'none';
      } else if (location === 'office') {
        customLocationContainer.style.display = 'none';
        meetingLinkContainer.style.display = 'none';
      } else {
        customLocationContainer.style.display = 'none';
        meetingLinkContainer.style.display = 'block';
      }
    }



    // Add event listeners for interactive form elements
    document.addEventListener('DOMContentLoaded', function() {
      
      // Add event listeners for form interactions
      const locationSelect = document.getElementById('event-type-location');
      
      if (locationSelect) {
        locationSelect.addEventListener('change', handleLocationChange);
      }
    });

    function renderEventTypes() {
      const eventTypesGrid = document.getElementById('event-types-grid');
      let eventTypes = freshEventTypes || [];

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
      
      eventTypesGrid.innerHTML = html;
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

    function editEventType(id) {
      const eventType = freshEventTypes.find(eventType => eventType.id === id);
      
      if (eventType) {
        // Store the event type being edited
        window.editingEventType = eventType;
        
        // Populate the form with existing data
        populateEditForm(eventType);
        
        // Show the edit modal
        document.getElementById('modal-backdrop').classList.remove('hidden');
        document.getElementById('edit-event-type-modal').classList.remove('hidden');
      }
    }

    function populateEditForm(eventType) {
      // Basic Information
      document.getElementById('edit-event-type-name').value = eventType.title || eventType.name || '';
      document.getElementById('edit-event-type-duration').value = eventType.duration;
      document.getElementById('edit-event-type-description').value = eventType.description || '';
      document.getElementById('edit-event-type-location').value = eventType.location || 'zoom';
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
      
      // Notifications
      document.getElementById('edit-event-type-availability').checked = eventType.notifications?.availability !== false;
      document.getElementById('edit-event-type-reminders').checked = eventType.notifications?.reminders !== false;
      document.getElementById('edit-event-type-follow-up').checked = eventType.notifications?.followUp === true;

      document.getElementById('edit-event-type-reschedule-notification').checked = eventType.notifications?.reschedule !== false;
      
      // Advanced Settings
      document.getElementById('edit-event-type-secret').value = eventType.visibility;
      document.getElementById('edit-event-type-priority').value = eventType.priority;
      document.getElementById('edit-event-type-tags').value = eventType.tags ? eventType.tags.join(', ') : '';
      
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
      const location = document.getElementById('edit-event-type-location').value;
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
      const availability = document.getElementById('edit-event-type-availability').checked;
      const reminders = document.getElementById('edit-event-type-reminders').checked;
      const followUp = document.getElementById('edit-event-type-follow-up').checked;

      const rescheduleNotification = document.getElementById('edit-event-type-reschedule-notification').checked;
      const secret = document.getElementById('edit-event-type-secret').value;
      const priority = document.getElementById('edit-event-type-priority').value;
      const tags = document.getElementById('edit-event-type-tags').value.trim();

      if (!name) {
        showNotification('Event type name is required');
        return;
      }
      if (!duration) {
        showNotification('Duration is required');
        return;
      }
      if (!location) {
        showNotification('Location is required');
        return;
      }
      if (location !== "office" && location !== "custom" && !link) {
        showNotification('Meeting link is required');
        return;
      }
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
              location,
              customLocation: location === 'custom' ? customLocation : '',
              link: location !== 'office' ? link : '',
              color,
              visibility: secret,
              priority,
              tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
              notifications: {
                availability,
                reminders,
                followUp,
                reschedule: rescheduleNotification
              }
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
      const location = document.getElementById('edit-event-type-location').value;
      const customLocationContainer = document.getElementById('edit-custom-location-container');
      const meetingLinkContainer = document.getElementById('edit-meeting-link-container');
      
      if (location === 'custom') {
        customLocationContainer.style.display = 'block';
        meetingLinkContainer.style.display = 'none';
      } else if (location === 'office') {
        customLocationContainer.style.display = 'none';
        meetingLinkContainer.style.display = 'none';
      } else {
        customLocationContainer.style.display = 'none';
        meetingLinkContainer.style.display = 'block';
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
      // Toggle this one
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle('open');
    }
    
    // Contact actions
    function viewContact(email) {
      showNotification(`Viewing contact: ${email}`);
      // Here you would typically open a modal or navigate to contact details
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

    function confirmDeleteContact() {
      const email = window.contactToDelete;
      if (email) {
        let contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
        const contact = contacts.find(c => c.email === email);
        if (contact) {
          const token = getAnyToken();
          const clean = token ? token.replace(/^"|"$/g, '') : '';
          fetch(`${API_URL}/contacts/${contact.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clean}` } });
          contacts = contacts.filter(c => c.email !== email);
          localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
          const row = document.getElementById(`contact-${email}`);
          if (row) row.remove();
          showNotification(`Contact removed: ${email}`);
        }
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
          const id = 'tag-option-' + tag.replace(/\s+/g, '-');
          container.innerHTML += `<label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="${tag}" class="w-4 h-4 text-[#34D399] bg-[#19342e] border-[#2C4A43] rounded focus:ring-[#34D399] focus:ring-2">
              <span class="text-[#E0E0E0] text-sm">${tag}</span>
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
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 bg-[#19342e] border border-[#2C4A43] rounded-lg hover:border-[#34D399] transition-colors';
            item.innerHTML = `
              <div class="flex items-center gap-3">
                <span class="material-icons-outlined text-[#34D399]">local_offer</span>
                <span class="text-[#E0E0E0] font-medium">${tag}</span>
              </div>
              <button onclick="removeTag('${tag}')" class="p-1 text-[#A3B3AF] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Remove tag">
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
      
      // Get all available tags from localStorage
      const allTags = JSON.parse(localStorage.getItem('calendarify-tags') || '[]');
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
        const contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
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

        if (!contact.tags) contact.tags = [];
        if (!contact.tags.includes(tagName)) contact.tags.push(tagName);
        localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
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
        const contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
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

        if (contact.tags && contact.tags.includes(tagName)) {
          contact.tags = contact.tags.filter(tag => tag !== tagName);
          localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
          showNotification(`Tag "${tagName}" removed from ${contact.name}`);
          await renderContacts();
          await showContactTagsModal(contactEmail);
        } else {
          showNotification(`Tag "${tagName}" is not assigned to ${contact.name}`);
        }
      } catch (error) {
        console.error('Error removing tag from contact:', error);
        showNotification('Failed to remove tag from contact');
      }
    }

    function addContactRow(contact) {
      const tbody = document.querySelector('#contacts-section tbody');
      if (!tbody) return;
      
      let tagsHtml = '';
      if (!contact.tags || contact.tags.length === 0) {
        tagsHtml = '<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal(\'' + contact.email + '\')">No Tags</span>';
      } else if (contact.tags.length <= 2) {
        tagsHtml = contact.tags.map(t => `<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal('${contact.email}')">${t}</span>`).join('');
      } else {
        tagsHtml = `<span class="bg-[#19342e] text-[#A3B3AF] px-2 py-1 rounded text-xs cursor-pointer hover:bg-[#2C4A43] hover:text-[#34D399] transition-colors" onclick="showContactTagsModal('${contact.email}')">${contact.tags.length} Tags</span>`;
      }
      const row = document.createElement('tr');
      row.className = 'table-row';
      row.id = `contact-${contact.email}`;
      row.innerHTML = `
        <td class="py-2 text-center">
          <button class="favorite-btn ${contact.favorite ? 'text-[#34D399]' : 'text-[#A3B3AF]'} hover:text-[#34D399] transition-colors" onclick="toggleFavorite('${contact.email}', this)">
            <span class="material-icons-outlined text-xl">${contact.favorite ? 'star' : 'star_border'}</span>
          </button>
        </td>
        <td class="py-2 text-center">${contact.name}</td>
        <td class="py-2 text-center">${contact.email}</td>
        <td class="py-2 text-center"><div class="flex flex-wrap gap-1 justify-center">${tagsHtml}</div></td>
        <td class="py-2 text-center">
          <div class="flex gap-2 justify-center">
            <button class="btn-secondary" onclick="viewContact('${contact.email}')">View</button>
            <div class="relative inline-block text-left">
              <button class="kebab-btn flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#223c36] transition-colors" type="button" onclick="toggleContactMenu(this)">
                <span class="material-icons-outlined">more_vert</span>
              </button>
              <div class="contact-menu absolute bg-[#1E3A34] border border-[#2C4A43] rounded-lg shadow-lg z-50">
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
      const id = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId;
      const meeting = getMeetingsData('upcoming').find(m => m.id === id) || 
                     getMeetingsData('past').find(m => m.id === id) ||
                     getMeetingsData('pending').find(m => m.id === id);
      
      if (meeting) {
        showNotification(`Joining meeting with ${meeting.invitee}`);
        // Here you would typically open the meeting link or video call
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
      const email = document.getElementById('apple-email').value.trim();
      const password = document.getElementById('apple-password').value.trim();
      if (!email || !password) {
        showNotification('Email and password required');
        return;
      }
      const token = getAnyToken();
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      const res = await fetch(`${API_URL}/integrations/apple/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        showNotification('Apple Calendar connected');
        updateAppleCalendarButton();
        closeConnectAppleModal();
      } else if (res.status === 400) {
        showNotification('Invalid Apple credentials');
      } else if (res.status === 503) {
        showNotification('Unable to reach Apple Calendar');
      } else {
        showNotification('Failed to connect Apple Calendar');
      }
    }
    window.submitAppleConnect = submitAppleConnect;

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

    function addQuestion(containerId = 'questions-container', questionData = null) {
      const container = document.getElementById(containerId);
      const questionId = `question_${questionCounter++}`;
      
      const questionDiv = document.createElement('div');
      questionDiv.className = 'bg-[#19342e] border border-[#2C4A43] rounded-lg p-4';
      questionDiv.id = `question_div_${questionId}`;
      
      questionDiv.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-[#E0E0E0] font-medium">${questionData ? questionData.text : 'Question'}</h4>
          <button type="button" onclick="removeQuestion('${questionId}')" class="text-red-400 hover:text-red-300 transition-colors">
            <span class="material-icons-outlined text-lg">delete</span>
          </button>
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
    }

    function removeQuestion(questionId) {
      const questionDiv = document.getElementById(`question_div_${questionId}`);
      if (questionDiv) {
        questionDiv.remove();
      }
    }

    function getQuestionsData(containerId) {
      const container = document.getElementById(containerId);
      const questions = [];
      
      // Get all question divs
      const questionDivs = container.querySelectorAll('[id^="question_div_question_"]');
      
      questionDivs.forEach(div => {
        const questionId = div.id.replace('question_div_', '');
        const titleElement = div.querySelector('h4');
        const requiredCheckbox = document.getElementById(`question_required_${questionId}`);
        
        if (titleElement && titleElement.textContent.trim()) {
          questions.push({
            text: titleElement.textContent.trim(),
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