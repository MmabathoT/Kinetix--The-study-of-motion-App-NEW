(function () {
  // ---------- mock data ----------
  const SPORTS = [
    { id: 'run',  label: 'Run',  icon: '🏃', speed: 0.0028 },
    { id: 'ride', label: 'Ride', icon: '🚴', speed: 0.0075 },
    { id: 'swim', label: 'Swim', icon: '🏊', speed: 0.0009 },
    { id: 'hike', label: 'Hike', icon: '🥾', speed: 0.0014 },
    { id: 'gym',  label: 'Gym',  icon: '🏋️', speed: 0 },
  ];
  try {
    const savedSports = JSON.parse(localStorage.getItem('kinetixCustomSports') || '[]');
    if (Array.isArray(savedSports)) {
      savedSports.forEach((savedSport) => {
        if (!savedSport || typeof savedSport.id !== 'string' || !savedSport.id.startsWith('custom-')) return;
        if (typeof savedSport.label !== 'string' || !savedSport.label.trim()) return;
        if (SPORTS.some((sport) => sport.id === savedSport.id || sport.label.toLowerCase() === savedSport.label.trim().toLowerCase())) return;
        SPORTS.push({
          id: savedSport.id,
          label: savedSport.label.trim().slice(0, 24),
          icon: typeof savedSport.icon === 'string' ? savedSport.icon : '🏅',
          speed: 0.0028,
        });
      });
    }
  } catch (error) {
    // Ignore malformed saved sports and keep the built-in activities available.
  }

  const FEED = [
    { name: 'Lindiwe Sithole', sport: 'ride', title: 'Morning loop before the sun got mean', distance: '32.4 km', time: '58:12', pace: '33.4 km/h', kudos: 24, comments: 3 },
    { name: 'Thabo Nkosi', sport: 'run', title: 'Easy 10K, legs felt flat', distance: '10.1 km', time: '52:03', pace: '5:09/km', kudos: 12, comments: 1 },
  ];

  let history = [];
  try {
    const savedHistory = JSON.parse(localStorage.getItem('kinetixHistory') || '[]');
    if (Array.isArray(savedHistory)) history = savedHistory;
  } catch (error) {
    history = [];
  }
  let galleryDatabasePromise = null;
  let galleryItems = [];
  let galleryObjectUrls = [];

  function sportMeta(id) { return SPORTS.find((s) => s.id === id) || SPORTS[0]; }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function openGalleryDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error('Image storage is not available in this browser.'));
    if (!galleryDatabasePromise) {
      galleryDatabasePromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open('kinetix-gallery', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('images')) {
            request.result.createObjectStore('images', { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not open the Gallery.'));
      });
    }
    return galleryDatabasePromise;
  }

  async function useGalleryStore(mode, operation) {
    const database = await openGalleryDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('images', mode);
      let request;
      try {
        request = operation(transaction.objectStore('images'));
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error || new Error('Gallery update failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Gallery update was cancelled.'));
    });
  }

  function setMessage(element, text, type) {
    element.textContent = text;
    element.className = `form-message ${type || 'success'}`;
    element.hidden = false;
  }

  function saveHistory() {
    localStorage.setItem('kinetixHistory', JSON.stringify(history));
  }

  function localMonthKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatHistoryDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function setupEmojiPickers() {
    const emojis = ['😀', '😄', '🥰', '😂', '🏃', '🚴', '💪', '🔥', '✨', '❤️', '🎉', '🌈', '🌟', '🏆', '💧', '🌿'];
    document.querySelectorAll('input[type="text"], textarea').forEach((field) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'emoji-field';
      field.parentNode.insertBefore(wrapper, field);
      wrapper.append(field);

      const trigger = document.createElement('button');
      trigger.className = 'emoji-trigger';
      trigger.type = 'button';
      trigger.textContent = '🙂';
      trigger.title = 'Add emoji';
      trigger.setAttribute('aria-label', 'Add emoji');
      trigger.setAttribute('aria-expanded', 'false');

      const picker = document.createElement('div');
      picker.className = 'emoji-picker';
      picker.hidden = true;
      picker.setAttribute('role', 'group');
      picker.setAttribute('aria-label', 'Choose an emoji');

      emojis.forEach((emoji) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'emoji-option';
        option.textContent = emoji;
        option.setAttribute('aria-label', `Insert ${emoji}`);
        option.addEventListener('pointerdown', (event) => event.preventDefault());
        option.addEventListener('click', () => {
          const start = field.selectionStart ?? field.value.length;
          const end = field.selectionEnd ?? start;
          field.setRangeText(emoji, start, end, 'end');
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.focus();
          picker.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
        });
        picker.append(option);
      });

      trigger.addEventListener('pointerdown', (event) => event.preventDefault());
      trigger.addEventListener('click', () => {
        const shouldOpen = picker.hidden;
        document.querySelectorAll('.emoji-picker').forEach((otherPicker) => {
          otherPicker.hidden = true;
          otherPicker.previousElementSibling.setAttribute('aria-expanded', 'false');
        });
        picker.hidden = !shouldOpen;
        trigger.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) {
          const rect = field.getBoundingClientRect();
          picker.classList.toggle('above', window.innerHeight - rect.bottom < 230);
        }
      });

      wrapper.append(trigger, picker);
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('.emoji-field')) return;
      document.querySelectorAll('.emoji-picker:not([hidden])').forEach((picker) => {
        picker.hidden = true;
        picker.previousElementSibling.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.emoji-picker:not([hidden])').forEach((picker) => {
        picker.hidden = true;
        picker.previousElementSibling.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---------- profile ----------
  const profileForm = document.getElementById('profileForm');
  const loginForm = document.getElementById('loginForm');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const switchAuthMode = document.getElementById('switchAuthMode');
  const welcomeCopy = document.getElementById('welcomeCopy');
  const profileLocationForm = document.getElementById('profileLocationForm');
  const profileNameInput = document.getElementById('profileName');
  const profileEmailInput = document.getElementById('profileEmail');
  const profileLocationInput = document.getElementById('profileLocation');
  const profilePasswordInput = document.getElementById('profilePassword');
  const profilePictureInput = document.getElementById('profilePicture');
  const avatars = document.querySelectorAll('.avatar');
  const profileNameDisplay = document.getElementById('profileNameDisplay');
  const profileNameRow = document.getElementById('profileNameRow');
  const quickNameForm = document.getElementById('quickNameForm');
  const quickProfileNameInput = document.getElementById('quickProfileName');
  const quickNameMessage = document.getElementById('quickNameMessage');
  const profileLocationDisplay = document.getElementById('profileLocationDisplay');
  const profileActivities = document.getElementById('profileActivities');
  const profileDistance = document.getElementById('profileDistance');
  const profileCalories = document.getElementById('profileCalories');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsCloseBtn = document.getElementById('settingsCloseBtn');
  const themeSelect = document.getElementById('themeSelect');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const passwordForm = document.getElementById('passwordForm');
  const passwordMessage = document.getElementById('passwordMessage');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const settingsProfileForm = document.getElementById('settingsProfileForm');
  const settingsNameInput = document.getElementById('settingsName');
  const settingsEmailInput = document.getElementById('settingsEmail');
  const settingsLocationInput = document.getElementById('settingsLocation');
  const profileMessage = document.getElementById('profileMessage');
  const settingsTabs = document.querySelectorAll('.settings-tab');
  const settingsPanes = document.querySelectorAll('.settings-pane');
  const editProfileBtn = document.getElementById('editProfileBtn');
  const notificationInputs = {
    email: document.getElementById('emailNotifications'),
    push: document.getElementById('pushNotifications'),
    sms: document.getElementById('smsNotifications'),
    kinetix: document.getElementById('kinetixNotifications'),
  };
  const contactForm = document.getElementById('contactForm');
  const contactFeedback = document.getElementById('contactFeedback');

  let profile = {
    name: '', email: '', location: '', password: '', theme: 'kinetix', darkMode: true,
    notifications: { email: false, push: false, sms: false, kinetix: true },
  };
  try {
    profile = { ...profile, ...JSON.parse(localStorage.getItem('kinetixProfile') || '{}') };
  } catch (error) {
    // Use the empty profile if stored data is unavailable or malformed.
  }

  function renderProfile() {
    profileNameInput.value = profile.name;
    profileEmailInput.value = profile.email;
    profileLocationInput.value = profile.location || '';
    profilePasswordInput.value = '';
    profileNameDisplay.textContent = profile.name || 'Your profile';
    profileLocationDisplay.textContent = profile.location || 'Add your location';
    avatars.forEach((avatar) => {
      avatar.style.backgroundImage = profile.picture ? `url("${profile.picture}")` : '';
      avatar.classList.toggle('has-picture', Boolean(profile.picture));
    });
    profileActivities.textContent = String(history.length);
    const totalDistance = history.reduce((total, activity) => total + (parseFloat(activity.distance) || 0), 0);
    const totalCalories = history.reduce((total, activity) => total + (activity.cal || 0), 0);
    profileDistance.textContent = `${totalDistance.toFixed(2)} km`;
    profileCalories.textContent = totalCalories.toLocaleString();
  }

  function applyAppearance() {
    const theme = darkModeToggle.checked ? themeSelect.value : 'light';
    document.body.dataset.theme = theme;
    profile.theme = themeSelect.value;
    profile.darkMode = darkModeToggle.checked;
    localStorage.setItem('kinetixProfile', JSON.stringify(profile));
  }

  function saveProfile() {
    localStorage.setItem('kinetixProfile', JSON.stringify(profile));
  }

  function showApp() {
    document.getElementById('welcome').hidden = true;
    document.getElementById('app').hidden = false;
  }

  function showLogin() {
    document.getElementById('welcome').hidden = false;
    document.getElementById('app').hidden = true;
    profileForm.hidden = true;
    loginForm.hidden = false;
    loginError.hidden = true;
    welcomeCopy.textContent = 'Welcome back. Log in to continue tracking your motion.';
    switchAuthMode.textContent = 'New to Kinetix? Create a profile';
  }

  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    profile = {
      ...profile,
      name: profileNameInput.value.trim(),
      email: profileEmailInput.value.trim(),
      password: profilePasswordInput.value,
    };
    saveProfile();
    renderProfile();
    sessionStorage.setItem('kinetixLoggedIn', 'true');
    showApp();
  });

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const emailMatches = loginEmailInput.value.trim().toLowerCase() === profile.email.toLowerCase();
    const passwordMatches = loginPasswordInput.value === profile.password;
    if (!emailMatches || !passwordMatches) {
      loginError.hidden = false;
      return;
    }
    loginError.hidden = true;
    loginForm.hidden = true;
    sessionStorage.setItem('kinetixLoggedIn', 'true');
    showApp();
  });

  switchAuthMode.addEventListener('click', () => {
    const showingLogin = !profileForm.hidden;
    profileForm.hidden = showingLogin;
    loginForm.hidden = !showingLogin;
    loginError.hidden = true;
    welcomeCopy.textContent = showingLogin
      ? 'Welcome back. Log in to continue tracking your motion.'
      : 'Create your profile to start tracking every workout.';
    switchAuthMode.textContent = showingLogin
      ? 'New to Kinetix? Create a profile'
      : 'Log in';
  });

  profileLocationForm.addEventListener('submit', (event) => {
    event.preventDefault();
    profile.location = profileLocationInput.value.trim();
    saveProfile();
    renderProfile();
    profileLocationForm.hidden = true;
    profileLocationDisplay.setAttribute('aria-expanded', 'false');
  });
  profileLocationDisplay.addEventListener('click', () => {
    const opening = profileLocationForm.hidden;
    profileLocationForm.hidden = !opening;
    profileLocationDisplay.setAttribute('aria-expanded', String(opening));
    if (opening) {
      profileLocationInput.value = profile.location || '';
      profileLocationInput.focus();
    }
  });

  document.getElementById('quickEditNameBtn').addEventListener('click', () => {
    quickProfileNameInput.value = profile.name || '';
    quickNameMessage.hidden = true;
    profileNameRow.hidden = true;
    quickNameForm.hidden = false;
    quickProfileNameInput.focus();
    quickProfileNameInput.select();
  });
  document.getElementById('cancelQuickNameBtn').addEventListener('click', () => {
    quickNameForm.hidden = true;
    profileNameRow.hidden = false;
    quickNameMessage.hidden = true;
  });
  quickNameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = quickProfileNameInput.value.trim();
    if (!name) {
      setMessage(quickNameMessage, 'Enter a name first.', 'error');
      return;
    }
    profile.name = name;
    try {
      saveProfile();
      renderProfile();
      quickNameForm.hidden = true;
      profileNameRow.hidden = false;
      quickNameMessage.hidden = true;
    } catch (error) {
      setMessage(quickNameMessage, 'Could not save the profile name.', 'error');
    }
  });

  profilePictureInput.addEventListener('change', () => {
    const file = profilePictureInput.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      profile.picture = reader.result;
      saveProfile();
      renderProfile();
    });
    reader.readAsDataURL(file);
  });

  settingsBtn.addEventListener('click', () => {
    settingsNameInput.value = profile.name;
    settingsEmailInput.value = profile.email;
    settingsLocationInput.value = profile.location || '';
    themeSelect.value = profile.theme || 'kinetix';
    darkModeToggle.checked = profile.darkMode !== false;
    Object.entries(notificationInputs).forEach(([key, input]) => {
      input.checked = profile.notifications?.[key] ?? (key === 'kinetix');
    });
    applyAppearance();
    passwordMessage.hidden = true;
    profileMessage.hidden = true;
    settingsOverlay.hidden = false;
  });
  settingsCloseBtn.addEventListener('click', () => (settingsOverlay.hidden = true));
  editProfileBtn.addEventListener('click', () => {
    const opening = settingsProfileForm.hidden;
    settingsProfileForm.hidden = !opening;
    editProfileBtn.setAttribute('aria-expanded', String(opening));
    editProfileBtn.querySelector('.settings-chevron').textContent = opening ? '⌃' : '⌄';
  });
  changePasswordBtn.addEventListener('click', () => {
    const opening = passwordForm.hidden;
    passwordForm.hidden = !opening;
    changePasswordBtn.setAttribute('aria-expanded', String(opening));
    changePasswordBtn.querySelector('.settings-chevron').textContent = opening ? '⌃' : '⌄';
  });
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('kinetixLoggedIn');
    settingsOverlay.hidden = true;
    showLogin();
  });
  themeSelect.addEventListener('change', applyAppearance);
  darkModeToggle.addEventListener('change', applyAppearance);
  settingsTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      settingsTabs.forEach((item) => item.classList.toggle('active', item === tab));
      settingsPanes.forEach((pane) => {
        const active = pane.id === `settings-${tab.dataset.settingsTab}-pane`;
        pane.hidden = !active;
        pane.classList.toggle('active', active);
      });
    });
  });
  Object.entries(notificationInputs).forEach(([key, input]) => {
    input.addEventListener('change', () => {
      profile.notifications = { ...profile.notifications, [key]: input.checked };
      saveProfile();
    });
  });
  settingsProfileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    profile.name = settingsNameInput.value.trim();
    profile.email = settingsEmailInput.value.trim();
    profile.location = settingsLocationInput.value.trim();
    saveProfile();
    renderProfile();
    profileMessage.textContent = 'Profile updated.';
    profileMessage.className = 'form-message success';
    profileMessage.hidden = false;
  });
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const subject = document.getElementById('contactSubject').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    const senderDetails = [
      profile.name && `Name: ${profile.name}`,
      profile.email && `Email: ${profile.email}`,
      profile.location && `Location: ${profile.location}`,
    ].filter(Boolean).join('\n');
    const body = senderDetails ? `${message}\n\n${senderDetails}` : message;
    const mailtoUrl = `mailto:infokinetix@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    contactFeedback.textContent = 'Your email app is opening with this message addressed to the Kinetix team.';
    contactFeedback.className = 'form-message success';
    contactFeedback.hidden = false;
  });
  passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    passwordMessage.hidden = false;
    if (currentPasswordInput.value !== profile.password) {
      passwordMessage.textContent = 'Current password is incorrect.';
      passwordMessage.className = 'form-message error';
      return;
    }
    if (newPasswordInput.value.length < 8 || newPasswordInput.value !== confirmPasswordInput.value) {
      passwordMessage.textContent = 'New passwords must match and be at least 8 characters.';
      passwordMessage.className = 'form-message error';
      return;
    }
    profile.password = newPasswordInput.value;
    saveProfile();
    passwordForm.reset();
    passwordMessage.textContent = 'Password updated.';
    passwordMessage.className = 'form-message success';
  });

  // ---------- welcome ----------
  renderProfile();
  themeSelect.value = profile.theme || 'kinetix';
  darkModeToggle.checked = profile.darkMode !== false;
  applyAppearance();
  if (profile.name && profile.email && profile.password) {
    profileForm.hidden = true;
    loginForm.hidden = false;
    welcomeCopy.textContent = 'Welcome back. Log in to continue tracking your motion.';
    switchAuthMode.textContent = 'New to Kinetix? Create a profile';
    if (sessionStorage.getItem('kinetixLoggedIn') === 'true') showApp();
  }

  // ---------- tabs ----------
  const tabs = document.querySelectorAll('.tab');
  const screens = {
    feed: document.getElementById('screen-feed'),
    record: document.getElementById('screen-record'),
    history: document.getElementById('screen-history'),
    profile: document.getElementById('screen-profile'),
    gallery: document.getElementById('screen-gallery'),
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(screens).forEach((s) => (s.hidden = true));
      screens[tab.dataset.tab].hidden = false;
      if (tab.dataset.tab === 'gallery') renderGallery();
    });
  });
  document.querySelectorAll('.home-link, .brand-home-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      document.querySelector('.tab[data-tab="feed"]').click();
    });
  });

  // ---------- feed ----------
  function renderFeed() {
    const list = document.getElementById('feedList');
    list.innerHTML = FEED.map((post) => {
      const meta = sportMeta(post.sport);
      return `
        <div class="feed-card">
          <div class="feed-card-head">
            <div class="avatar"></div>
            <div>
              <p class="name">${post.name}</p>
              <p class="title">${post.title}</p>
            </div>
            <span style="margin-left:auto">${meta.icon}</span>
          </div>
          <div class="feed-thumb"></div>
          <div class="feed-card-stats">
            <div><span class="label">Distance</span><span class="value">${post.distance}</span></div>
            <div><span class="label">Time</span><span class="value">${post.time}</span></div>
            <div><span class="label">Pace</span><span class="value">${post.pace}</span></div>
          </div>
          <div class="feed-card-actions">
            <span>❤️ ${post.kudos}</span>
            <span>💬 ${post.comments}</span>
          </div>
        </div>`;
    }).join('');
  }

  // ---------- history ----------
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const historySportFolders = document.getElementById('historySportFolders');
  const historyFolderTitle = document.getElementById('historyFolderTitle');
  const historyDetailOverlay = document.getElementById('historyDetailOverlay');
  let selectedHistorySport = 'all';

  function openHistoryDetails(activity) {
    const timestamp = activity.createdAt || Date.now();
    const meta = sportMeta(activity.sport);
    document.getElementById('historyDetailTitle').textContent = `${meta.icon} ${meta.label}`;
    document.getElementById('historyDetailDate').textContent = new Date(timestamp).toLocaleString();
    document.getElementById('historyDetailDistance').textContent = activity.distance || '—';
    document.getElementById('historyDetailDuration').textContent = activity.time || '—';
    document.getElementById('historyDetailPace').textContent = activity.pace ? `${activity.pace} min/km` : '—';
    document.getElementById('historyDetailCalories').textContent = activity.cal == null ? '—' : `${activity.cal} kcal`;
    historyDetailOverlay.hidden = false;
  }

  function renderHistory() {
    historyList.replaceChildren();
    const activities = [...history]
      .filter((activity) => selectedHistorySport === 'all' || activity.sport === selectedHistorySport)
      .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));
    historyEmpty.hidden = activities.length > 0;
    historyEmpty.textContent = selectedHistorySport === 'all'
      ? 'Your completed activities will appear here.'
      : 'No activities in this sport folder yet.';
    const selectedSport = SPORTS.find((sport) => sport.id === selectedHistorySport);
    historyFolderTitle.textContent = selectedSport ? `${selectedSport.icon} ${selectedSport.label}` : 'All activities';

    const groups = new Map();
    activities.forEach((activity) => {
      const timestamp = activity.createdAt || Date.now();
      const monthKey = localMonthKey(timestamp);
      if (!groups.has(monthKey)) groups.set(monthKey, []);
      groups.get(monthKey).push(activity);
    });

    groups.forEach((monthActivities) => {
      const month = document.createElement('section');
      month.className = 'history-month';
      const heading = document.createElement('h3');
      heading.className = 'history-month-title';
      heading.textContent = formatHistoryDate(monthActivities[0].createdAt || Date.now());
      month.append(heading);

      monthActivities.forEach((activity) => {
        const meta = sportMeta(activity.sport);
        const row = document.createElement('button');
        row.className = 'history-row';
        row.type = 'button';
        row.setAttribute('aria-label', `View ${meta.label}, ${activity.distance}, ${activity.time}`);

        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = meta.icon;
        const info = document.createElement('span');
        info.className = 'info';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = meta.label;
        const time = document.createElement('span');
        time.className = 'date';
        time.textContent = new Date(activity.createdAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        info.append(name, time);

        const figures = document.createElement('span');
        figures.className = 'figs';
        const distance = document.createElement('span');
        distance.className = 'd';
        distance.textContent = activity.distance || '—';
        const duration = document.createElement('span');
        duration.className = 't';
        duration.textContent = activity.time || '—';
        figures.append(distance, duration);
        row.append(icon, info, figures);
        row.addEventListener('click', () => openHistoryDetails(activity));
        month.append(row);
      });
      historyList.append(month);
    });

    const sportCounts = new Map(SPORTS.map((sport) => [sport.id, 0]));
    history.forEach((activity) => sportCounts.set(activity.sport, (sportCounts.get(activity.sport) || 0) + 1));
    historySportFolders.replaceChildren();
    const folderOptions = [{ id: 'all', label: 'All activities', icon: '📁', count: history.length },
      ...SPORTS.map((sport) => ({ ...sport, count: sportCounts.get(sport.id) || 0 }))];
    folderOptions.forEach((folder) => {
      const button = document.createElement('button');
      button.className = `sport-folder${folder.id === selectedHistorySport ? ' active' : ''}`;
      button.type = 'button';
      button.setAttribute('aria-pressed', String(folder.id === selectedHistorySport));
      const icon = document.createElement('span');
      icon.className = 'sport-folder-icon';
      icon.textContent = folder.icon;
      const copy = document.createElement('span');
      copy.className = 'sport-folder-copy';
      const label = document.createElement('span');
      label.className = 'sport-folder-name';
      label.textContent = folder.label;
      const count = document.createElement('span');
      count.className = 'sport-folder-count';
      count.textContent = `${folder.count} ${folder.count === 1 ? 'activity' : 'activities'}`;
      copy.append(label, count);
      button.append(icon, copy);
      button.addEventListener('click', () => {
        selectedHistorySport = folder.id;
        renderHistory();
      });
      historySportFolders.append(button);
    });
  }

  document.getElementById('historyDetailClose').addEventListener('click', () => (historyDetailOverlay.hidden = true));
  historyDetailOverlay.addEventListener('click', (event) => {
    if (event.target === historyDetailOverlay) historyDetailOverlay.hidden = true;
  });

  const galleryList = document.getElementById('galleryList');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const galleryMessage = document.getElementById('galleryMessage');
  const gallerySportFolders = document.getElementById('gallerySportFolders');
  const galleryFolderTitle = document.getElementById('galleryFolderTitle');
  const galleryNameForm = document.getElementById('galleryNameForm');
  const galleryNameInput = document.getElementById('galleryNameInput');
  const galleryHeading = document.getElementById('galleryHeading');
  const galleryNameRow = document.getElementById('galleryNameRow');
  let selectedGallerySport = 'all';
  try {
    galleryNameInput.value = localStorage.getItem('kinetixGalleryName') || '';
    if (galleryNameInput.value) galleryHeading.textContent = galleryNameInput.value;
  } catch (error) {
    galleryNameInput.value = '';
  }
  document.getElementById('editGalleryNameBtn').addEventListener('click', () => {
    try {
      galleryNameInput.value = localStorage.getItem('kinetixGalleryName') || '';
    } catch (error) {
      galleryNameInput.value = '';
    }
    galleryMessage.hidden = true;
    galleryNameForm.hidden = false;
    galleryNameRow.hidden = true;
    document.getElementById('editGalleryNameBtn').setAttribute('aria-expanded', 'true');
    galleryNameInput.focus();
    galleryNameInput.select();
  });
  document.getElementById('cancelGalleryNameBtn').addEventListener('click', () => {
    galleryNameForm.hidden = true;
    galleryNameRow.hidden = false;
    document.getElementById('editGalleryNameBtn').setAttribute('aria-expanded', 'false');
    galleryMessage.hidden = true;
  });
  galleryNameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const galleryName = galleryNameInput.value.trim();
    try {
      if (galleryName) localStorage.setItem('kinetixGalleryName', galleryName);
      else localStorage.removeItem('kinetixGalleryName');
      galleryHeading.textContent = galleryName || 'Gallery';
      galleryNameForm.hidden = true;
      galleryNameRow.hidden = false;
      document.getElementById('editGalleryNameBtn').setAttribute('aria-expanded', 'false');
      setMessage(galleryMessage, galleryName ? 'Gallery name saved.' : 'Gallery name cleared.');
    } catch (error) {
      setMessage(galleryMessage, 'Could not save the gallery name on this device.', 'error');
    }
  });

  function gallerySportId(item) {
    const savedSportId = item.sportId || item.sport;
    if (SPORTS.some((sport) => sport.id === savedSportId)) return savedSportId;
    const title = (item.title || '').toLowerCase();
    const matchingSport = SPORTS.find((sport) => title.endsWith(sport.label.toLowerCase()));
    return matchingSport ? matchingSport.id : 'other';
  }

  function renderGalleryFolders() {
    const sportCounts = new Map(SPORTS.map((sport) => [sport.id, 0]));
    let otherCount = 0;
    galleryItems.forEach((item) => {
      const sportId = gallerySportId(item);
      if (sportCounts.has(sportId)) sportCounts.set(sportId, sportCounts.get(sportId) + 1);
      else otherCount += 1;
    });
    const folderOptions = [{ id: 'all', label: 'All photos', icon: '📁', count: galleryItems.length },
      ...SPORTS.map((sport) => ({ ...sport, count: sportCounts.get(sport.id) || 0 }))];
    if (otherCount) folderOptions.push({ id: 'other', label: 'Other', icon: '🗂️', count: otherCount });
    gallerySportFolders.replaceChildren();
    folderOptions.forEach((folder) => {
      const button = document.createElement('button');
      button.className = `sport-folder${folder.id === selectedGallerySport ? ' active' : ''}`;
      button.type = 'button';
      button.setAttribute('aria-pressed', String(folder.id === selectedGallerySport));
      const icon = document.createElement('span');
      icon.className = 'sport-folder-icon';
      icon.textContent = folder.icon;
      const copy = document.createElement('span');
      copy.className = 'sport-folder-copy';
      const label = document.createElement('span');
      label.className = 'sport-folder-name';
      label.textContent = folder.label;
      const count = document.createElement('span');
      count.className = 'sport-folder-count';
      count.textContent = `${folder.count} ${folder.count === 1 ? 'photo' : 'photos'}`;
      copy.append(label, count);
      button.append(icon, copy);
      button.addEventListener('click', () => {
        selectedGallerySport = folder.id;
        renderGallery();
      });
      gallerySportFolders.append(button);
    });
  }

  async function renderGallery() {
    galleryObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    galleryObjectUrls = [];
    galleryList.replaceChildren();
    try {
      galleryItems = await useGalleryStore('readonly', (store) => store.getAll());
      galleryItems.sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));
      renderGalleryFolders();
      const visibleItems = galleryItems.filter((item) => selectedGallerySport === 'all' || gallerySportId(item) === selectedGallerySport);
      const selectedSport = SPORTS.find((sport) => sport.id === selectedGallerySport);
      galleryFolderTitle.textContent = selectedSport ? `${selectedSport.icon} ${selectedSport.label}` :
        selectedGallerySport === 'other' ? 'Other photos' : 'All photos';
      galleryEmpty.hidden = visibleItems.length > 0;
      galleryEmpty.textContent = galleryItems.length
        ? 'No photos in this sport folder yet. Save an activity image to file it here.'
        : 'Your saved activity images will appear here.';

      const monthGroups = new Map();
      visibleItems.forEach((item) => {
        const timestamp = item.createdAt || Date.now();
        const monthKey = localMonthKey(timestamp);
        if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
        monthGroups.get(monthKey).push(item);
      });

      monthGroups.forEach((items) => {
        const month = document.createElement('section');
        month.className = 'gallery-month-group';
        const heading = document.createElement('h3');
        heading.className = 'gallery-month-title';
        heading.textContent = formatHistoryDate(items[0].createdAt || Date.now());
        const grid = document.createElement('div');
        grid.className = 'gallery-month-grid';
        month.append(heading, grid);

        items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'gallery-item';

        const image = document.createElement('img');
        const imageUrl = URL.createObjectURL(item.blob);
        galleryObjectUrls.push(imageUrl);
        image.src = imageUrl;
        image.alt = `Kinetix activity image: ${item.title}`;
        image.loading = 'lazy';
        card.append(image);

        const info = document.createElement('div');
        info.className = 'gallery-item-info';
        const title = document.createElement('h3');
        title.className = 'gallery-item-title';
        title.textContent = item.title;
        const date = document.createElement('p');
        date.className = 'gallery-item-date';
        date.textContent = new Date(item.createdAt).toLocaleDateString();
        info.append(title, date);

        const actions = document.createElement('div');
        actions.className = 'gallery-item-actions';
        const shareButton = document.createElement('button');
        shareButton.className = 'btn-outline';
        shareButton.type = 'button';
        shareButton.textContent = 'Share';
        shareButton.setAttribute('aria-label', `Share ${item.title}`);
        shareButton.addEventListener('click', () => shareImage(item.blob, item.fileName, galleryMessage));
        const downloadButton = document.createElement('button');
        downloadButton.className = 'btn-outline';
        downloadButton.type = 'button';
        downloadButton.textContent = 'Download';
        downloadButton.setAttribute('aria-label', `Download ${item.title}`);
        downloadButton.addEventListener('click', () => downloadImage(item.blob, item.fileName));
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn-outline';
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.setAttribute('aria-label', `Delete ${item.title}`);
        deleteButton.addEventListener('click', async () => {
          try {
            await useGalleryStore('readwrite', (store) => store.delete(item.id));
            await renderGallery();
            setMessage(galleryMessage, 'Image removed from Gallery.');
          } catch (error) {
            setMessage(galleryMessage, error.message, 'error');
          }
        });
        actions.append(shareButton, downloadButton, deleteButton);
        info.append(actions);
        card.append(info);
        grid.append(card);
        });
        galleryList.append(month);
      });
    } catch (error) {
      galleryEmpty.hidden = true;
      setMessage(galleryMessage, error.message, 'error');
    }
  }

  // ---------- record ----------
  const sportPicker = document.getElementById('sportPicker');
  let currentSport = 'run';

  function renderSportPicker() {
    sportPicker.replaceChildren();
    SPORTS.forEach((sport) => {
      const button = document.createElement('button');
      button.className = `sport-chip${sport.id === currentSport ? ' active' : ''}`;
      button.type = 'button';
      button.dataset.sport = sport.id;
      button.setAttribute('aria-pressed', String(sport.id === currentSport));
      const icon = document.createElement('span');
      icon.textContent = sport.icon;
      const label = document.createElement('span');
      label.textContent = sport.label;
      button.append(icon, label);
      button.addEventListener('click', () => {
        currentSport = sport.id;
        renderSportPicker();
      });
      sportPicker.append(button);
    });

    const addButton = document.createElement('button');
    addButton.className = 'sport-chip add-sport-trigger';
    addButton.type = 'button';
    addButton.textContent = '+ Add sport';
    addButton.addEventListener('click', () => {
      document.getElementById('customSportName').value = '';
      document.getElementById('addSportMessage').hidden = true;
      document.getElementById('addSportOverlay').hidden = false;
      document.getElementById('customSportName').focus();
    });
    sportPicker.append(addButton);
  }

  const addSportOverlay = document.getElementById('addSportOverlay');
  const addSportForm = document.getElementById('addSportForm');
  const addSportMessage = document.getElementById('addSportMessage');
  document.getElementById('addSportClose').addEventListener('click', () => (addSportOverlay.hidden = true));
  document.getElementById('addSportCancel').addEventListener('click', () => (addSportOverlay.hidden = true));
  addSportOverlay.addEventListener('click', (event) => {
    if (event.target === addSportOverlay) addSportOverlay.hidden = true;
  });
  addSportForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const label = document.getElementById('customSportName').value.trim();
    const icon = document.getElementById('customSportIcon').value;
    if (!label) {
      setMessage(addSportMessage, 'Enter a sport name first.', 'error');
      return;
    }
    if (SPORTS.some((sport) => sport.label.toLowerCase() === label.toLowerCase())) {
      setMessage(addSportMessage, 'That sport is already in your tabs.', 'error');
      return;
    }

    const slug = label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `sport-${Date.now()}`;
    let id = `custom-${slug}`;
    let suffix = 2;
    while (SPORTS.some((sport) => sport.id === id)) {
      id = `custom-${slug}-${suffix}`;
      suffix += 1;
    }
    const newSport = { id, label, icon, speed: 0.0028 };
    const savedSports = [...SPORTS.filter((sport) => sport.id.startsWith('custom-')), newSport]
      .map(({ id: sportId, label: sportLabel, icon: sportIcon }) => ({ id: sportId, label: sportLabel, icon: sportIcon }));
    try {
      localStorage.setItem('kinetixCustomSports', JSON.stringify(savedSports));
    } catch (error) {
      setMessage(addSportMessage, 'Could not save this sport on your device.', 'error');
      return;
    }

    SPORTS.push(newSport);
    currentSport = id;
    renderSportPicker();
    addSportOverlay.hidden = true;
  });

  const startBtn = document.getElementById('startBtn');
  const controls = document.getElementById('controls');
  const statTime = document.getElementById('statTime');
  const statDistance = document.getElementById('statDistance');
  const statPace = document.getElementById('statPace');
  const routePath = document.getElementById('routePath');
  const gpsPill = document.getElementById('gpsPill');
  const recordSub = document.getElementById('recordSub');
  const summary = document.getElementById('summary');

  let timerId = null;
  let seconds = 0;
  let distanceKm = 0;
  let previousGpsPosition = null;
  let usesGpsDistance = false;
  let liveStartPending = false;
  let status = 'idle'; // idle | running | paused

  const PATH_LENGTH = 260; // approx length of the SVG path, for the draw-on animation

  function updateRecordStats() {
    statTime.textContent = formatTime(seconds);
    statDistance.textContent = distanceKm.toFixed(2);
    const pace = distanceKm > 0 ? (seconds / 60 / distanceKm).toFixed(2) : '0.00';
    statPace.textContent = pace;
  }

  function handleLivePosition(position) {
    if (status !== 'running' && !liveStartPending) return;
    if (previousGpsPosition) {
      const radians = (degrees) => (degrees * Math.PI) / 180;
      const latitudeDelta = radians(position.latitude - previousGpsPosition.latitude);
      const longitudeDelta = radians(position.longitude - previousGpsPosition.longitude);
      const startLatitude = radians(previousGpsPosition.latitude);
      const endLatitude = radians(position.latitude);
      const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
      distanceKm += 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }
    previousGpsPosition = { latitude: position.latitude, longitude: position.longitude };
    gpsPill.hidden = false;
    gpsPill.textContent = 'GPS location shared';
    updateRecordStats();
  }

  function tick() {
    seconds += 1;
    if (!usesGpsDistance) distanceKm += sportMeta(currentSport).speed;
    updateRecordStats();
    const progress = Math.min(1, seconds / 90);
    routePath.style.strokeDashoffset = String(1000 - 1000 * progress);
  }

  function renderControls() {
    if (status === 'idle') {
      controls.innerHTML = `<button class="btn-round btn-start" id="startBtn">▶</button>`;
      document.getElementById('startBtn').addEventListener('click', async () => {
        if (document.getElementById('liveLocationToggle').checked) {
          previousGpsPosition = null;
          liveStartPending = true;
          const sharingStarted = await window.KinetixLiveShare.start(sportMeta(currentSport).label, handleLivePosition);
          if (!sharingStarted) {
            liveStartPending = false;
            return;
          }
          usesGpsDistance = true;
        }
        status = 'running';
        liveStartPending = false;
        document.getElementById('liveLocationToggle').disabled = true;
        sportPicker.style.pointerEvents = 'none';
        sportPicker.style.opacity = '0.5';
        gpsPill.hidden = false;
        recordSub.textContent = 'Tracking in progress';
        timerId = setInterval(tick, 1000);
        renderControls();
      });
    } else if (status === 'running') {
      controls.innerHTML = `
        <button class="btn-round btn-pause" id="pauseBtn">❙❙</button>
        <button class="btn-round btn-stop" id="stopBtn">■</button>`;
      document.getElementById('pauseBtn').addEventListener('click', () => {
        clearInterval(timerId);
        status = 'paused';
        if (usesGpsDistance) window.KinetixLiveShare.pause();
        renderControls();
      });
      document.getElementById('stopBtn').addEventListener('click', finishRecording);
    } else if (status === 'paused') {
      controls.innerHTML = `
        <button class="btn-round btn-start" id="resumeBtn" style="width:76px">▶</button>
        <button class="btn-round btn-stop" id="stopBtn" style="width:60px;height:60px">■</button>`;
      document.getElementById('resumeBtn').addEventListener('click', () => {
        previousGpsPosition = null;
        status = 'running';
        if (usesGpsDistance) window.KinetixLiveShare.resume();
        timerId = setInterval(tick, 1000);
        renderControls();
      });
      document.getElementById('stopBtn').addEventListener('click', finishRecording);
    }
  }

  let lastSaved = null;

  function finishRecording() {
    clearInterval(timerId);
    document.getElementById('liveLocationToggle').disabled = false;
    if (window.KinetixLiveShare?.isTracking()) {
      window.KinetixLiveShare.stop('Activity ended. Live location sharing has stopped.');
    } else {
      document.getElementById('liveLocationToggle').checked = false;
    }
    const pace = distanceKm > 0 ? (seconds / 60 / distanceKm).toFixed(2) : '0.00';
    const cal = Math.round(seconds * 0.16);
    lastSaved = { sport: currentSport, distanceKm, seconds, pace, cal, createdAt: Date.now() };

    document.getElementById('sumDistance').textContent = `${distanceKm.toFixed(2)} km`;
    document.getElementById('sumTime').textContent = formatTime(seconds);
    document.getElementById('sumPace').textContent = `${pace} /km`;
    document.getElementById('sumCal').textContent = String(cal);

    controls.hidden = true;
    sportPicker.hidden = true;
    summary.hidden = false;
  }

  document.getElementById('doneBtn').addEventListener('click', () => {
    if (lastSaved) {
      history.unshift({
        id: `activity-${lastSaved.createdAt}`,
        sport: lastSaved.sport,
        createdAt: lastSaved.createdAt,
        distance: `${lastSaved.distanceKm.toFixed(2)} km`,
        time: formatTime(lastSaved.seconds),
        pace: lastSaved.pace,
        cal: lastSaved.cal,
      });
      saveHistory();
      renderHistory();
      renderProfile();
    }
    // reset the record screen
    status = 'idle';
    seconds = 0;
    distanceKm = 0;
    previousGpsPosition = null;
    usesGpsDistance = false;
    liveStartPending = false;
    statTime.textContent = '00:00';
    statDistance.textContent = '0.00';
    statPace.textContent = '0.00';
    routePath.style.strokeDashoffset = '1000';
    gpsPill.hidden = true;
    recordSub.textContent = 'Pick a sport and hit start';
    sportPicker.hidden = false;
    sportPicker.style.pointerEvents = '';
    sportPicker.style.opacity = '';
    controls.hidden = false;
    summary.hidden = true;
    renderControls();

    // jump to history so the saved activity is visible
    document.querySelector('.tab[data-tab="history"]').click();
  });

  // ---------- share card ----------
  const shareOverlay = document.getElementById('shareOverlay');
  const sharePreview = document.getElementById('sharePreview');
  const shareMessage = document.getElementById('shareMessage');
  const shareSaveBtn = document.getElementById('shareSaveBtn');
  let currentShareBlob = null;
  let currentShareFileName = '';
  let sharePreviewUrl = null;

  function createActivityImage(activity) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not create the activity image.'));
        return;
      }

      const background = context.createLinearGradient(0, 0, 1080, 1920);
      background.addColorStop(0, '#171126');
      background.addColorStop(0.52, '#10191f');
      background.addColorStop(1, '#0b1116');
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.save();
      context.globalAlpha = 0.28;
      context.strokeStyle = '#45c8e8';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(760, 0);
      context.bezierCurveTo(530, 360, 1160, 420, 710, 850);
      context.bezierCurveTo(470, 1090, 980, 1360, 530, 1920);
      context.stroke();
      context.restore();

      context.fillStyle = '#ffffff';
      context.font = '700 48px Arial, sans-serif';
      context.fillText('KINETIX', 92, 150);
      context.fillStyle = '#80ddf2';
      context.font = '700 24px Arial, sans-serif';
      context.fillText('ACTIVITY COMPLETE', 92, 390);
      context.fillStyle = '#ffffff';
      context.font = '700 150px Arial, sans-serif';
      context.fillText(`${activity.distanceKm.toFixed(2)} km`, 84, 590);
      context.fillStyle = '#c8c5d5';
      context.font = '500 48px Arial, sans-serif';
      context.fillText(sportMeta(activity.sport).label.toUpperCase(), 92, 680);

      const panelGradient = context.createLinearGradient(92, 0, 988, 0);
      panelGradient.addColorStop(0, 'rgba(139, 47, 224, 0.32)');
      panelGradient.addColorStop(1, 'rgba(47, 180, 232, 0.22)');
      context.fillStyle = panelGradient;
      context.fillRect(72, 900, 936, 470);
      context.strokeStyle = 'rgba(255,255,255,0.16)';
      context.lineWidth = 2;
      context.strokeRect(72, 900, 936, 470);

      const stats = [
        { label: 'TIME', value: formatTime(activity.seconds), x: 124, y: 1030 },
        { label: 'PACE', value: `${activity.pace} /km`, x: 580, y: 1030 },
        { label: 'CALORIES', value: String(activity.cal), x: 124, y: 1245 },
        { label: 'SPORT', value: sportMeta(activity.sport).label, x: 580, y: 1245 },
      ];
      stats.forEach((stat) => {
        context.fillStyle = '#a9a7b8';
        context.font = '700 22px Arial, sans-serif';
        context.fillText(stat.label, stat.x, stat.y - 48);
        context.fillStyle = '#ffffff';
        context.font = '700 42px Arial, sans-serif';
        context.fillText(stat.value, stat.x, stat.y);
      });

      context.fillStyle = '#ffffff';
      context.font = '700 24px Arial, sans-serif';
      context.fillText('KEEP MOVING', 92, 1770);
      context.fillStyle = '#a9a7b8';
      context.font = '400 24px Arial, sans-serif';
      context.fillText(new Date().toLocaleDateString(), 92, 1820);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not export the activity image.'));
      }, 'image/png');
    });
  }

  function downloadImage(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareImage(blob, fileName, messageElement) {
    try {
      if (navigator.share && typeof File !== 'undefined') {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Kinetix activity', text: 'My activity on Kinetix' });
          setMessage(messageElement, 'Shared using your device\'s available apps.');
          return;
        }
      }
      downloadImage(blob, fileName);
      setMessage(messageElement, 'Image downloaded. Attach it to a post or status.');
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessage(messageElement, 'Sharing cancelled.');
        return;
      }
      downloadImage(blob, fileName);
      setMessage(messageElement, 'Image downloaded. Attach it to a post or status.');
    }
  }

  document.getElementById('shareBtn').addEventListener('click', async () => {
    if (!lastSaved) return;
    shareOverlay.hidden = false;
    sharePreview.hidden = true;
    setMessage(shareMessage, 'Preparing your activity image...');
    shareSaveBtn.disabled = true;
    try {
      currentShareBlob = await createActivityImage(lastSaved);
      currentShareFileName = `kinetix-${lastSaved.sport}-${Date.now()}.png`;
      if (sharePreviewUrl) URL.revokeObjectURL(sharePreviewUrl);
      sharePreviewUrl = URL.createObjectURL(currentShareBlob);
      sharePreview.src = sharePreviewUrl;
      sharePreview.hidden = false;
      shareMessage.hidden = true;
      shareSaveBtn.disabled = false;
    } catch (error) {
      setMessage(shareMessage, error.message, 'error');
    }
  });
  document.getElementById('shareCloseBtn').addEventListener('click', () => (shareOverlay.hidden = true));
  document.getElementById('shareDownloadBtn').addEventListener('click', () => {
    if (!currentShareBlob) return;
    downloadImage(currentShareBlob, currentShareFileName);
    setMessage(shareMessage, 'Image downloaded.');
  });
  shareSaveBtn.addEventListener('click', async () => {
    if (!currentShareBlob) return;
    shareSaveBtn.disabled = true;
    const title = `${lastSaved.distanceKm.toFixed(2)} km ${sportMeta(lastSaved.sport).label}`;
    try {
      await useGalleryStore('readwrite', (store) => store.put({
        id: `image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        blob: currentShareBlob,
        fileName: currentShareFileName,
        title,
        sportId: lastSaved.sport,
        sportLabel: sportMeta(lastSaved.sport).label,
        createdAt: lastSaved.createdAt || Date.now(),
      }));
      await renderGallery();
      setMessage(shareMessage, 'Saved to your Kinetix Gallery.');
    } catch (error) {
      setMessage(shareMessage, error.message, 'error');
    } finally {
      shareSaveBtn.disabled = false;
    }
  });
  document.getElementById('shareSystemBtn').addEventListener('click', () => {
    if (currentShareBlob) shareImage(currentShareBlob, currentShareFileName, shareMessage);
  });

  // ---------- init ----------
  setupEmojiPickers();
  renderFeed();
  renderHistory();
  renderSportPicker();
  renderControls();
})();
