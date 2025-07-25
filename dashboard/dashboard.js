    window.API_URL = 'http://localhost:3001/api';
    if (!localStorage.getItem('calendarify-token')) {
      window.location.replace('/log-in');
    }

    async function loadState() {
      const token = localStorage.getItem("calendarify-token");
      if (!token) return;
      
      // Remove surrounding quotes if they exist
      const cleanToken = token.replace(/^"|"$/g, "");
      
      const res = await fetch(`${API_URL}/users/me/state`, {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        Object.entries(data).forEach(([k, v]) => {
          localStorage.setItem(k, JSON.stringify(v));
        });
        updateGoogleCalendarButton();
        updateZoomButton();
        updateOutlookCalendarButton();
        updateAppleCalendarButton();
      }
    }

    async function fetchTagsFromServer() {
      const token = localStorage.getItem('calendarify-token');
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/tags`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const tags = await res.json();
        const map = {};
        tags.forEach(t => (map[t.name] = t.id));
        localStorage.setItem('calendarify-tags', JSON.stringify(tags.map(t => t.name)));
        localStorage.setItem('calendarify-tag-map', JSON.stringify(map));
        return tags;
      }
      return [];
    }

    async function fetchWorkflowsFromServer() {
      const token = localStorage.getItem('calendarify-token');
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/workflows`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const wfs = await res.json();
        localStorage.setItem('calendarify-workflows', JSON.stringify(wfs));
        return wfs;
      }
      return [];
    }

    async function fetchContactsFromServer() {
      const token = localStorage.getItem('calendarify-token');
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const contacts = await res.json();
        localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
        return contacts;
      }
      return [];
    }

    async function fetchEventTypesFromServer() {
      const token = localStorage.getItem('calendarify-token');
      if (!token) return [];
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/event-types`, { headers: { Authorization: `Bearer ${clean}` } });
      if (res.ok) {
        const raw = await res.json();
        const eventTypes = raw.map(et => ({ ...et, name: et.title }));
        localStorage.setItem('calendarify-event-types', JSON.stringify(eventTypes));
        return eventTypes;
      }
      return [];
    }

    function collectState() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("calendarify-")) {
          try {
            data[key] = JSON.parse(localStorage.getItem(key));
          } catch {
            data[key] = localStorage.getItem(key);
          }
        }
      }
      return data;
    }

    async function syncState() {
      const token = localStorage.getItem("calendarify-token");
      if (!token) return;

      // Remove surrounding quotes if they exist
      const cleanToken = token.replace(/^"|"$/g, "");

      try {
        await fetch(`${API_URL}/users/me/state`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanToken}`,
          },
          body: JSON.stringify(collectState()),
        });
      } catch (e) {
        console.error('syncState error', e);
      }
    }


    const _setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v) {
      _setItem(k, v);
      if (k.startsWith('calendarify-')) syncState();
    };
    const _removeItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function(k) {
      _removeItem(k);
      if (k.startsWith('calendarify-')) syncState();
    };
    window.addEventListener('beforeunload', syncState);
    function showSection(section, el) {
      // Remove active class from all nav items
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      
      // Add active class to clicked item
      el.classList.add('active');
      
      // Save current section to localStorage
      localStorage.setItem('calendarify-current-section', section);
      
      // Update section title
      document.getElementById('section-title').textContent = el.textContent.trim();
      
      // Hide all sections
      document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
      
      // Show the selected section
      const secEl = document.getElementById(section + '-section');
      if (secEl) secEl.style.display = 'block';
      
      
      // Initialize section-specific functionality
      if (section === 'meetings') {
        // Check for saved meetings tab
        const savedTab = localStorage.getItem('calendarify-meetings-tab') || 'upcoming';
        const savedTabBtn = document.querySelector(`#meetings-section button[data-tab="${savedTab}"]`);
        showMeetingsTab(savedTab, savedTabBtn);
      } else if (section === 'availability') {
        initializeCalendar();
        restoreDayAvailability();
        restoreWeeklyHours();
      } else if (section === 'contacts') {
        renderContacts();
      } else if (section === 'integrations') {
        setTimeout(() => {
          updateGoogleCalendarButton();
          updateZoomButton();
          updateOutlookCalendarButton();
          updateAppleCalendarButton();
        }, 100); // Wait for tab to show
      }
    }

    // Meetings tab functionality
    function showMeetingsTab(tab, btn) {
      console.log('showMeetingsTab called with tab:', tab);
      
      // Save current tab to localStorage
      localStorage.setItem('calendarify-meetings-tab', tab);
      
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
      
      const meetings = getMeetingsData(tab);
      console.log('Meetings for tab', tab, ':', meetings);
      
      const tableHTML = meetings.map(meeting => {
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
          <td class="py-2 text-center">${meeting.date}</td>
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
    let meetingsData = {
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
    // Persist default meetings to localStorage if not present
    if (!localStorage.getItem('calendarify-meetings')) {
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
      const display = localStorage.getItem('calendarify-display-name') || 'user';
      navigator.clipboard.writeText(`${prefix}/booking/${encodeURIComponent(display)}/${slug}`);
      showNotification('Link copied to clipboard');
    }

    function openShareModal(title, slug) {
      const prefix = window.PREPEND_URL || window.FRONTEND_URL || window.location.origin;
      const display = localStorage.getItem('calendarify-display-name') || 'user';
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
    }

    function saveOverride() {
      if (!selectedDate) {
        showNotification('No date selected');
        return;
      }
      
      const dateString = selectedDate.toISOString().split('T')[0];
      const toggleButton = document.querySelector('#override-modal button[onclick="toggleOverrideAvailability(this)"]');
      const isAvailable = toggleButton.getAttribute('aria-pressed') === 'true';
      
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
      
      // Save override to localStorage
      calendarOverrides[dateString] = {
        available: isAvailable,
        timeSlots: timeSlots
      };
      
      localStorage.setItem('calendarify-overrides', JSON.stringify(calendarOverrides));
      syncState();
      
      // Update calendar display
      renderCalendar();
      updateOverrideList();
      
      showNotification('Override saved successfully');
      closeOverrideModal();
    }

    function confirmDeleteOverride() {
      if (!selectedDate) {
        showNotification('No date selected');
        return;
      }
      
      const dateString = selectedDate.toISOString().split('T')[0];
      
      // Remove override from localStorage
      delete calendarOverrides[dateString];
      localStorage.setItem('calendarify-overrides', JSON.stringify(calendarOverrides));
      syncState();
      
      // Update calendar display
      renderCalendar();
      updateOverrideList();
      
      showNotification('Override deleted successfully');
      closeDeleteConfirmModal();
    }

    function closeDeleteConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-override-confirm-modal').classList.add('hidden');
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
      const token = localStorage.getItem('calendarify-token');
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
          const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
      if (token) {
        try {
          const cleanToken = token.replace(/^"|"$/g, "");
          const res = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${cleanToken}` } });
          if (res.ok) {
            const data = await res.json();
            document.getElementById('profile-name').textContent = data.name || 'User';
            document.getElementById('profile-email').textContent = data.email || '';
            document.getElementById('profile-displayname').textContent = data.display_name || '';
            localStorage.setItem('calendarify-display-name', data.display_name || '');
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
      document.getElementById('change-displayname-input').value = localStorage.getItem('calendarify-display-name') || '';
      document.getElementById('change-displayname-modal').classList.remove('hidden');
      document.getElementById('modal-backdrop').classList.remove('hidden');
    }

    function closeChangeDisplayNameModal() {
      document.getElementById('change-displayname-modal').classList.add('hidden');
      document.getElementById('modal-backdrop').classList.add('hidden');
    }

    async function saveDisplayName() {
      const input = document.getElementById('change-displayname-input');
      const newName = input.value.trim();
      if (!newName) return;
      const token = localStorage.getItem('calendarify-token');
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
        body: JSON.stringify({ displayName: newName })
      });
      if (res.ok) {
        const data = await res.json();
        document.getElementById('profile-displayname').textContent = data.display_name;
        localStorage.setItem('calendarify-display-name', data.display_name);
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
      document.querySelectorAll('.hidden').forEach(el => {
        if (el.id === 'modal-backdrop' || el.id === 'share-modal' || el.id === 'delete-event-type-confirm-modal' || el.id === 'cancel-meeting-confirm-modal' || el.id === 'delete-meeting-confirm-modal' || el.id === 'add-contact-modal' || el.id === 'delete-workflow-confirm-modal' || el.id === 'delete-contact-confirm-modal' || el.id === 'event-types-modal' || el.id === 'create-tag-modal' || el.id === 'tags-modal' || el.id === 'profile-modal') {
          el.classList.add('hidden');
        }
      });
      // Reset backdrop z-index
      const backdrop = document.getElementById('modal-backdrop');
      backdrop.style.zIndex = '50';
      // Clear any stored data
      window.meetingToCancel = null;
      window.meetingToDelete = null;
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
    }

    function getClockFormat() {
      let stored = localStorage.getItem('calendarify-clock-format');
      if (!stored) {
        localStorage.setItem('calendarify-clock-format', '24h');
        return '24h';
      }
      return stored;
    }

    function setClockFormat(format) {
      localStorage.setItem('calendarify-clock-format', format);
    }

    function updateClockFormatUI() {
      const is12h = getClockFormat() === '12h';
      const toggle = document.getElementById('clock-format-toggle');
      const circle = document.getElementById('toggle-circle');
      if (toggle && circle) {
        toggle.setAttribute('aria-pressed', is12h ? 'true' : 'false');
        toggle.classList.toggle('bg-[#34D399]', is12h);
        toggle.classList.toggle('bg-[#19342e]', !is12h);
        circle.style.transform = is12h ? 'translateX(20px)' : 'translateX(0)';
        circle.style.backgroundColor = is12h ? '#fff' : '#34D399';
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

      updateClockFormatUI();
      updateAllCustomTimePickers();
      setupTimeInputListeners();
      fetchTagsFromServer();
      fetchWorkflowsFromServer();
      fetchContactsFromServer();
      await fetchEventTypesFromServer();
      renderEventTypes();
      renderWorkflows();

      const avatar = document.getElementById('profile-avatar');
      if (avatar) avatar.addEventListener('click', openProfileModal);
      
      // Check for redirect parameter
      const redirectTo = localStorage.getItem('calendarify-redirect-to');
      if (redirectTo) {
        localStorage.removeItem('calendarify-redirect-to');
        const targetNav = document.querySelector(`.nav-item[data-section="${redirectTo}"]`);
        if (targetNav) {
          showSection(redirectTo, targetNav);
          return;
        }
      }
      
      // Check for saved section preference
      const savedSection = localStorage.getItem('calendarify-current-section');
      if (savedSection) {
        const savedNav = document.querySelector(`.nav-item[data-section="${savedSection}"]`);
        if (savedNav) {
          showSection(savedSection, savedNav);
          return;
        }
      }
      
      // Remove all active classes from nav items
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      const defaultNav = document.querySelector('.nav-item[data-section="event-types"]');
      if (defaultNav) {
        showSection('event-types', defaultNav);
      }
    });

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
        const day = container.id.replace('-times', '');
        const inputs = container.querySelectorAll('input');
        const weekly = JSON.parse(localStorage.getItem('calendarify-weekly-hours') || '{}');
        weekly[day] = {
          start: inputs[0].value || inputs[0].placeholder,
          end: inputs[1].value || inputs[1].placeholder,
        };
        localStorage.setItem('calendarify-weekly-hours', JSON.stringify(weekly));
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
        let is12h = getClockFormat() === '12h';
        let [h, m, ap] = parseTimeString(val, !is12h);
        if (is12h) {
          // Convert 24h to 12h
          let hour = parseInt(h, 10);
          ap = hour >= 12 ? 'PM' : 'AM';
          hour = hour % 12 || 12;
          input.value = `${hour.toString().padStart(2, '0')}:${m} ${ap}`;
        } else {
          // Convert 12h to 24h
          let hour = parseInt(h, 10);
          if (ap === 'PM' && hour < 12) hour += 12;
          if (ap === 'AM' && hour === 12) hour = 0;
          input.value = `${hour.toString().padStart(2, '0')}:${m}`;
        }
      });
    }

    // Update all pickers on toggle
    const origToggleClockFormat = toggleClockFormat;
    toggleClockFormat = function() {
      origToggleClockFormat.apply(this, arguments);
      updateAllCustomTimePickers();
    };

    // Close dropdowns on outside click
    document.addEventListener('mousedown', function(e) {
      if (!e.target.closest('.custom-time-picker')) closeAllTimeDropdowns();
    });

    // --- Day Availability Toggle ---
    function toggleDayAvailability(day, button) {
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
      
      // Save day availability to localStorage
      let dayAvailability = JSON.parse(localStorage.getItem('calendarify-day-availability') || '{}');
      dayAvailability[day] = !isAvailable; // Toggle the state
      localStorage.setItem('calendarify-day-availability', JSON.stringify(dayAvailability));
      syncState();
    }

    // --- Calendar Override System ---
    let currentDate = new Date();
    let selectedDate = null;
    let calendarOverrides = JSON.parse(localStorage.getItem('calendarify-overrides') || '{}');

    function initializeCalendar() {
      renderCalendar();
      updateOverrideList();
    }

    function renderCalendar() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
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
        const hasOverride = calendarOverrides[dateString];
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        
        let dayClasses = 'calendar-day cursor-pointer';
        
        if (hasOverride) {
          dayClasses += ' active';
        } else if (isToday) {
          dayClasses += ' today';
        }
        
        calendarHTML += `<div class="${dayClasses}" onclick="selectDate('${dateString}')">${day}</div>`;
      }
      
      document.getElementById('calendar-days').innerHTML = calendarHTML;
    }

    function previousMonth() {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    }

    function nextMonth() {
      currentDate.setMonth(currentDate.getMonth() + 1);
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
      } else {
        resetOverrideForm();
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
      const dayAvailability = JSON.parse(localStorage.getItem('calendarify-day-availability') || '{}');
      
      Object.entries(dayAvailability).forEach(([day, isAvailable]) => {
        const button = document.querySelector(`button[onclick="toggleDayAvailability('${day}', this)"]`);
        if (button) {
          const currentState = button.getAttribute('aria-pressed') === 'true';
          if (currentState !== isAvailable) {
            // Only toggle if the current state doesn't match the saved state
            toggleDayAvailability(day, button);
          }
        }
      });
    }

    function restoreWeeklyHours() {
      const weekly = JSON.parse(localStorage.getItem('calendarify-weekly-hours') || '{}');
      Object.entries(weekly).forEach(([day, range]) => {
        const container = document.getElementById(day + '-times');
        if (container) {
          const inputs = container.querySelectorAll('input');
          if (inputs.length >= 2) {
            if (range.start) inputs[0].value = range.start;
            if (range.end) inputs[1].value = range.end;
          }
        }
      });
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
      const eventType = document.getElementById('event-type-type').value;
      const attendeeLimit = document.getElementById('event-type-attendee-limit').value;
      const description = document.getElementById('event-type-description').value.trim();
      const location = document.getElementById('event-type-location').value;
      const customLocation = document.getElementById('event-type-custom-location').value.trim();
      const link = document.getElementById('event-type-link').value.trim();
      const color = document.getElementById('event-type-color').value;
      const bufferBefore = document.getElementById('event-type-buffer-before').value;
      const bufferAfter = document.getElementById('event-type-buffer-after').value;
      const advanceNotice = document.getElementById('event-type-advance-notice').value;
      const cancellation = document.getElementById('event-type-cancellation').value;
      const timezone = document.getElementById('event-type-timezone').value;
      const bookingLimit = document.getElementById('event-type-booking-limit').value;
      const customLimitCount = document.getElementById('event-type-custom-limit-count').value;
      const customLimitPeriod = document.getElementById('event-type-custom-limit-period').value;
      const confirmationMessage = document.getElementById('event-type-confirmation-message').value.trim();
      const questions = document.getElementById('event-type-questions').value.trim();
      const requireName = document.getElementById('event-type-require-name').checked;
      const requireEmail = document.getElementById('event-type-require-email').checked;
      const requirePhone = document.getElementById('event-type-require-phone').checked;
      const requireCompany = document.getElementById('event-type-require-company').checked;
      const availability = document.getElementById('event-type-availability').checked;
      const reminders = document.getElementById('event-type-reminders').checked;
      const followUp = document.getElementById('event-type-follow-up').checked;
      const cancellationNotification = document.getElementById('event-type-cancellation-notification').checked;
      const rescheduleNotification = document.getElementById('event-type-reschedule-notification').checked;
      const secret = document.getElementById('event-type-secret').value;
      const priority = document.getElementById('event-type-priority').value;
      const tags = document.getElementById('event-type-tags').value.trim();

      if (!name) {
        showNotification('Event type name is required');
        return;
      }

      let eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      const slug = generateSlug(name, eventTypes);

      const eventTypeData = {
        name,
        title: name,
        slug,
        duration: parseInt(duration),
        eventType,
        attendeeLimit: eventType !== '1-on-1' ? parseInt(attendeeLimit) : 1,
        description,
        location,
        customLocation: location === 'custom' ? customLocation : '',
        link: location !== 'office' ? link : '',
        color,
        bufferBefore: parseInt(bufferBefore),
        bufferAfter: parseInt(bufferAfter),
        advanceNotice: parseInt(advanceNotice),
        cancellation: parseInt(cancellation),
        timezone,
        bookingLimit: bookingLimit === 'custom' ? {
          count: parseInt(customLimitCount),
          period: customLimitPeriod
        } : parseInt(bookingLimit),
        confirmationMessage,
        questions,
        requiredFields: {
          name: requireName,
          email: requireEmail,
          phone: requirePhone,
          company: requireCompany
        },
        notifications: {
          availability,
          reminders,
          followUp,
          cancellation: cancellationNotification,
          reschedule: rescheduleNotification
        },
        visibility: secret,
        priority,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        id: Date.now().toString()
      };

      try {
        const token = localStorage.getItem('calendarify-token');
        if (token) {
          const clean = token.replace(/^"|"$/g, '');
          const res = await fetch(`${API_URL}/event-types`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
            body: JSON.stringify({ title: name, slug, description, duration: parseInt(duration) })
          });
          if (res.ok) {
            const saved = await res.json();
            eventTypeData.id = saved.id;
            eventTypeData.slug = saved.slug;
          }
        }
      } catch (e) {
        console.error('Failed to save event type to server', e);
      }

      eventTypes.push(eventTypeData);
      localStorage.setItem('calendarify-event-types', JSON.stringify(eventTypes));
      
      // Update the display
      renderEventTypes();
      
      showNotification('Event type created successfully!');
      closeCreateEventTypeModal();
    }

    // Interactive form functionality
    function handleEventTypeChange() {
      const eventType = document.getElementById('event-type-type').value;
      const attendeeContainer = document.getElementById('attendee-limit-container');
      
      if (eventType === '1-on-1') {
        attendeeContainer.style.display = 'none';
      } else {
        attendeeContainer.style.display = 'block';
      }
    }

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

    function handleBookingLimitChange() {
      const bookingLimit = document.getElementById('event-type-booking-limit').value;
      const customLimitContainer = document.getElementById('custom-booking-limit-container');
      
      if (bookingLimit === 'custom') {
        customLimitContainer.style.display = 'block';
      } else {
        customLimitContainer.style.display = 'none';
      }
    }

    // Add event listeners for interactive form elements
    document.addEventListener('DOMContentLoaded', function() {
      
      // Add event listeners for form interactions
      const eventTypeSelect = document.getElementById('event-type-type');
      const locationSelect = document.getElementById('event-type-location');
      const bookingLimitSelect = document.getElementById('event-type-booking-limit');
      
      if (eventTypeSelect) {
        eventTypeSelect.addEventListener('change', handleEventTypeChange);
      }
      
      if (locationSelect) {
        locationSelect.addEventListener('change', handleLocationChange);
      }
      
      if (bookingLimitSelect) {
        bookingLimitSelect.addEventListener('change', handleBookingLimitChange);
      }
    });

    function renderEventTypes() {
      const eventTypesGrid = document.getElementById('event-types-grid');
      const eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      
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
        
        const eventTypeText = eventType.eventType === '1-on-1' ? '1-on-1' :
                             eventType.eventType === 'group' ? 'Group' :
                             eventType.eventType === 'collective' ? 'Collective' :
                             eventType.eventType === 'round-robin' ? 'Round Robin' : '1-on-1';
        
        const attendeeText = eventType.eventType !== '1-on-1' ? ` • Up to ${eventType.attendeeLimit} people` : '';
        
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
          <div class="card flex flex-col gap-3" style="border-left: 4px solid ${eventType.color}">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-lg font-bold text-white">${eventType.name}</h3>
                  ${visibilityBadge}
                  ${priorityBadge}
                </div>
                <div class="text-[#A3B3AF] text-sm">${eventTypeText} • ${durationText}${attendeeText}</div>
                <div class="text-[#A3B3AF] text-sm mt-1">📍 ${locationText}</div>
                ${eventType.description ? `<div class="text-[#A3B3AF] text-sm mt-1">${eventType.description}</div>` : ''}
                ${tagsText}
              </div>
              <button class="text-[#A3B3AF] hover:text-[#34D399]" title="Favorite"><span class="material-icons-outlined">star_border</span></button>
            </div>
            <div class="flex gap-2 mt-2">
              <button class="bg-[#19342e] text-[#34D399] px-3 py-1 rounded-lg flex items-center gap-1 text-sm" onclick="copyLink('${eventType.slug}')"><span class="material-icons-outlined text-base">link</span>Copy link</button>
              <button class="bg-[#19342e] text-[#34D399] px-3 py-1 rounded-lg flex items-center gap-1 text-sm" onclick="openShareModal('${eventType.name}','${eventType.slug}')"><span class="material-icons-outlined text-base">share</span>Share</button>
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
          const token = localStorage.getItem('calendarify-token');
          if (token) {
            const clean = token.replace(/^"|"$/g, '');
            await fetch(`${API_URL}/event-types/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clean}` } });
          }
        } catch (e) {
          console.error('Failed to delete event type from server', e);
        }
        let eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
        eventTypes = eventTypes.filter(eventType => eventType.id !== id);
        localStorage.setItem('calendarify-event-types', JSON.stringify(eventTypes));
        renderEventTypes();
        showNotification('Event type deleted successfully!');
        closeDeleteEventTypeConfirmModal();
        window.eventTypeToDelete = null;
      }
    }

    function closeDeleteEventTypeConfirmModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('delete-event-type-confirm-modal').classList.add('hidden');
      window.eventTypeToDelete = null;
    }

    async function cloneEventType(id) {
      let eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      const originalEventType = eventTypes.find(eventType => eventType.id === id);

      if (originalEventType) {
        const clonedEventType = {
          ...originalEventType,
          name: `${originalEventType.name} (Copy)`,
          title: `${originalEventType.name} (Copy)`,
          id: Date.now().toString()
        };

        clonedEventType.slug = generateSlug(clonedEventType.name, eventTypes);

        try {
          const token = localStorage.getItem('calendarify-token');
          if (token) {
            const clean = token.replace(/^"|"$/g, '');
            const res = await fetch(`${API_URL}/event-types`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
              body: JSON.stringify({ title: clonedEventType.name, slug: clonedEventType.slug, duration: clonedEventType.duration, description: clonedEventType.description })
            });
            if (res.ok) {
              const saved = await res.json();
              clonedEventType.id = saved.id;
              clonedEventType.slug = saved.slug;
            }
          }
        } catch (e) {
          console.error('Failed to clone event type on server', e);
        }

        eventTypes.push(clonedEventType);
        localStorage.setItem('calendarify-event-types', JSON.stringify(eventTypes));
        renderEventTypes();
        showNotification('Event type cloned successfully!');
      }
    }

    function editEventType(id) {
      let eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      const eventType = eventTypes.find(eventType => eventType.id === id);
      
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
      document.getElementById('edit-event-type-name').value = eventType.name;
      document.getElementById('edit-event-type-duration').value = eventType.duration;
      document.getElementById('edit-event-type-type').value = eventType.eventType;
      document.getElementById('edit-event-type-attendee-limit').value = eventType.attendeeLimit || 10;
      document.getElementById('edit-event-type-description').value = eventType.description || '';
      document.getElementById('edit-event-type-location').value = eventType.location;
      document.getElementById('edit-event-type-custom-location').value = eventType.customLocation || '';
      document.getElementById('edit-event-type-link').value = eventType.link || '';
      document.getElementById('edit-event-type-color').value = eventType.color;
      
      // Scheduling
      document.getElementById('edit-event-type-buffer-before').value = eventType.bufferBefore;
      document.getElementById('edit-event-type-buffer-after').value = eventType.bufferAfter;
      document.getElementById('edit-event-type-advance-notice').value = eventType.advanceNotice;
      document.getElementById('edit-event-type-cancellation').value = eventType.cancellation;
      document.getElementById('edit-event-type-timezone').value = eventType.timezone;
      
      // Booking limits
      if (typeof eventType.bookingLimit === 'object') {
        document.getElementById('edit-event-type-booking-limit').value = 'custom';
        document.getElementById('edit-event-type-custom-limit-count').value = eventType.bookingLimit.count;
        document.getElementById('edit-event-type-custom-limit-period').value = eventType.bookingLimit.period;
      } else {
        document.getElementById('edit-event-type-booking-limit').value = eventType.bookingLimit;
      }
      
      // Booking Form
      document.getElementById('edit-event-type-confirmation-message').value = eventType.confirmationMessage || '';
      document.getElementById('edit-event-type-questions').value = eventType.questions || '';
      
      // Required Fields
      document.getElementById('edit-event-type-require-name').checked = eventType.requiredFields?.name !== false;
      document.getElementById('edit-event-type-require-email').checked = eventType.requiredFields?.email !== false;
      document.getElementById('edit-event-type-require-phone').checked = eventType.requiredFields?.phone === true;
      document.getElementById('edit-event-type-require-company').checked = eventType.requiredFields?.company === true;
      
      // Notifications
      document.getElementById('edit-event-type-availability').checked = eventType.notifications?.availability !== false;
      document.getElementById('edit-event-type-reminders').checked = eventType.notifications?.reminders !== false;
      document.getElementById('edit-event-type-follow-up').checked = eventType.notifications?.followUp === true;
      document.getElementById('edit-event-type-cancellation-notification').checked = eventType.notifications?.cancellation !== false;
      document.getElementById('edit-event-type-reschedule-notification').checked = eventType.notifications?.reschedule !== false;
      
      // Advanced Settings
      document.getElementById('edit-event-type-secret').value = eventType.visibility;
      document.getElementById('edit-event-type-priority').value = eventType.priority;
      document.getElementById('edit-event-type-tags').value = eventType.tags ? eventType.tags.join(', ') : '';
      
      // Update form visibility based on current values
      handleEditEventTypeChange();
      handleEditLocationChange();
      handleEditBookingLimitChange();
    }

    async function updateEventType() {
      const eventType = window.editingEventType;
      if (!eventType) return;
      
      // Collect all form data (same as saveEventType but with edit- prefixes)
      const name = document.getElementById('edit-event-type-name').value.trim();
      const duration = document.getElementById('edit-event-type-duration').value;
      const eventTypeValue = document.getElementById('edit-event-type-type').value;
      const attendeeLimit = document.getElementById('edit-event-type-attendee-limit').value;
      const description = document.getElementById('edit-event-type-description').value.trim();
      const location = document.getElementById('edit-event-type-location').value;
      const customLocation = document.getElementById('edit-event-type-custom-location').value.trim();
      const link = document.getElementById('edit-event-type-link').value.trim();
      const color = document.getElementById('edit-event-type-color').value;
      const bufferBefore = document.getElementById('edit-event-type-buffer-before').value;
      const bufferAfter = document.getElementById('edit-event-type-buffer-after').value;
      const advanceNotice = document.getElementById('edit-event-type-advance-notice').value;
      const cancellation = document.getElementById('edit-event-type-cancellation').value;
      const timezone = document.getElementById('edit-event-type-timezone').value;
      const bookingLimit = document.getElementById('edit-event-type-booking-limit').value;
      const customLimitCount = document.getElementById('edit-event-type-custom-limit-count').value;
      const customLimitPeriod = document.getElementById('edit-event-type-custom-limit-period').value;
      const confirmationMessage = document.getElementById('edit-event-type-confirmation-message').value.trim();
      const questions = document.getElementById('edit-event-type-questions').value.trim();
      const requireName = document.getElementById('edit-event-type-require-name').checked;
      const requireEmail = document.getElementById('edit-event-type-require-email').checked;
      const requirePhone = document.getElementById('edit-event-type-require-phone').checked;
      const requireCompany = document.getElementById('edit-event-type-require-company').checked;
      const availability = document.getElementById('edit-event-type-availability').checked;
      const reminders = document.getElementById('edit-event-type-reminders').checked;
      const followUp = document.getElementById('edit-event-type-follow-up').checked;
      const cancellationNotification = document.getElementById('edit-event-type-cancellation-notification').checked;
      const rescheduleNotification = document.getElementById('edit-event-type-reschedule-notification').checked;
      const secret = document.getElementById('edit-event-type-secret').value;
      const priority = document.getElementById('edit-event-type-priority').value;
      const tags = document.getElementById('edit-event-type-tags').value.trim();

      if (!name) {
        showNotification('Event type name is required');
        return;
      }

      // Update the event type data
      let eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      const existing = eventTypes.filter(et => et.id !== eventType.id);
      let slug = eventType.slug;
      if (name !== eventType.name) {
        slug = generateSlug(name, existing);
      }

      const updatedEventType = {
        ...eventType,
        name,
        title: name,
        slug,
        duration: parseInt(duration),
        eventType: eventTypeValue,
        attendeeLimit: eventTypeValue !== '1-on-1' ? parseInt(attendeeLimit) : 1,
        description,
        location,
        customLocation: location === 'custom' ? customLocation : '',
        link: location !== 'office' ? link : '',
        color,
        bufferBefore: parseInt(bufferBefore),
        bufferAfter: parseInt(bufferAfter),
        advanceNotice: parseInt(advanceNotice),
        cancellation: parseInt(cancellation),
        timezone,
        bookingLimit: bookingLimit === 'custom' ? {
          count: parseInt(customLimitCount),
          period: customLimitPeriod
        } : parseInt(bookingLimit),
        confirmationMessage,
        questions,
        requiredFields: {
          name: requireName,
          email: requireEmail,
          phone: requirePhone,
          company: requireCompany
        },
        notifications: {
          availability,
          reminders,
          followUp,
          cancellation: cancellationNotification,
          reschedule: rescheduleNotification
        },
        visibility: secret,
        priority,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      };

      try {
        const token = localStorage.getItem('calendarify-token');
        if (token) {
          const clean = token.replace(/^"|"$/g, '');
          await fetch(`${API_URL}/event-types/${eventType.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
            body: JSON.stringify({ title: name, slug, description, duration: parseInt(duration) })
          });
        }
      } catch (e) {
        console.error('Failed to update event type on server', e);
      }

      eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      const index = eventTypes.findIndex(et => et.id === eventType.id);
      if (index !== -1) {
        eventTypes[index] = { ...eventTypes[index], ...updatedEventType };
        localStorage.setItem('calendarify-event-types', JSON.stringify(eventTypes));

        renderEventTypes();
        showNotification('Event type updated successfully!');
        closeEditEventTypeModal();
      }
    }

    function closeEditEventTypeModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      document.getElementById('edit-event-type-modal').classList.add('hidden');
      window.editingEventType = null;
    }

    // Edit form interactive functions
    function handleEditEventTypeChange() {
      const eventType = document.getElementById('edit-event-type-type').value;
      const attendeeContainer = document.getElementById('edit-attendee-limit-container');
      
      if (eventType === '1-on-1') {
        attendeeContainer.style.display = 'none';
      } else {
        attendeeContainer.style.display = 'block';
      }
    }

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

    function handleEditBookingLimitChange() {
      const bookingLimit = document.getElementById('edit-event-type-booking-limit').value;
      const customLimitContainer = document.getElementById('edit-custom-booking-limit-container');
      
      if (bookingLimit === 'custom') {
        customLimitContainer.style.display = 'block';
      } else {
        customLimitContainer.style.display = 'none';
      }
    }

    // Initialize event types on page load
    document.addEventListener('DOMContentLoaded', function() {
      let eventTypes = JSON.parse(localStorage.getItem('calendarify-event-types') || '[]');
      if (eventTypes.length === 0) {
        eventTypes.push({
          name: '30-min Intro Call',
          slug: '30-min-intro-call',
          duration: 30,
          eventType: '1-on-1',
          attendeeLimit: 1,
          description: '',
          location: 'zoom',
          customLocation: '',
          link: '',
          color: '#34D399',
          bufferBefore: 0,
          bufferAfter: 0,
          advanceNotice: 0,
          cancellation: 0,
          timezone: 'auto',
          bookingLimit: 0,
          confirmationMessage: '',
          questions: '',
          requiredFields: { name: true, email: true, phone: false, company: false },
          notifications: { availability: true, reminders: true, followUp: false, cancellation: true, reschedule: true },
          visibility: 'public',
          priority: 'normal',
          tags: [],
          id: Date.now().toString() + Math.floor(Math.random()*10000)
        });
        localStorage.setItem('calendarify-event-types', JSON.stringify(eventTypes));
      }
      renderEventTypes();
      
      // Add event listeners for form interactions
      const eventTypeSelect = document.getElementById('event-type-type');
      const locationSelect = document.getElementById('event-type-location');
      const bookingLimitSelect = document.getElementById('event-type-booking-limit');
      
      if (eventTypeSelect) {
        eventTypeSelect.addEventListener('change', handleEventTypeChange);
      }
      
      if (locationSelect) {
        locationSelect.addEventListener('change', handleLocationChange);
      }
      
      if (bookingLimitSelect) {
        bookingLimitSelect.addEventListener('change', handleBookingLimitChange);
      }
    });

    function cancelMeeting(meetingId) {
      // Find the meeting by ID
      const meetings = JSON.parse(localStorage.getItem('calendarify-meetings') || '[]');
      const meeting = meetings.find(m => m.id === meetingId);
      
      if (!meeting) {
        showNotification('Meeting not found!', 'error');
        return;
      }
      
      // Store the meeting to cancel
      window.meetingToCancel = meeting;
      
      // Show custom confirmation modal
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.getElementById('cancel-meeting-confirm-modal').classList.remove('hidden');
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
          const token = localStorage.getItem('calendarify-token');
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
        const token = localStorage.getItem('calendarify-token');
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
        const token = localStorage.getItem('calendarify-token');
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
        const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
          const token = localStorage.getItem('calendarify-token');
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

        const token = localStorage.getItem('calendarify-token');
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

        const token = localStorage.getItem('calendarify-token');
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
        const contacts = JSON.parse(localStorage.getItem('calendarify-contacts') || '[]');
        const token = localStorage.getItem('calendarify-token');
        const clean = token ? token.replace(/^"|"$/g, '') : '';

        const res = await fetch(`${API_URL}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean}` },
          body: JSON.stringify({ name, email, phone, company, notes, favorite, tags })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const newContact = await res.json();

        contacts.push(newContact);
        localStorage.setItem('calendarify-contacts', JSON.stringify(contacts));
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
      const id = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId;
      const meeting = getMeetingsData('upcoming').find(m => m.id === id) || 
                     getMeetingsData('pending').find(m => m.id === id);
      
      if (meeting) {
        showNotification(`Opening reschedule dialog for ${meeting.invitee}`);
        // Here you would typically open a reschedule modal
      } else {
        showNotification('Cannot reschedule past meetings');
      }
    }

    function cancelMeeting(meetingId) {
      console.log('cancelMeeting called with ID:', meetingId, 'Type:', typeof meetingId);
      
      // Convert to number if it's a string
      const id = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId;
      console.log('Converted ID:', id);
      
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
        window.meetingToCancel = { id: id, invitee: meeting.invitee };
        
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

    function confirmCancelMeeting() {
      const meetingInfo = window.meetingToCancel;
      if (meetingInfo) {
        console.log('Confirming cancellation for meeting:', meetingInfo);
        
        // First, close the modal
        closeCancelMeetingConfirmModal();
        window.meetingToCancel = null;
        
        // Then remove meeting from data (cancelled meetings are removed)
        removeMeetingFromData(meetingInfo.id);
        console.log('Meeting removed from data. Current data:', meetingsData);
        
        // Show notification
        showNotification(`Meeting with ${meetingInfo.invitee} has been cancelled`);
        
        // Finally, refresh the meetings table - try multiple ways to find current tab
        let currentTab = 'upcoming'; // default fallback
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

    initAuth('dashboard-body', loadState);

    function updateGoogleCalendarButton() {
      const btn = document.getElementById('google-calendar-connect-btn');
      console.log('[DEBUG] updateGoogleCalendarButton called', btn);
      if (!btn) return;
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
      if (!token) return;
      const clean = token.replace(/^"|"$/g, '');
      const res = await fetch(`${API_URL}/integrations/zoom/auth-url`, {
        headers: { Authorization: `Bearer ${clean}` },
      });
      console.log('[DEBUG] /integrations/zoom/auth-url status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[DEBUG] Redirecting to', data.url);
        window.location.href = data.url;
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
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
      const token = localStorage.getItem('calendarify-token');
      if (!token) return;
      const clean = token.replace(/^\"|\"$/g, '');
      const res = await fetch(`${API_URL}/integrations/apple/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clean}` },
      });
      if (res.ok) {
        showNotification('Apple Calendar disconnected');
        updateAppleCalendarButton();
      } else {
        showNotification('Failed to disconnect Apple Calendar');
      }
      closeDisconnectAppleModal();
    }
    window.openDisconnectAppleModal = openDisconnectAppleModal;
    window.closeDisconnectAppleModal = closeDisconnectAppleModal;
    window.confirmDisconnectApple = confirmDisconnectApple;

    localStorage.setItem('calendarify-tags', JSON.stringify(['Client', 'VIP']));
    if (!localStorage.getItem('calendarify-contacts')) {
      localStorage.setItem('calendarify-contacts', JSON.stringify([
        {
          id: 'c1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '',
          company: '',
          notes: '',
          favorite: false,
          tags: ['Client'],
          createdAt: new Date().toISOString()
        },
        {
          id: 'c2',
          name: 'John Smith',
          email: 'john@company.com',
          phone: '',
          company: '',
          notes: '',
          favorite: true,
          tags: ['VIP'],
          createdAt: new Date().toISOString()
        }
      ]));
    }
