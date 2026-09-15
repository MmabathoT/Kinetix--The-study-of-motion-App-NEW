(function () {
  // ---------- mock data ----------
  const SPORTS = [
    { id: 'run',  label: 'Run',  icon: '🏃', speed: 0.0028 },
    { id: 'ride', label: 'Ride', icon: '🚴', speed: 0.0075 },
    { id: 'swim', label: 'Swim', icon: '🏊', speed: 0.0009 },
    { id: 'hike', label: 'Hike', icon: '🥾', speed: 0.0014 },
    { id: 'gym',  label: 'Gym',  icon: '🏋️', speed: 0 },
  ];

  const FEED = [
    { name: 'Lindiwe Sithole', sport: 'ride', title: 'Morning loop before the sun got mean', distance: '32.4 km', time: '58:12', pace: '33.4 km/h', kudos: 24, comments: 3 },
    { name: 'Thabo Nkosi', sport: 'run', title: 'Easy 10K, legs felt flat', distance: '10.1 km', time: '52:03', pace: '5:09/km', kudos: 12, comments: 1 },
  ];

  let history = [];

  function sportMeta(id) { return SPORTS.find((s) => s.id === id) || SPORTS[0]; }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    document.getElementById('welcome').hidden = true;
    document.getElementById('app').hidden = false;
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
    document.getElementById('welcome').hidden = true;
    document.getElementById('app').hidden = false;
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
    contactFeedback.textContent = 'Thanks. Your message has been prepared for the Kinetix team.';
    contactFeedback.className = 'form-message success';
    contactFeedback.hidden = false;
    contactForm.reset();
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
  }

  // ---------- tabs ----------
  const tabs = document.querySelectorAll('.tab');
  const screens = {
    feed: document.getElementById('screen-feed'),
    record: document.getElementById('screen-record'),
    history: document.getElementById('screen-history'),
    profile: document.getElementById('screen-profile'),
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(screens).forEach((s) => (s.hidden = true));
      screens[tab.dataset.tab].hidden = false;
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
  function renderHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = history.map((a) => {
      const meta = sportMeta(a.sport);
      return `
        <div class="history-row">
          <div class="icon">${meta.icon}</div>
          <div class="info">
            <p class="name">${meta.label}</p>
            <p class="date">${a.date}</p>
          </div>
          <div class="figs">
            <div class="d">${a.distance}</div>
            <div class="t">${a.time}</div>
          </div>
        </div>`;
    }).join('');
  }

  // ---------- record ----------
  const sportPicker = document.getElementById('sportPicker');
  let currentSport = 'run';

  function renderSportPicker() {
    sportPicker.innerHTML = SPORTS.map((s) => `
      <button class="sport-chip ${s.id === currentSport ? 'active' : ''}" data-sport="${s.id}">
        ${s.icon} ${s.label}
      </button>`).join('');
    sportPicker.querySelectorAll('.sport-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentSport = btn.dataset.sport;
        renderSportPicker();
      });
    });
  }

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
  let status = 'idle'; // idle | running | paused

  const PATH_LENGTH = 260; // approx length of the SVG path, for the draw-on animation

  function tick() {
    seconds += 1;
    distanceKm += sportMeta(currentSport).speed;
    statTime.textContent = formatTime(seconds);
    statDistance.textContent = distanceKm.toFixed(2);
    const pace = distanceKm > 0 ? (seconds / 60 / distanceKm).toFixed(2) : '0.00';
    statPace.textContent = pace;
    const progress = Math.min(1, seconds / 90);
    routePath.style.strokeDashoffset = String(1000 - 1000 * progress);
  }

  function renderControls() {
    if (status === 'idle') {
      controls.innerHTML = `<button class="btn-round btn-start" id="startBtn">▶</button>`;
      document.getElementById('startBtn').addEventListener('click', () => {
        status = 'running';
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
        renderControls();
      });
      document.getElementById('stopBtn').addEventListener('click', finishRecording);
    } else if (status === 'paused') {
      controls.innerHTML = `
        <button class="btn-round btn-start" id="resumeBtn" style="width:76px">▶</button>
        <button class="btn-round btn-stop" id="stopBtn" style="width:60px;height:60px">■</button>`;
      document.getElementById('resumeBtn').addEventListener('click', () => {
        status = 'running';
        timerId = setInterval(tick, 1000);
        renderControls();
      });
      document.getElementById('stopBtn').addEventListener('click', finishRecording);
    }
  }

  let lastSaved = null;

  function finishRecording() {
    clearInterval(timerId);
    const pace = distanceKm > 0 ? (seconds / 60 / distanceKm).toFixed(2) : '0.00';
    const cal = Math.round(seconds * 0.16);
    lastSaved = { sport: currentSport, distanceKm, seconds, pace, cal };

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
        sport: lastSaved.sport,
        date: 'Just now',
        distance: `${lastSaved.distanceKm.toFixed(2)} km`,
        time: formatTime(lastSaved.seconds),
        cal: lastSaved.cal,
      });
      renderHistory();
      renderProfile();
    }
    // reset the record screen
    status = 'idle';
    seconds = 0;
    distanceKm = 0;
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
  document.getElementById('shareBtn').addEventListener('click', () => {
    if (!lastSaved) return;
    const meta = sportMeta(lastSaved.sport);
    document.getElementById('shareHeadline').textContent = `${lastSaved.distanceKm.toFixed(2)} km ${meta.label.toLowerCase()}`;
    document.getElementById('shareSubline').textContent = `${formatTime(lastSaved.seconds)} · ${lastSaved.pace} /km`;
    shareOverlay.hidden = false;
  });
  document.getElementById('shareCloseBtn').addEventListener('click', () => (shareOverlay.hidden = true));
  document.getElementById('shareSaveBtn').addEventListener('click', () => (shareOverlay.hidden = true));

  // ---------- init ----------
  renderFeed();
  renderHistory();
  renderSportPicker();
  renderControls();
})();
