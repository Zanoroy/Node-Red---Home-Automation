(function () {
  const config = {
    apiPath: "/api/power",
    refreshMs: 60_000,
    pageSize: 100
  };

  const elements = {
    apiState: document.getElementById("apiState"),
    chartCanvas: document.getElementById("powerChart"),
    chartPanel: document.getElementById("powerChartPanel"),
    tablePanel: document.getElementById("powerTablePanel"),
    chartNotice: document.getElementById("powerChartNotice"),
    circuitPicker: document.getElementById("powerCircuitPicker"),
    circuitToggle: document.getElementById("powerCircuitToggle"),
    circuitLabel: document.getElementById("powerCircuitLabel"),
    circuitMenu: document.getElementById("powerCircuitMenu"),
    circuitAll: document.getElementById("powerCircuitAll"),
    circuitOptions: document.getElementById("powerCircuitOptions"),
    clock: document.getElementById("clockValue"),
    error: document.getElementById("powerError"),
    latestLabel: document.getElementById("powerLatestLabel"),
    latest: document.getElementById("powerLatest"),
    latestCircuit: document.getElementById("powerLatestCircuit"),
    average: document.getElementById("powerAverage"),
    peak: document.getElementById("powerPeak"),
    peakCircuit: document.getElementById("powerPeakCircuit"),
    range: document.getElementById("powerRange"),
    mean: document.getElementById("powerMean"),
    readingsBody: document.getElementById("powerReadingsBody"),
    search: document.getElementById("powerSearch"),
    rowCount: document.getElementById("powerRowCount"),
    page: document.getElementById("powerPage"),
    previous: document.getElementById("powerPrevious"),
    next: document.getElementById("powerNext"),
    refresh: document.getElementById("powerRefresh"),
    updatedAt: document.getElementById("updatedAtValue"),
    drawer: document.getElementById("statusDrawer"),
    drawerToggle: document.getElementById("statusDrawerToggle"),
    drawerChevron: document.getElementById("statusDrawerChevron"),
    topDrawer: document.getElementById("powerTopDrawer"),
    topDrawerToggle: document.getElementById("powerTopDrawerToggle"),
    topDrawerChevron: document.getElementById("powerTopDrawerChevron"),
    topRange: document.getElementById("powerTopRange"),
    topStatus: document.getElementById("powerTopStatus"),
    topList: document.getElementById("powerTopList")
  };

  const state = {
    readings: [],
    chart: null,
    topDevices: [],
    page: 0,
    sortKey: "time",
    sortDirection: -1,
    loading: false,
    availableCircuits: [],
    circuitOptionsReady: false,
    appliedFilters: { range: "24h", mean: "1h", circuits: null }
  };

  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const energyFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const chartColors = ["#facc15", "#38bdf8", "#4ade80", "#fb7185", "#c084fc", "#fb923c", "#2dd4bf", "#a3e635"];

  function updateClock() {
    if (elements.clock) elements.clock.textContent = new Date().toLocaleTimeString();
  }

  function setDrawerOpen(isOpen) {
    if (!elements.drawer || !elements.drawerToggle || !elements.drawerChevron) return;
    elements.drawer.classList.toggle("open", isOpen);
    elements.drawerToggle.setAttribute("aria-expanded", String(isOpen));
    elements.drawerChevron.textContent = isOpen ? "›" : "‹";
  }

  function setError(message) {
    elements.error.textContent = message;
    elements.error.classList.toggle("d-none", !message);
  }

  function formatPower(value) {
    return `${numberFormat.format(value)} W`;
  }

  function readSavedFilters() {
    try {
      const saved = JSON.parse(window.localStorage.getItem("home.powerFilters") || "null");
      if (!saved || typeof saved !== "object") return { range: "24h", mean: "1h", circuits: null };
      return {
        range: ["1h", "6h", "24h", "7d", "30d"].includes(saved.range) ? saved.range : "24h",
        mean: ["1m", "15m", "30m", "1h", "1d", "1w", "1mo"].includes(saved.mean) ? saved.mean : "1h",
        circuits: saved.circuits === null || !Array.isArray(saved.circuits)
          ? null
          : Array.from(new Set(saved.circuits.map(String)))
      };
    } catch (error) {
      console.warn("Unable to read saved power filters.", error);
      return { range: "24h", mean: "1h", circuits: null };
    }
  }

  function getSelectedCircuitNames() {
    return Array.from(elements.circuitOptions.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => input.value)
      .sort((left, right) => left.localeCompare(right));
  }

  function getCircuitFilter() {
    const selected = getSelectedCircuitNames();
    return selected.length === state.availableCircuits.length ? null : selected;
  }

  function getSelectedFilters() {
    return {
      range: elements.range.value,
      mean: elements.mean.value,
      circuits: state.circuitOptionsReady ? getCircuitFilter() : state.appliedFilters.circuits
    };
  }

  function normalizeCircuitFilter(circuits) {
    if (circuits === null) return null;
    const normalized = Array.from(new Set(circuits)).sort((left, right) => left.localeCompare(right));
    const allSelected = normalized.length === state.availableCircuits.length
      && normalized.every((circuit, index) => circuit === state.availableCircuits[index]);
    return allSelected ? null : normalized;
  }

  function filtersMatch(left, right) {
    if (!left || !right || left.range !== right.range || left.mean !== right.mean) return false;
    const leftCircuits = normalizeCircuitFilter(left.circuits);
    const rightCircuits = normalizeCircuitFilter(right.circuits);
    if (leftCircuits === null || rightCircuits === null) return leftCircuits === rightCircuits;
    return leftCircuits.length === rightCircuits.length
      && leftCircuits.every((circuit, index) => circuit === rightCircuits[index]);
  }

  function updateRefreshIndicator() {
    const pending = !filtersMatch(getSelectedFilters(), state.appliedFilters);
    elements.refresh.classList.toggle("powerRefreshPending", pending);
    elements.refresh.setAttribute("aria-label", pending ? "Refresh to apply selected filters" : "Refresh power data");
    elements.refresh.title = pending ? "Selected filters differ from the displayed data" : "Refresh power data";
  }

  function updateCircuitSelectionSummary() {
    const selected = getSelectedCircuitNames();
    const allSelected = selected.length === state.availableCircuits.length;
    elements.circuitAll.checked = allSelected;
    elements.circuitAll.indeterminate = selected.length > 0 && !allSelected;
    elements.circuitLabel.textContent = allSelected
      ? "All circuits"
      : selected.length === 0
        ? "No circuits"
        : `${selected.length} selected`;
    updateRefreshIndicator();
  }

  function updateCircuitOptions(readings, initialSelection, additionalCircuits = []) {
    const selection = state.circuitOptionsReady ? getCircuitFilter() : initialSelection;
    const circuits = Array.from(new Set([
      ...state.availableCircuits,
      ...readings.map((reading) => reading.circuit),
      ...additionalCircuits
    ])).sort((left, right) => left.localeCompare(right));
    const unchanged = state.circuitOptionsReady
      && circuits.length === state.availableCircuits.length
      && circuits.every((circuit, index) => circuit === state.availableCircuits[index]);
    if (unchanged) {
      updateCircuitSelectionSummary();
      return;
    }

    state.availableCircuits = circuits;
    elements.circuitOptions.replaceChildren();
    const selectedCircuits = selection === null ? null : new Set(selection);
    circuits.forEach((circuit) => {
      const label = document.createElement("label");
      label.className = "powerCircuitOption";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = circuit;
      checkbox.checked = selectedCircuits === null || selectedCircuits.has(circuit);
      checkbox.addEventListener("change", updateCircuitSelectionSummary);
      const text = document.createElement("span");
      text.textContent = circuit;
      label.append(checkbox, text);
      elements.circuitOptions.append(label);
    });
    state.circuitOptionsReady = true;
    updateCircuitSelectionSummary();
  }

  function selectedReadings() {
    const circuits = state.appliedFilters.circuits;
    if (circuits === null) return state.readings;
    const selected = new Set(circuits);
    return state.readings.filter((reading) => selected.has(reading.circuit));
  }

  function updateSummary(readings) {
    if (!readings.length) {
      elements.latestLabel.textContent = "Latest interval mean";
      elements.latest.textContent = "--";
      elements.latestCircuit.textContent = "No readings for this selection";
      elements.average.textContent = "--";
      elements.peak.textContent = "--";
      elements.peakCircuit.textContent = "No readings for this selection";
      return;
    }

    const latestByCircuit = new Map();
    readings.forEach((reading) => {
      const current = latestByCircuit.get(reading.circuit);
      if (!current || reading.timestamp > current.timestamp) latestByCircuit.set(reading.circuit, reading);
    });
    const latestReadings = Array.from(latestByCircuit.values());
    const latest = latestReadings.reduce((newest, reading) => reading.timestamp > newest.timestamp ? reading : newest, latestReadings[0]);
    const isAllCircuits = state.appliedFilters.circuits === null;
    const latestPower = isAllCircuits
      ? latestReadings.reduce((total, reading) => total + reading.power, 0)
      : latest.power;
    const peak = readings.reduce((highest, reading) => reading.power > highest.power ? reading : highest, readings[0]);
    const average = readings.reduce((total, reading) => total + reading.power, 0) / readings.length;

    elements.latestLabel.textContent = isAllCircuits ? "Combined latest interval means" : "Latest circuit interval mean";
    elements.latest.textContent = formatPower(latestPower);
    elements.latestCircuit.textContent = isAllCircuits
      ? `${latestReadings.length} circuits · latest readings through ${latest.time.toLocaleString()}`
      : `${latest.circuit} · ${latest.time.toLocaleString()}`;
    elements.average.textContent = formatPower(average);
    elements.peak.textContent = formatPower(peak.power);
    elements.peakCircuit.textContent = `${peak.circuit} · ${peak.time.toLocaleString()}`;
  }

  function renderTopDevices() {
    const appliedRange = state.appliedFilters.range;
    const appliedOption = Array.from(elements.range.options).find((option) => option.value === appliedRange);
    elements.topRange.textContent = appliedOption?.textContent || appliedRange;
    elements.topList.replaceChildren();

    const selectedCircuits = state.appliedFilters.circuits;
    const devices = state.topDevices
      .filter((device) => selectedCircuits === null || selectedCircuits.includes(device.circuit))
      .sort((left, right) => right.energyKwh - left.energyKwh)
      .slice(0, 5);
    if (!devices.length) {
      elements.topStatus.textContent = "No usage data for this period.";
      return;
    }

    elements.topStatus.textContent = "";
    const maximumKwh = Math.max(...devices.map((device) => device.energyKwh));
    devices.forEach((device, index) => {
      const item = document.createElement("li");
      item.className = "powerTopItem";

      const heading = document.createElement("div");
      heading.className = "powerTopItemHeading";
      const rankAndCircuit = document.createElement("span");
      rankAndCircuit.className = "powerTopCircuit";
      rankAndCircuit.textContent = `${index + 1}. ${device.circuit}`;
      const total = document.createElement("strong");
      total.className = "powerTopTotal";
      total.textContent = `${energyFormat.format(device.energyKwh)} kWh`;
      heading.append(rankAndCircuit, total);

      const track = document.createElement("div");
      track.className = "powerTopBarTrack";
      const bar = document.createElement("div");
      bar.className = "powerTopBar";
      bar.style.width = `${maximumKwh > 0 ? Math.max(0, Math.min(100, device.energyKwh / maximumKwh * 100)) : 0}%`;
      track.append(bar);
      item.append(heading, track);
      elements.topList.append(item);
    });
  }

  function updateChart(readings) {
    if (!window.Chart) {
      elements.chartNotice.textContent = "Chart library unavailable; readings are still shown in the table.";
      elements.chartNotice.classList.remove("d-none");
      return;
    }

    const circuits = Array.from(new Set(readings.map((reading) => reading.circuit))).sort((a, b) => a.localeCompare(b));
    if (!circuits.length) {
      elements.chartNotice.textContent = "No readings for this selection.";
      elements.chartNotice.classList.remove("d-none");
      if (state.chart) {
        state.chart.data.datasets = [];
        state.chart.update();
      }
      return;
    }

    elements.chartNotice.classList.add("d-none");
    const datasets = circuits.map((circuit, index) => ({
      label: circuit,
      data: readings
        .filter((reading) => reading.circuit === circuit)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((reading) => ({ x: reading.timestamp, y: reading.power })),
      borderColor: chartColors[index % chartColors.length],
      backgroundColor: chartColors[index % chartColors.length],
      borderWidth: 1.5,
      pointRadius: 0,
      pointHitRadius: 5,
      tension: 0.15,
      spanGaps: true
    }));

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: {
          display: circuits.length > 1,
          labels: { color: "#cbd5e1", usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleString() : "",
            label: (item) => `${item.dataset.label}: ${formatPower(item.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          ticks: {
            color: "#9ca7bb",
            maxTicksLimit: 8,
            callback: (value) => {
              const date = new Date(value);
              return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            }
          },
          grid: { color: "rgba(148, 163, 184, 0.12)" }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Average power (W)", color: "#9ca7bb" },
          ticks: { color: "#9ca7bb" },
          grid: { color: "rgba(148, 163, 184, 0.12)" }
        }
      }
    };

    if (state.chart) {
      state.chart.data.datasets = datasets;
      state.chart.options = options;
      state.chart.update();
      return;
    }

    state.chart = new window.Chart(elements.chartCanvas, { type: "line", data: { datasets }, options });
  }

  function filteredSortedReadings() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    return selectedReadings()
      .filter((reading) => !query
        || reading.circuit.toLocaleLowerCase().includes(query)
        || reading.time.toLocaleString().toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        let comparison = 0;
        if (state.sortKey === "circuit") comparison = left.circuit.localeCompare(right.circuit);
        else if (state.sortKey === "power") comparison = left.power - right.power;
        else comparison = left.timestamp - right.timestamp;
        return comparison * state.sortDirection;
      });
  }

  function renderTable() {
    const readings = filteredSortedReadings();
    const pageCount = Math.max(1, Math.ceil(readings.length / config.pageSize));
    state.page = Math.min(state.page, pageCount - 1);
    const start = state.page * config.pageSize;
    const pageReadings = readings.slice(start, start + config.pageSize);

    elements.readingsBody.replaceChildren();
    if (!pageReadings.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "powerEmptyState";
      cell.textContent = state.readings.length ? "No readings match your search." : "No readings are available for this period.";
      row.append(cell);
      elements.readingsBody.append(row);
    } else {
      pageReadings.forEach((reading) => {
        const row = document.createElement("tr");
        const timeCell = document.createElement("td");
        const circuitCell = document.createElement("td");
        const powerCell = document.createElement("td");
        timeCell.textContent = reading.time.toLocaleString();
        circuitCell.textContent = reading.circuit;
        powerCell.textContent = numberFormat.format(reading.power);
        powerCell.className = "text-end fw-semibold";
        row.append(timeCell, circuitCell, powerCell);
        elements.readingsBody.append(row);
      });
    }

    elements.rowCount.textContent = `${numberFormat.format(readings.length)} readings`;
    elements.page.textContent = `Page ${state.page + 1} of ${pageCount}`;
    elements.previous.disabled = state.page === 0;
    elements.next.disabled = state.page >= pageCount - 1;
    document.querySelectorAll(".powerSortButton").forEach((button) => {
      const indicator = button.querySelector("span");
      indicator.textContent = button.dataset.sort === state.sortKey ? (state.sortDirection === 1 ? " ↑" : " ↓") : "";
    });
  }

  function render() {
    const readings = selectedReadings();
    updateSummary(readings);
    updateChart(readings);
    renderTable();
  }

  function normalizeReadings(payload) {
    if (!payload || !Array.isArray(payload.readings)) {
      throw new Error("The power API returned an invalid response.");
    }
    return payload.readings
      .map((reading) => {
        const time = new Date(reading.time);
        const power = Number(reading.power);
        const circuit = String(reading.circuit || "").trim();
        return { time, timestamp: time.getTime(), power, circuit };
      })
      .filter((reading) => Number.isFinite(reading.timestamp) && Number.isFinite(reading.power) && reading.circuit);
  }

  async function requestJson(url, failureMessage) {
    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      let message = `${failureMessage} (${response.status}).`;
      try {
        const errorPayload = await response.json();
        if (errorPayload?.error) message = errorPayload.error;
      } catch (_error) {
        // Keep the HTTP status message when the server does not return JSON.
      }
      throw new Error(message);
    }
    return response.json();
  }

  async function fetchReadings(filters) {
    const query = new URLSearchParams({ range: filters.range, mean: filters.mean });
    const payload = await requestJson(`${config.apiPath}?${query}`, "Power readings request failed");
    return { readings: normalizeReadings(payload), generatedAt: payload.generatedAt };
  }

  async function fetchTopDevices(range) {
    const payload = await requestJson(`/api/power/top?range=${encodeURIComponent(range)}`, "Top usage request failed");
    if (!payload || !Array.isArray(payload.devices)) {
      throw new Error("The top usage API returned an invalid response.");
    }
    return payload.devices
      .map((device) => ({
        circuit: String(device.circuit || "").trim(),
        energyKwh: Number(device.energyKwh)
      }))
      .filter((device) => device.circuit && Number.isFinite(device.energyKwh))
      .sort((left, right) => right.energyKwh - left.energyKwh);
  }

  function saveFilters(filters) {
    try {
      window.localStorage.setItem("home.powerFilters", JSON.stringify(filters));
    } catch (error) {
      console.warn("Unable to save power filters.", error);
      setError("The data refreshed, but the selected filters could not be saved in this browser.");
    }
  }

  async function refreshAll(filters = state.appliedFilters, persist = false) {
    if (state.loading) return false;
    state.loading = true;
    if (elements.apiState) elements.apiState.textContent = "loading";
    elements.refresh.disabled = true;
    elements.topStatus.textContent = "Loading usage…";
    try {
      const [readingsResult, topResult] = await Promise.allSettled([
        fetchReadings(filters),
        fetchTopDevices(filters.range)
      ]);
      if (readingsResult.status === "rejected") throw readingsResult.reason;

      const draftCircuits = state.circuitOptionsReady ? getCircuitFilter() : filters.circuits;
      state.readings = readingsResult.value.readings;
      state.topDevices = topResult.status === "fulfilled" ? topResult.value : [];
      state.appliedFilters = {
        range: filters.range,
        mean: filters.mean,
        circuits: filters.circuits === null ? null : filters.circuits.slice().sort()
      };
      updateCircuitOptions(
        state.readings,
        draftCircuits,
        topResult.status === "fulfilled" ? topResult.value.map((device) => device.circuit) : []
      );
      state.page = 0;
      setError("");
      if (elements.apiState) elements.apiState.textContent = "connected";
      if (elements.updatedAt) {
        elements.updatedAt.textContent = readingsResult.value.generatedAt
          ? new Date(readingsResult.value.generatedAt).toLocaleString()
          : new Date().toLocaleString();
      }
      render();
      if (topResult.status === "fulfilled") {
        renderTopDevices();
      } else {
        elements.topList.replaceChildren();
        elements.topStatus.textContent = topResult.reason?.message || "Unable to load top power usage.";
        const appliedOption = Array.from(elements.range.options).find((option) => option.value === filters.range);
        elements.topRange.textContent = appliedOption?.textContent || filters.range;
      }
      if (persist) saveFilters(state.appliedFilters);
      updateRefreshIndicator();
      return true;
    } catch (error) {
      if (elements.apiState) elements.apiState.textContent = "error";
      setError(error.message || "Unable to load power readings.");
      if (!state.readings.length) {
        elements.chartNotice.textContent = "Power readings are unavailable.";
        elements.chartNotice.classList.remove("d-none");
        elements.readingsBody.innerHTML = '<tr><td class="powerEmptyState" colspan="3">Power readings are unavailable.</td></tr>';
      }
      return false;
    } finally {
      state.loading = false;
      elements.refresh.disabled = false;
    }
  }

  function applyDraftFilters() {
    state.page = 0;
    updateRefreshIndicator();
  }

  function manualRefresh() {
    refreshAll(getSelectedFilters(), true);
  }

  elements.range.addEventListener("change", applyDraftFilters);
  elements.mean.addEventListener("change", applyDraftFilters);
  elements.circuitAll.addEventListener("change", function () {
    elements.circuitOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = elements.circuitAll.checked;
    });
    updateCircuitSelectionSummary();
  });
  elements.circuitToggle.addEventListener("click", function () {
    const isOpen = elements.circuitMenu.hidden;
    elements.circuitMenu.hidden = !isOpen;
    elements.circuitToggle.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", function (event) {
    if (!elements.circuitPicker.contains(event.target)) {
      elements.circuitMenu.hidden = true;
      elements.circuitToggle.setAttribute("aria-expanded", "false");
    }
  });
  elements.circuitPicker.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      elements.circuitMenu.hidden = true;
      elements.circuitToggle.setAttribute("aria-expanded", "false");
      elements.circuitToggle.focus();
    }
  });
  elements.search.addEventListener("input", function () {
    state.page = 0;
    renderTable();
  });
  elements.refresh.addEventListener("click", manualRefresh);
  elements.previous.addEventListener("click", function () {
    state.page = Math.max(0, state.page - 1);
    renderTable();
  });
  elements.next.addEventListener("click", function () {
    state.page += 1;
    renderTable();
  });
  document.querySelectorAll(".powerSortButton").forEach((button) => {
    button.addEventListener("click", function () {
      if (state.sortKey === button.dataset.sort) state.sortDirection *= -1;
      else {
        state.sortKey = button.dataset.sort;
        state.sortDirection = state.sortKey === "time" ? -1 : 1;
      }
      state.page = 0;
      renderTable();
    });
  });
  if (elements.drawerToggle && elements.drawer) {
    elements.drawerToggle.addEventListener("click", function () {
      setDrawerOpen(!elements.drawer.classList.contains("open"));
    });
  }
  if (elements.drawer) {
    elements.drawer.addEventListener("mouseleave", function () {
      setDrawerOpen(false);
    });
  }
  elements.topDrawerToggle.addEventListener("click", function () {
    const isOpen = elements.topDrawer.classList.toggle("open");
    elements.topDrawerToggle.setAttribute("aria-expanded", String(isOpen));
    elements.topDrawerChevron.textContent = isOpen ? "‹" : "›";
  });
  elements.topDrawer.addEventListener("mouseleave", function () {
    elements.topDrawer.classList.remove("open");
    elements.topDrawerToggle.setAttribute("aria-expanded", "false");
    elements.topDrawerChevron.textContent = "›";
  });
  [elements.chartPanel, elements.tablePanel].forEach((panel) => {
    panel.addEventListener("toggle", function () {
      if (panel.open && state.chart) {
        requestAnimationFrame(() => state.chart.resize());
      }
    });
  });

  async function init() {
    if (window.HomeAuth && typeof window.HomeAuth.requireReady === "function") {
      await window.HomeAuth.requireReady();
    }
    const savedFilters = readSavedFilters();
    state.appliedFilters = savedFilters;
    if (savedFilters.circuits !== null) state.availableCircuits = savedFilters.circuits.slice();
    elements.range.value = savedFilters.range;
    elements.mean.value = savedFilters.mean;
    updateClock();
    setInterval(updateClock, 1000);
    await refreshAll(savedFilters);
    setInterval(() => refreshAll(state.appliedFilters), config.refreshMs);
  }

  init().catch((error) => {
    console.error(error);
    setError(error.message || "Unable to initialize the power dashboard.");
  });
})();
