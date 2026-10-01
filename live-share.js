(function () {
  const toggle = document.getElementById('liveLocationToggle');
  const status = document.getElementById('liveLocationStatus');
  const actions = document.getElementById('liveShareActions');
  const urlInput = document.getElementById('liveShareUrl');
  const shareButton = document.getElementById('shareLiveLinkBtn');
  const stopButton = document.getElementById('stopLiveShareBtn');
  const settingsForm = document.getElementById('liveServerForm');
  const settingsUrl = document.getElementById('liveServerUrl');
  const settingsMessage = document.getElementById('liveServerMessage');

  const state = {
    session: null,
    socket: null,
    watchId: null,
    watchKind: null,
    onPosition: null,
    localOnly: false,
    paused: false,
    creating: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
  };

  function setStatus(message, isError) {
    status.textContent = message;
    status.className = `form-message${isError ? ' error' : ''}`;
    status.hidden = false;
  }

  function isNativeApp() {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  }

  function configuredServiceUrl() {
    const configuredUrl = localStorage.getItem('kinetixLiveServiceUrl')?.trim();
    if (configuredUrl) return new URL(configuredUrl).origin;
    if (isNativeApp() || !['http:', 'https:'].includes(window.location.protocol)) return '';
    return window.location.origin;
  }

  function validateServiceUrl(value) {
    if (!value.trim()) return '';
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS server address.');
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('Live sharing on other devices requires an HTTPS server.');
    }
    return url.origin;
  }

  async function getCurrentPosition() {
    const plugin = isNativeApp() ? window.KinetixGeolocation : null;
    if (plugin) {
      const permission = await plugin.checkPermissions();
      if (permission.location !== 'granted' && permission.location !== 'limited') {
        const result = await plugin.requestPermissions();
        if (result.location !== 'granted' && result.location !== 'limited') throw new Error('Location permission is required to share a live run.');
      }
      const position = await plugin.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      return position.coords;
    }
    if (!navigator.geolocation) throw new Error('This device does not provide GPS location.');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(new Error(error.message || 'Could not read your location.')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  }

  function sendPosition(coords) {
    if (state.paused || !coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
    state.onPosition?.(coords);
    if (state.session && state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({
        type: 'location',
        position: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
      }));
    }
  }

  function startWatching() {
    if ((!state.session && !state.localOnly) || state.paused || state.watchId !== null) return;
    const options = { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 };
    const plugin = isNativeApp() ? window.KinetixGeolocation : null;
    if (plugin) {
      state.watchKind = 'plugin';
      plugin.watchPosition(options, (position, error) => {
        if (error) {
          setStatus(error.message || 'GPS signal unavailable. Sharing will resume when it returns.', true);
          return;
        }
        sendPosition(position?.coords);
      }).then((watchId) => {
        state.watchId = watchId;
      }).catch((error) => setStatus(error.message || 'Could not start GPS tracking.', true));
      return;
    }
    if (!navigator.geolocation) {
      setStatus('This device does not provide GPS location.', true);
      return;
    }
    state.watchKind = 'browser';
    state.watchId = navigator.geolocation.watchPosition(
      (position) => sendPosition(position.coords),
      (error) => setStatus(error.message || 'GPS signal unavailable. Sharing will resume when it returns.', true),
      options,
    );
  }

  async function stopWatching() {
    if (state.watchId === null) return;
    const watchId = state.watchId;
    state.watchId = null;
    if (state.watchKind === 'plugin') await window.KinetixGeolocation?.clearWatch({ id: watchId });
    else navigator.geolocation?.clearWatch(watchId);
    state.watchKind = null;
  }

  function scheduleOwnerReconnect(serviceOrigin, session) {
    if (state.reconnectTimer || state.session?.sessionId !== session.sessionId) return;
    const delay = Math.min(30000, 1000 * (2 ** Math.min(state.reconnectAttempts, 5)));
    state.reconnectAttempts += 1;
    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      if (state.session?.sessionId !== session.sessionId) return;
      openOwnerSocket(serviceOrigin, session, true).catch(() => {
        setStatus('Connection unavailable. Retrying…', true);
        scheduleOwnerReconnect(serviceOrigin, session);
      });
    }, delay);
  }

  function openOwnerSocket(serviceOrigin, session, reconnecting) {
    return new Promise((resolve, reject) => {
      const socketUrl = new URL(`/ws/owner/${session.sessionId}`, serviceOrigin);
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(socketUrl);
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) reject(new Error('Live service did not respond.'));
        socket.close();
      }, 10000);

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'auth', token: session.ownerToken }));
      });
      socket.addEventListener('message', (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }
        if (message.type === 'ready' && !settled) {
          settled = true;
          window.clearTimeout(timeout);
          state.socket = socket;
          state.reconnectAttempts = 0;
          if (reconnecting) setStatus('Live location connection restored.');
          resolve();
        }
      });
      socket.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error('Could not connect to the live location service.'));
      });
      socket.addEventListener('close', () => {
        if (state.socket === socket) state.socket = null;
        if (settled && state.session?.sessionId === session.sessionId) {
          setStatus('Connection lost. Reconnecting…', true);
          scheduleOwnerReconnect(serviceOrigin, session);
        }
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error('Live service closed the connection.'));
        }
      });
    });
  }

  async function start(sport, onPosition) {
    if (!toggle.checked || state.session || state.creating) return Boolean(state.session);
    state.creating = true;
    toggle.disabled = true;
    setStatus('Waiting for GPS permission and location…');
    let session;
    try {
      const serviceOrigin = configuredServiceUrl();
      if (!serviceOrigin) throw new Error('Set the live sharing HTTPS address in Settings > App first.');
      const initialCoords = await getCurrentPosition();
      const response = await fetch(`${serviceOrigin}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: window.KinetixSportName?.(sport) || sport,
          position: { latitude: initialCoords.latitude, longitude: initialCoords.longitude, accuracy: initialCoords.accuracy },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start live sharing.');
      session = { ...result, serviceOrigin };
      state.session = session;
      state.onPosition = onPosition;
      state.localOnly = false;
      state.paused = false;
      await openOwnerSocket(serviceOrigin, session);
      sendPosition(initialCoords);
      urlInput.value = session.shareUrl;
      actions.hidden = false;
      shareButton.disabled = false;
      stopButton.hidden = false;
      setStatus('Live location is being shared. Anyone with this private link can view it.');
      startWatching();
      return true;
    } catch (error) {
      if (session) {
        await fetch(`${session.serviceOrigin}/api/live-sessions/${session.sessionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.ownerToken}` },
        }).catch(() => {});
      }
      state.session = null;
      state.socket = null;
      state.localOnly = false;
      state.paused = false;
      window.clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
      toggle.checked = false;
      actions.hidden = true;
      setStatus(error.message || 'Live sharing could not start.', true);
      return false;
    } finally {
      state.creating = false;
      toggle.disabled = false;
    }
  }

  async function stop(reason, keepTracking) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
    if (!keepTracking) {
      await stopWatching();
      state.onPosition = null;
      state.localOnly = false;
      state.paused = false;
    } else {
      state.localOnly = true;
    }
    const session = state.session;
    state.session = null;
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
    if (session) {
      await fetch(`${session.serviceOrigin}/api/live-sessions/${session.sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.ownerToken}` },
      }).catch(() => {});
    }
    if (keepTracking && !state.paused) startWatching();
    toggle.checked = false;
    actions.hidden = true;
    shareButton.disabled = true;
    stopButton.hidden = true;
    if (reason) setStatus(reason);
  }

  async function pause() {
    if (state.paused) return;
    state.paused = true;
    await stopWatching();
    if (state.session && state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: 'status', status: 'paused' }));
    }
    setStatus(state.localOnly ? 'GPS distance paused.' : 'Live location paused with your activity.');
  }

  function resume() {
    if (!state.paused) return;
    state.paused = false;
    if (state.session && state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: 'status', status: 'live' }));
    }
    startWatching();
    setStatus(state.localOnly ? 'GPS distance resumed on this device.' : 'Live location sharing resumed.');
  }

  async function shareLink() {
    if (!state.session) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kinetix live location', text: 'Follow my live activity location.', url: state.session.shareUrl });
        return;
      }
      await navigator.clipboard.writeText(state.session.shareUrl);
      setStatus('Live link copied. Send it to the people you want to share with.');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('Could not share the link. Copy it from the link field.', true);
    }
  }

  toggle.addEventListener('change', () => {
    if (toggle.checked) setStatus('Location sharing will start when you start recording.');
    else if (state.session) stop('Live location sharing stopped. Recording can continue.', true);
    else setStatus('Only people with your link can see your live location.');
  });
  shareButton.addEventListener('click', shareLink);
  stopButton.addEventListener('click', () => stop('Live location sharing stopped. Recording can continue.', true));

  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const serviceOrigin = validateServiceUrl(settingsUrl.value);
      if (serviceOrigin) localStorage.setItem('kinetixLiveServiceUrl', serviceOrigin);
      else localStorage.removeItem('kinetixLiveServiceUrl');
      settingsMessage.textContent = serviceOrigin ? 'Live sharing server saved.' : 'Using this website’s server.';
      settingsMessage.className = 'form-message success';
      settingsMessage.hidden = false;
    } catch (error) {
      settingsMessage.textContent = error.message;
      settingsMessage.className = 'form-message error';
      settingsMessage.hidden = false;
    }
  });
  settingsForm.addEventListener('reset', () => { settingsMessage.hidden = true; });
  settingsUrl.value = localStorage.getItem('kinetixLiveServiceUrl') || '';

  window.KinetixLiveShare = {
    isActive: () => Boolean(state.session),
    isTracking: () => Boolean(state.session || state.localOnly),
    start,
    stop,
    pause,
    resume,
  };
})();