(function () {
  const sportName = document.getElementById('sportName');
  const liveStatus = document.getElementById('liveStatus');
  const liveUpdated = document.getElementById('liveUpdated');
  const liveCoordinates = document.getElementById('liveCoordinates');
  const mapFallback = document.getElementById('mapFallback');
  const token = window.location.pathname.split('/').filter(Boolean).pop();
  let map = null;
  let marker = null;
  let accuracyCircle = null;
  let routeLine = null;
  let hasCentered = false;
  let ended = false;

  function setStatus(text, state) {
    liveStatus.className = `live-status ${state || ''}`;
    liveStatus.lastChild.textContent = text;
  }

  function initializeMap() {
    if (!window.L) {
      mapFallback.hidden = false;
      return;
    }
    map = L.map('liveMap', { zoomControl: true }).setView([-29, 24], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    routeLine = L.polyline([], { color: '#147b5a', weight: 5, opacity: 0.85 }).addTo(map);
  }

  function updateLocation(position) {
    if (!position || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return;
    const point = [position.latitude, position.longitude];
    if (map) {
      routeLine.addLatLng(point);
      if (!marker) marker = L.marker(point, { title: 'Runner location' }).addTo(map);
      else marker.setLatLng(point);
      if (accuracyCircle) accuracyCircle.setLatLng(point).setRadius(position.accuracy || 0);
      else accuracyCircle = L.circle(point, { radius: position.accuracy || 0, color: '#147b5a', fillOpacity: 0.08, weight: 1 }).addTo(map);
      if (!hasCentered) {
        map.setView(point, 16);
        hasCentered = true;
      } else {
        map.panTo(point, { animate: true, duration: 0.5 });
      }
    }
    liveCoordinates.textContent = `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`;
    liveUpdated.textContent = `Last location update: ${new Date(position.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
  }

  function connect() {
    if (!token || ended) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/view/${encodeURIComponent(token)}`);
    socket.addEventListener('open', () => setStatus('Live', 'active'));
    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (message.type === 'snapshot') {
        sportName.textContent = message.sport || 'Activity';
        (message.route || []).forEach(updateLocation);
        updateLocation(message.latest);
        if (message.status === 'paused') {
          setStatus('Paused', '');
          liveUpdated.textContent = 'The runner has paused. The last location is shown on the map.';
        }
      } else if (message.type === 'location') {
        updateLocation(message.position);
        setStatus('Live', 'active');
      } else if (message.type === 'status') {
        if (message.status === 'paused') {
          setStatus('Paused', '');
          liveUpdated.textContent = 'The runner has paused. The last location is shown on the map.';
        } else {
          setStatus('Live', 'active');
          liveUpdated.textContent = 'The runner has resumed live location sharing.';
        }
      } else if (message.type === 'ended') {
        ended = true;
        setStatus(message.reason === 'expired' ? 'Link expired' : 'Activity ended', 'ended');
        liveUpdated.textContent = 'Live location sharing has stopped.';
      }
    });
    socket.addEventListener('close', () => {
      if (ended) return;
      setStatus('Reconnecting', '');
      window.setTimeout(connect, 3000);
    });
    socket.addEventListener('error', () => setStatus('Connection issue', 'ended'));
  }

  initializeMap();
  connect();
})();