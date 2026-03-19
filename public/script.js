const INITIAL_MAP_CENTER = [-15.0, -60.0];
const INITIAL_MAP_ZOOM = 3;

// Initialize map centered on South America
const map = L.map('map').setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM);

const LINE_COLORS = {
    existing: '#60a5fa',
    candidate: '#f87171',
    selected: '#34d399',
    neutral: '#64748b',
    highlight: '#fbbf24'
};

const MENU_THEME = {
    bg: '#242838',
    border: '#2e3348',
    hover: '#2a2f42',
    text: '#edf0f5',
    danger: '#f87171',
    accent: '#818cf8'
};

const FLOW_ANIMATION_MIN_MW = 0.1;
const FLOW_ANIMATION_MAX_SPEED_S = 6;
const FLOW_ANIMATION_MIN_SPEED_S = 3;
const FLOW_ARROW_SPEED_FACTOR = 6;
const FLOW_ARROW_MIN_ZOOM = 5;

const NODE_LABEL_ZOOM_THRESHOLD = 5;
const NODE_META_ZOOM_THRESHOLD = 6;
const NODE_DOT_RADIUS_MIN = 3;
const NODE_DOT_RADIUS_MAX = 7;
const NODE_LABEL_ANCHOR_OFFSET_X = 8;
const NODE_LABEL_ANCHOR_OFFSET_Y = -8;
const NODE_CONNECTOR_LABEL_TRIM_PX = 3;
const NODE_LABEL_FORCE_REPULSION = 0.2;
const NODE_LABEL_FORCE_GRAVITY = 0.08;
const NODE_LABEL_FORCE_DAMPING = 0.82;
const NODE_LABEL_FORCE_ITER_MIN = 12;
const NODE_LABEL_FORCE_ITER_MAX = 30;

const NODE_OFFSETS_STORAGE_KEY = 'oirse.node.offsets.v1';
let nodeLayers = [];
let nodeOffsetsStore = loadNodeOffsetsStore();
let nodeDeclutterFrame = null;

function isNearInitialMapView() {
    const center = map.getCenter();
    const zoomDiff = Math.abs(map.getZoom() - INITIAL_MAP_ZOOM);
    const latDiff = Math.abs(center.lat - INITIAL_MAP_CENTER[0]);
    const lonDiff = Math.abs(center.lng - INITIAL_MAP_CENTER[1]);

    return zoomDiff < 0.35 && latDiff < 1.2 && lonDiff < 1.2;
}

function updateHeaderCompactState(forceCompact = null) {
    const shouldCompact = typeof forceCompact === 'boolean'
        ? forceCompact
        : !isNearInitialMapView();
    document.body.classList.toggle('has-compact-header', shouldCompact);
}

function goToHomeMapView() {
    map.setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM, { animate: true });
    updateHeaderCompactState(false);
}

function addMapHomeControl() {
    const zoomContainer = map.zoomControl && map.zoomControl._container;
    if (!zoomContainer) return;
    if (zoomContainer.querySelector('.leaflet-control-zoom-home')) return;

    const homeBtn = L.DomUtil.create('a', 'leaflet-control-zoom-home', zoomContainer);
    homeBtn.href = '#';
    homeBtn.setAttribute('role', 'button');
    homeBtn.setAttribute('aria-label', 'Volver al zoom inicial');
    homeBtn.title = 'Volver al zoom inicial';
    homeBtn.innerHTML = `
        <span class="zoom-home-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M3 10.5L12 3l9 7.5"></path>
                <path d="M6.5 9.8V21h11V9.8"></path>
                <path d="M9.5 21v-6h5v6"></path>
            </svg>
        </span>
    `;

    if (window.L && L.DomEvent) {
        L.DomEvent.disableClickPropagation(homeBtn);
        L.DomEvent.disableScrollPropagation(homeBtn);
        L.DomEvent.on(homeBtn, 'click', (event) => {
            L.DomEvent.stop(event);
            goToHomeMapView();
        });
    } else {
        homeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            goToHomeMapView();
        });
    }
}

map.whenReady(() => {
    addMapHomeControl();
    updateHeaderCompactState(false);
});

function loadNodeOffsetsStore() {
    try {
        const raw = localStorage.getItem(NODE_OFFSETS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('No se pudo leer offsets de nodos desde localStorage:', error);
        return {};
    }
}

function persistNodeOffsetsStore() {
    try {
        localStorage.setItem(NODE_OFFSETS_STORAGE_KEY, JSON.stringify(nodeOffsetsStore));
    } catch (error) {
        console.warn('No se pudo guardar offsets de nodos:', error);
    }
}

function getScenarioKey() {
    const scenarioSelect = document.getElementById('visualize-scenario');
    return scenarioSelect ? scenarioSelect.value : 'S1';
}

function getScenarioOffsets(scenario) {
    if (!nodeOffsetsStore[scenario]) nodeOffsetsStore[scenario] = {};
    return nodeOffsetsStore[scenario];
}

function getMaxNodeOffsetPx() {
    // Keeps nodes close to their geographic anchor while still allowing declutter.
    return Math.min(52, 14 + map.getZoom() * 3);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getNodeId(point) {
    const nodeName = point.node || 'NODO';
    const country = point.country || 'XX';
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    return `${country}::${nodeName}::${lat.toFixed(4)}::${lon.toFixed(4)}`;
}

function clearNetworkNodes() {
    if (nodeDeclutterFrame !== null) {
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(nodeDeclutterFrame);
        } else {
            clearTimeout(nodeDeclutterFrame);
        }
        nodeDeclutterFrame = null;
    }

    nodeLayers.forEach(({ dotMarker, labelMarker, connectorLine }) => {
        if (dotMarker) map.removeLayer(dotMarker);
        if (labelMarker) map.removeLayer(labelMarker);
        if (connectorLine) map.removeLayer(connectorLine);
    });
    nodeLayers = [];
}

function buildNodesFromLines(lines) {
    const nodesById = new Map();

    function upsertNode(point) {
        if (!point || Number.isNaN(Number(point.lat)) || Number.isNaN(Number(point.lon))) {
            return null;
        }
        const id = getNodeId(point);
        if (!nodesById.has(id)) {
            nodesById.set(id, {
                id,
                name: point.node || id,
                country: point.country || '',
                lat: Number(point.lat),
                lon: Number(point.lon),
                degree: 0,
                existingCount: 0,
                candidateCount: 0,
                selectedCount: 0
            });
        }
        return nodesById.get(id);
    }

    lines.forEach(line => {
        const start = upsertNode(line.start);
        const end = upsertNode(line.end);
        if (!start || !end) return;

        start.degree += 1;
        end.degree += 1;

        if (line.status === 'Candidata') {
            start.candidateCount += 1;
            end.candidateCount += 1;
        } else if (line.status === 'Existente') {
            start.existingCount += 1;
            end.existingCount += 1;
        }

        if (line.X_LN !== undefined && Number(line.X_LN) > 0.9) {
            start.selectedCount += 1;
            end.selectedCount += 1;
        }
    });

    return Array.from(nodesById.values());
}

function getNodeVisualClass(node) {
    if (node.selectedCount > 0) return 'network-node--selected';
    if (node.candidateCount > 0) return 'network-node--candidate';
    if (node.existingCount > 0) return 'network-node--existing';
    return 'network-node--neutral';
}

function getNodeDotFillColor(node) {
    if (node.selectedCount > 0) return LINE_COLORS.selected;
    if (node.candidateCount > 0) return LINE_COLORS.candidate;
    if (node.existingCount > 0) return '#22d3ee';
    return LINE_COLORS.neutral;
}

function getNodeDotRadius() {
    const zoom = map.getZoom();
    const t = clamp((zoom - 3) / 4, 0, 1);
    return NODE_DOT_RADIUS_MIN + t * (NODE_DOT_RADIUS_MAX - NODE_DOT_RADIUS_MIN);
}

function getNodeDotStrokeWeight(radius) {
    return clamp(radius * 0.35, 1.1, 2.2);
}

function getNodeConnectorColor(node) {
    if (node.selectedCount > 0) return 'rgba(52, 211, 153, 0.72)';
    if (node.candidateCount > 0) return 'rgba(248, 113, 113, 0.72)';
    if (node.existingCount > 0) return 'rgba(34, 211, 238, 0.72)';
    return 'rgba(148, 163, 184, 0.62)';
}

function getNodeConnectorLatLngs(node, labelLatLng) {
    const dotPoint = map.latLngToLayerPoint([node.lat, node.lon]);
    const rawLabelPoint = map.latLngToLayerPoint(labelLatLng);
    const labelPoint = L.point(
        rawLabelPoint.x + NODE_LABEL_ANCHOR_OFFSET_X,
        rawLabelPoint.y + NODE_LABEL_ANCHOR_OFFSET_Y
    );

    const dx = labelPoint.x - dotPoint.x;
    const dy = labelPoint.y - dotPoint.y;
    const distance = Math.hypot(dx, dy);

    if (!Number.isFinite(distance) || distance < 1e-6) {
        const same = map.layerPointToLatLng(dotPoint);
        return [same, same];
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const dotTrim = getNodeDotRadius() + 1.4;
    const labelTrim = NODE_CONNECTOR_LABEL_TRIM_PX;
    const startPoint = L.point(dotPoint.x + ux * dotTrim, dotPoint.y + uy * dotTrim);
    const endPoint = L.point(labelPoint.x - ux * labelTrim, labelPoint.y - uy * labelTrim);

    return [map.layerPointToLatLng(startPoint), map.layerPointToLatLng(endPoint)];
}

function updateNodeConnector(layerEntry) {
    const { nodeData, labelMarker, connectorLine } = layerEntry;
    if (!nodeData || !labelMarker || !connectorLine) return;
    connectorLine.setLatLngs(getNodeConnectorLatLngs(nodeData, labelMarker.getLatLng()));
}

function updateNetworkNodeConnectors() {
    nodeLayers.forEach(layerEntry => updateNodeConnector(layerEntry));
}

function getNodeLabelApproxSize(node, showMeta) {
    const nameText = String(node.name || '');
    const metaText = String(node.country || '');
    const nameWidth = Math.max(42, nameText.length * 6.4 + 16);
    const metaWidth = showMeta ? Math.max(22, metaText.length * 5.4 + 12) : 0;
    const width = Math.max(nameWidth, metaWidth);
    const height = showMeta ? 30 : 18;
    return { width, height };
}

function runNodeLabelForceLayout() {
    const zoom = map.getZoom();
    if (zoom <= NODE_LABEL_ZOOM_THRESHOLD || nodeLayers.length < 2) {
        return;
    }

    const scenario = getScenarioKey();
    const maxOffset = getMaxNodeOffsetPx();
    const showMeta = zoom >= NODE_META_ZOOM_THRESHOLD;
    const items = [];

    nodeLayers.forEach((entry) => {
        const node = entry.nodeData;
        const labelMarker = entry.labelMarker;
        if (!node || !labelMarker) return;

        const anchorPoint = map.latLngToLayerPoint([node.lat, node.lon]);
        const markerPoint = map.latLngToLayerPoint(labelMarker.getLatLng());
        const currentX = markerPoint.x + NODE_LABEL_ANCHOR_OFFSET_X;
        const currentY = markerPoint.y + NODE_LABEL_ANCHOR_OFFSET_Y;
        const targetOffset = getNodeOffset(node, scenario);
        const targetMarkerPoint = map.latLngToLayerPoint(
            markerLatLngFromAnchor(node, targetOffset.dx, targetOffset.dy)
        );
        const { width, height } = getNodeLabelApproxSize(node, showMeta);

        items.push({
            entry,
            node,
            anchorX: anchorPoint.x,
            anchorY: anchorPoint.y,
            x: currentX,
            y: currentY,
            vx: 0,
            vy: 0,
            width,
            height,
            targetX: targetMarkerPoint.x + NODE_LABEL_ANCHOR_OFFSET_X,
            targetY: targetMarkerPoint.y + NODE_LABEL_ANCHOR_OFFSET_Y
        });
    });

    if (items.length < 2) return;

    const iterations = Math.round(clamp(
        NODE_LABEL_FORCE_ITER_MIN + items.length * 0.22,
        NODE_LABEL_FORCE_ITER_MIN,
        NODE_LABEL_FORCE_ITER_MAX
    ));

    for (let iter = 0; iter < iterations; iter += 1) {
        items.forEach((item) => {
            item.vx = (item.vx + (item.targetX - item.x) * NODE_LABEL_FORCE_GRAVITY) * NODE_LABEL_FORCE_DAMPING;
            item.vy = (item.vy + (item.targetY - item.y) * NODE_LABEL_FORCE_GRAVITY) * NODE_LABEL_FORCE_DAMPING;
        });

        for (let i = 0; i < items.length; i += 1) {
            const a = items[i];
            const ax1 = a.x;
            const ay1 = a.y;
            const ax2 = ax1 + a.width;
            const ay2 = ay1 + a.height;
            const acx = ax1 + a.width / 2;
            const acy = ay1 + a.height / 2;

            for (let j = i + 1; j < items.length; j += 1) {
                const b = items[j];
                const bx1 = b.x;
                const by1 = b.y;
                const bx2 = bx1 + b.width;
                const by2 = by1 + b.height;

                const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
                const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
                if (overlapX <= 0 || overlapY <= 0) continue;

                const bcx = bx1 + b.width / 2;
                const bcy = by1 + b.height / 2;
                let dx = acx - bcx;
                let dy = acy - bcy;
                const dist = Math.hypot(dx, dy) || 1;
                dx /= dist;
                dy /= dist;

                const push = (Math.min(overlapX, overlapY) + 2) * NODE_LABEL_FORCE_REPULSION;
                a.vx += dx * push;
                a.vy += dy * push;
                b.vx -= dx * push;
                b.vy -= dy * push;
            }
        }

        items.forEach((item) => {
            item.x += item.vx;
            item.y += item.vy;

            const rawDx = item.x - NODE_LABEL_ANCHOR_OFFSET_X - item.anchorX;
            const rawDy = item.y - NODE_LABEL_ANCHOR_OFFSET_Y - item.anchorY;
            const clampedDx = clamp(rawDx, -maxOffset, maxOffset);
            const clampedDy = clamp(rawDy, -maxOffset, maxOffset);

            item.x = item.anchorX + clampedDx + NODE_LABEL_ANCHOR_OFFSET_X;
            item.y = item.anchorY + clampedDy + NODE_LABEL_ANCHOR_OFFSET_Y;
        });
    }

    items.forEach((item) => {
        const markerPoint = L.point(
            item.x - NODE_LABEL_ANCHOR_OFFSET_X,
            item.y - NODE_LABEL_ANCHOR_OFFSET_Y
        );
        const dx = clamp(markerPoint.x - item.anchorX, -maxOffset, maxOffset);
        const dy = clamp(markerPoint.y - item.anchorY, -maxOffset, maxOffset);

        item.entry.labelMarker.setLatLng(map.layerPointToLatLng(markerPoint));
        setNodeOffset(item.node, scenario, dx, dy, false);
        updateNodeConnector(item.entry);
    });
}

function scheduleNodeLabelDeclutter() {
    if (nodeDeclutterFrame !== null) {
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(nodeDeclutterFrame);
        } else {
            clearTimeout(nodeDeclutterFrame);
        }
    }

    const run = () => {
        nodeDeclutterFrame = null;
        runNodeLabelForceLayout();
    };

    if (typeof requestAnimationFrame === 'function') {
        nodeDeclutterFrame = requestAnimationFrame(run);
    } else {
        nodeDeclutterFrame = setTimeout(run, 16);
    }
}

function getLineFlowMw(line) {
    if (!line) return null;
    const rawValue =
        line.flowP1 ??
        line.Flow_P1 ??
        line.flow_p1 ??
        line.flowP ??
        line.FlowP1;

    if (Number.isFinite(Number(rawValue))) {
        return Number(rawValue);
    }
    return null;
}

function getAnnualNetFlowSummary(line, flowData) {
    if (!line) return null;

    const flowsByLine = flowData && flowData.flows ? flowData.flows : null;
    const series = flowsByLine ? flowsByLine[line.name] : null;
    if (Array.isArray(series) && series.length > 0) {
        const numericSeries = series
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));

        if (numericSeries.length > 0) {
            const netMw = numericSeries.reduce((sum, value) => sum + value, 0);
            const avgAbsMw = numericSeries.reduce((sum, value) => sum + Math.abs(value), 0) / numericSeries.length;
            return { netMw, speedMw: avgAbsMw };
        }
    }

    const fallbackFlow = getLineFlowMw(line);
    if (fallbackFlow === null) return null;
    return { netMw: fallbackFlow, speedMw: Math.abs(fallbackFlow) };
}

function getFlowAnimationDurationSec(flowMw) {
    const absFlow = Math.abs(flowMw);
    return clamp(
        FLOW_ANIMATION_MAX_SPEED_S - absFlow / 80,
        FLOW_ANIMATION_MIN_SPEED_S,
        FLOW_ANIMATION_MAX_SPEED_S
    );
}

function configureFlowLayerAnimation(flowLayer, directionMw, speedMw) {
    const applyStyle = () => {
        const path = flowLayer.getElement();
        if (!path) return false;
        const flowSpeed = Number.isFinite(Number(speedMw)) ? Number(speedMw) : Math.abs(Number(directionMw) || 0);
        path.style.animationDuration = `${getFlowAnimationDurationSec(flowSpeed)}s`;
        path.style.animationDirection = Number(directionMw) < 0 ? 'reverse' : 'normal';
        return true;
    };

    if (applyStyle()) return;

    const retry = () => {
        if (!applyStyle()) {
            setTimeout(applyStyle, 50);
        }
    };

    flowLayer.once('add', retry);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(retry);
    } else {
        setTimeout(retry, 16);
    }
}

function getFlowArrowAngleDeg(fromLatLng, toLatLng) {
    const fromPoint = map.latLngToLayerPoint(fromLatLng);
    const toPoint = map.latLngToLayerPoint(toLatLng);
    return Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x) * (180 / Math.PI);
}

function buildFlowArrowMarker(initialLatLng) {
    const arrowIcon = L.divIcon({
        className: 'line-flow-arrow-icon',
        html: `
            <div class="line-flow-arrow-wrap">
                <svg class="line-flow-arrow" viewBox="-9 -9 18 18" aria-hidden="true" focusable="false">
                    <path class="line-flow-arrow-shaft" d="M -6 0 L 3 0"></path>
                    <path class="line-flow-arrow-head" d="M 0 -3 L 4 0 L 0 3"></path>
                </svg>
            </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    return L.marker(initialLatLng, {
        pane: 'flowArrowsPane',
        icon: arrowIcon,
        interactive: false,
        keyboard: false
    });
}

function hashStringStable(value) {
    const text = String(value || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function updateFlowArrowVisual(entry) {
    if (!entry || !entry.marker) return;
    const markerEl = entry.marker.getElement();
    if (!markerEl) return;
    const arrowEl = markerEl.querySelector('.line-flow-arrow');
    if (!arrowEl) return;
    const angle = getFlowArrowAngleDeg(entry.fromLatLng, entry.toLatLng);
    arrowEl.style.transform = `rotate(${angle.toFixed(2)}deg)`;
}

function updateFlowArrowPathPosition(entry, progress) {
    if (!entry || !entry.marker) return;
    const t = clamp(progress, 0, 1);
    const fromPoint = map.latLngToLayerPoint(entry.fromLatLng);
    const toPoint = map.latLngToLayerPoint(entry.toLatLng);
    const currentPoint = L.point(
        fromPoint.x + (toPoint.x - fromPoint.x) * t,
        fromPoint.y + (toPoint.y - fromPoint.y) * t
    );
    entry.marker.setLatLng(map.layerPointToLatLng(currentPoint));
}

function stopFlowArrowAnimation() {
    if (flowArrowAnimationFrame === null) return;
    if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(flowArrowAnimationFrame);
    } else {
        clearTimeout(flowArrowAnimationFrame);
    }
    flowArrowAnimationFrame = null;
}

function animateFlowArrows(timestamp) {
    if (!flowArrowLayers.length) {
        flowArrowAnimationFrame = null;
        return;
    }

    const showArrows = map.getZoom() >= FLOW_ARROW_MIN_ZOOM;
    if (!showArrows) {
        flowArrowLayers.forEach((entry) => {
            if (entry && entry.marker) {
                entry.marker.setOpacity(0);
            }
        });
        flowArrowAnimationFrame = null;
        return;
    }

    flowArrowLayers.forEach((entry) => {
        if (!entry || !entry.marker) return;
        entry.marker.setOpacity(1);
        const durationMs = Math.max(320, Number(entry.durationMs) || 1200);
        const phaseMs = Number(entry.phaseMs) || 0;
        const progress = ((timestamp + phaseMs) % durationMs) / durationMs;
        updateFlowArrowPathPosition(entry, progress);
    });

    if (typeof requestAnimationFrame === 'function') {
        flowArrowAnimationFrame = requestAnimationFrame(animateFlowArrows);
    } else {
        flowArrowAnimationFrame = setTimeout(() => animateFlowArrows(Date.now()), 16);
    }
}

function startFlowArrowAnimation() {
    if (!flowArrowLayers.length) return;
    if (map.getZoom() < FLOW_ARROW_MIN_ZOOM) return;
    if (flowArrowAnimationFrame !== null) return;
    if (typeof requestAnimationFrame === 'function') {
        flowArrowAnimationFrame = requestAnimationFrame(animateFlowArrows);
    } else {
        flowArrowAnimationFrame = setTimeout(() => animateFlowArrows(Date.now()), 16);
    }
}

function refreshFlowArrowGeometry() {
    const showArrows = map.getZoom() >= FLOW_ARROW_MIN_ZOOM;
    flowArrowLayers.forEach((entry) => {
        if (!entry || !entry.marker) return;
        entry.marker.setOpacity(showArrows ? 1 : 0);
        if (showArrows) {
            updateFlowArrowVisual(entry);
        }
    });

    if (showArrows) {
        startFlowArrowAnimation();
    } else {
        stopFlowArrowAnimation();
    }
}

function markerLatLngFromAnchor(node, dx, dy) {
    const anchorPoint = map.latLngToLayerPoint([node.lat, node.lon]);
    const layerPoint = L.point(anchorPoint.x + dx, anchorPoint.y + dy);
    return map.layerPointToLatLng(layerPoint);
}

function getNodeOffset(node, scenario) {
    const offsets = getScenarioOffsets(scenario);
    const offset = offsets[node.id] || { dx: 0, dy: 0 };
    return {
        dx: Number(offset.dx) || 0,
        dy: Number(offset.dy) || 0
    };
}

function setNodeOffset(node, scenario, dx, dy, persist = false) {
    const offsets = getScenarioOffsets(scenario);
    offsets[node.id] = { dx, dy };
    if (persist) persistNodeOffsetsStore();
}

function updateNodeOffsetFromMarker(marker, persist = false) {
    const scenario = getScenarioKey();
    const node = marker.nodeData;
    const anchorPoint = map.latLngToLayerPoint([node.lat, node.lon]);
    const markerPoint = map.latLngToLayerPoint(marker.getLatLng());
    const maxOffset = getMaxNodeOffsetPx();
    const dx = clamp(markerPoint.x - anchorPoint.x, -maxOffset, maxOffset);
    const dy = clamp(markerPoint.y - anchorPoint.y, -maxOffset, maxOffset);

    setNodeOffset(node, scenario, dx, dy, persist);

    const clampedLatLng = markerLatLngFromAnchor(node, dx, dy);
    marker.setLatLng(clampedLatLng);
}

function resetNodeOffset(marker) {
    const scenario = getScenarioKey();
    const node = marker.nodeData;
    setNodeOffset(node, scenario, 0, 0, true);
    marker.setLatLng(markerLatLngFromAnchor(node, 0, 0));
}

function refreshNetworkNodePositions() {
    const scenario = getScenarioKey();
    nodeLayers.forEach(layerEntry => {
        const { nodeData, labelMarker, dotMarker } = layerEntry;
        const node = nodeData;
        const offset = getNodeOffset(node, scenario);
        if (labelMarker) {
            labelMarker.setLatLng(markerLatLngFromAnchor(node, offset.dx, offset.dy));
        }
        if (dotMarker) {
            dotMarker.setLatLng([node.lat, node.lon]);
        }
        updateNodeConnector(layerEntry);
    });
}

function updateNetworkNodeDetailVisibility() {
    const zoom = map.getZoom();
    nodeLayers.forEach(({ labelMarker, connectorLine }) => {
        const markerEl = labelMarker ? labelMarker.getElement() : null;
        if (!markerEl) return;
        const nodeEl = markerEl.querySelector('.network-node-label');
        if (!nodeEl) return;

        const hideLabel = zoom <= NODE_LABEL_ZOOM_THRESHOLD;
        nodeEl.classList.toggle('network-node-label--hide-label', hideLabel);
        nodeEl.classList.toggle('network-node-label--hide-meta', zoom < NODE_META_ZOOM_THRESHOLD);
        if (connectorLine) {
            connectorLine.setStyle({ opacity: hideLabel ? 0 : 0.78 });
        }
    });
}

function updateNetworkNodeDotScale() {
    const radius = getNodeDotRadius();
    const weight = getNodeDotStrokeWeight(radius);
    nodeLayers.forEach(({ dotMarker }) => {
        if (!dotMarker) return;
        dotMarker.setRadius(radius);
        dotMarker.setStyle({ weight });
    });
    updateNetworkNodeConnectors();
}

function renderNetworkNodes(lines) {
    clearNetworkNodes();

    if (!map.getPane('nodesDotPane')) {
        map.createPane('nodesDotPane');
        map.getPane('nodesDotPane').style.zIndex = 675;
    }

    if (!map.getPane('nodesConnectorPane')) {
        map.createPane('nodesConnectorPane');
        map.getPane('nodesConnectorPane').style.zIndex = 678;
        map.getPane('nodesConnectorPane').style.pointerEvents = 'none';
    }

    if (!map.getPane('nodesLabelPane')) {
        map.createPane('nodesLabelPane');
        map.getPane('nodesLabelPane').style.zIndex = 680;
    }

    const scenario = getScenarioKey();
    const nodes = buildNodesFromLines(lines);
    const dotRadius = getNodeDotRadius();
    const dotWeight = getNodeDotStrokeWeight(dotRadius);

    nodes.forEach(node => {
        const offset = getNodeOffset(node, scenario);
        const iconClass = getNodeVisualClass(node);
        const labelIcon = L.divIcon({
            className: 'network-node-label-icon',
            html: `
                <div class="network-node-label ${iconClass}">
                    <div class="network-node__label">${escapeHtml(node.name)}</div>
                    <div class="network-node__meta">${escapeHtml(node.country)}</div>
                </div>
            `,
            iconSize: [1, 1],
            iconAnchor: [0, 0]
        });

        const labelMarker = L.marker(markerLatLngFromAnchor(node, offset.dx, offset.dy), {
            pane: 'nodesLabelPane',
            icon: labelIcon,
            draggable: true,
            keyboard: false,
            autoPan: false,
            riseOnHover: true
        }).addTo(map);

        const dotMarker = L.circleMarker([node.lat, node.lon], {
            pane: 'nodesDotPane',
            radius: dotRadius,
            color: '#0f1117',
            weight: dotWeight,
            fillColor: getNodeDotFillColor(node),
            fillOpacity: 1,
            opacity: 1,
            className: `network-node-dot ${iconClass}`
        }).addTo(map);

        const connectorLine = L.polyline(
            getNodeConnectorLatLngs(node, labelMarker.getLatLng()),
            {
                pane: 'nodesConnectorPane',
                color: getNodeConnectorColor(node),
                weight: 1.2,
                opacity: 0.78,
                interactive: false,
                className: `network-node-connector ${iconClass}`
            }
        ).addTo(map);

        const layerEntry = { nodeData: node, dotMarker, labelMarker, connectorLine };

        labelMarker.nodeData = node;
        labelMarker.on('move', () => updateNodeConnector(layerEntry));
        labelMarker.on('drag', () => updateNodeOffsetFromMarker(labelMarker, false));
        labelMarker.on('dragend', () => {
            updateNodeOffsetFromMarker(labelMarker, true);
            scheduleNodeLabelDeclutter();
        });
        labelMarker.on('dblclick', () => resetNodeOffset(labelMarker));
        labelMarker.on('contextmenu', (e) => {
            if (e.originalEvent) e.originalEvent._layer_clicked = true;
        });
        dotMarker.on('contextmenu', (e) => {
            if (e.originalEvent) e.originalEvent._layer_clicked = true;
        });

        const tooltipContent = `<b>${escapeHtml(node.name)}</b><br>${escapeHtml(node.country)}<br>Conexiones: ${node.degree}`;
        labelMarker.bindTooltip(tooltipContent, { direction: 'top', className: 'custom-tooltip' });
        dotMarker.bindTooltip(tooltipContent, { direction: 'top', className: 'custom-tooltip' });

        nodeLayers.push(layerEntry);
    });

    updateNetworkNodeDetailVisibility();
    updateNetworkNodeDotScale();
    updateNetworkNodeConnectors();
    scheduleNodeLabelDeclutter();
}

// Add CartoDB Dark Matter tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

map.on('zoomend moveend', refreshNetworkNodePositions);
map.on('zoomend', updateNetworkNodeDetailVisibility);
map.on('zoomend', updateNetworkNodeDotScale);
map.on('zoomend', scheduleNodeLabelDeclutter);
map.on('zoomend moveend', refreshFlowArrowGeometry);
map.on('zoomstart movestart', () => updateHeaderCompactState(true));
map.on('zoomend moveend', () => updateHeaderCompactState());

map.on('contextmenu', function (e) {
    // Si el clic fue sobre una capa (país o línea), no mostramos el menú genérico del mapa
    // Leaflet dispara el evento en el mapa incluso si se dispara en una capa, 
    // a menos que la capa use stopPropagation.
    if (e.originalEvent._layer_clicked) return;

    const menu = document.createElement('div');
    menu.style.cssText = `
        position: absolute;
        left: ${e.originalEvent.pageX}px;
        top: ${e.originalEvent.pageY}px;
        background: ${MENU_THEME.bg};
        border: 1px solid ${MENU_THEME.border};
        padding: 5px;
        z-index: 2000;
        cursor: pointer;
        color: ${MENU_THEME.text};
        box-shadow: 0 12px 28px rgba(0,0,0,0.45);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
    `;

    const item = document.createElement('div');
    item.textContent = 'Ver inversiones en Transmision';
    item.style.padding = '5px';
    item.style.borderRadius = '4px';
    item.onmouseover = () => item.style.background = MENU_THEME.hover;
    item.onmouseout = () => item.style.background = MENU_THEME.bg;
    item.onclick = () => {
        if (typeof showTxInvestmentSummary === 'function') {
            showTxInvestmentSummary();
        } else {
            alert("No se encontró la funcion showTxInvestmentSummary");
        }
        if (document.body.contains(menu)) document.body.removeChild(menu);
    };
    menu.appendChild(item);

    const removeMenu = function () {
        if (document.body.contains(menu)) document.body.removeChild(menu);
        document.removeEventListener('click', removeMenu);
        map.off('keypress', removeMenu);
    };

    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', removeMenu), 100);
});

// Style for countries
function style(feature) {
    return {
        fillColor: 'rgba(99, 102, 241, 0.15)',
        weight: 1.5,
        opacity: 1,
        color: 'rgba(46, 51, 72, 0.85)',
        dashArray: '3',
        fillOpacity: 0.5
    };
}

// Hover effects for countries
function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 2.5,
        color: '#818cf8',
        dashArray: '',
        fillOpacity: 0.7
    });

    layer.bringToFront();
}

function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: function (e) {
            // Optional: Keep click for popup if desired, or just use hover
            // layer.bindPopup(feature.properties.name).openPopup();
        },
        contextmenu: function (e) {
            L.DomEvent.preventDefault(e);
            e.originalEvent._layer_clicked = true;

            const countryName = feature.properties.name;
            const countryId = feature.id; // e.g. "ARG", "BRA"

            // Match the ID used in backend (likely the 3-letter code or name)
            // Backend mapping seems to use 'CL', 'BR', 'AR', etc. or full names.
            // Adjust mapping if necessary. The user snippet implies: 'CL', 'BR', 'AR', 'PE', etc.
            // The geojson IDs are ARG, BRA, CHL. We might need a small mapper.

            const menu = document.createElement('div');
            menu.style.cssText = `
                position: absolute;
                left: ${e.originalEvent.pageX}px;
                top: ${e.originalEvent.pageY}px;
                background: ${MENU_THEME.bg};
                border: 1px solid ${MENU_THEME.border};
                padding: 10px;
                z-index: 2000;
                cursor: pointer;
                color: ${MENU_THEME.text};
                box-shadow: 0 12px 28px rgba(0,0,0,0.45);
                border-radius: 4px;
            `;
            menu.textContent = `Ver Generación (${countryName})`;
            // menu.onclick handler removed here to prevent double execution.
            // Click handlers are assigned to individual items below.
            menu.appendChild(document.createTextNode(`Ver Generación`));
            // The previous click handler was on the menu DIV.
            // Better to make separate items like before?
            // Re-writing content of menu to support multiple items properly.

            menu.textContent = ''; // Clear text
            menu.style.display = 'flex';
            menu.style.flexDirection = 'column';
            menu.style.padding = '5px';

            // Item 1: Generation Curve
            const item1 = document.createElement('div');
            item1.textContent = 'Ver Curva de Generación';
            item1.style.padding = '5px';
            item1.style.borderBottom = `1px solid ${MENU_THEME.border}`;
            item1.style.borderRadius = '4px';
            item1.onmouseover = () => item1.style.background = MENU_THEME.hover;
            item1.onmouseout = () => item1.style.background = MENU_THEME.bg;
            item1.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                showGenerationChart(queryCode);
                document.body.removeChild(menu);
            };
            menu.appendChild(item1);

            // Item 2: Energy Summary
            const item2 = document.createElement('div');
            item2.textContent = 'Ver Resumen de Energía (TWh)';
            item2.style.padding = '5px';
            item2.style.borderRadius = '4px';
            item2.onmouseover = () => item2.style.background = MENU_THEME.hover;
            item2.onmouseout = () => item2.style.background = MENU_THEME.bg;
            item2.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showEnergySummary === 'function') {
                    showEnergySummary(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item2);

            // Item 3: Marginal Costs
            const item3 = document.createElement('div');
            item3.textContent = 'Ver curva de Costos marginales';
            item3.style.padding = '5px';
            item3.style.borderRadius = '4px';
            item3.onmouseover = () => item3.style.background = MENU_THEME.hover;
            item3.onmouseout = () => item3.style.background = MENU_THEME.bg;
            item3.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showMarginalCostsChart === 'function') {
                    showMarginalCostsChart(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item3);

            // Item 4: Generators Summary
            const item4 = document.createElement('div');
            item4.textContent = 'Resumen de Generación';
            item4.style.padding = '5px';
            item4.style.borderRadius = '4px';
            item4.onmouseover = () => item4.style.background = MENU_THEME.hover;
            item4.onmouseout = () => item4.style.background = MENU_THEME.bg;
            item4.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showGeneratorsSummary === 'function') {
                    showGeneratorsSummary(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item4);

            // Item 5: Demand Summary
            const item5 = document.createElement('div');
            item5.textContent = 'Resumen de la demanda';
            item5.style.padding = '5px';
            item5.style.borderRadius = '4px';
            item5.onmouseover = () => item5.style.background = MENU_THEME.hover;
            item5.onmouseout = () => item5.style.background = MENU_THEME.bg;
            item5.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showDemandSummary === 'function') {
                    showDemandSummary(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item5);

            // Item 6: Transmission Summary
            const item6 = document.createElement('div');
            item6.textContent = 'Resumen de la transmision';
            item6.style.padding = '5px';
            item6.style.borderRadius = '4px';
            item6.onmouseover = () => item6.style.background = MENU_THEME.hover;
            item6.onmouseout = () => item6.style.background = MENU_THEME.bg;
            item6.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showTransmissionSummary === 'function') {
                    showTransmissionSummary(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item6);

            // Item 7: Country Summary
            const item7 = document.createElement('div');
            item7.textContent = 'Resumen del pais';
            item7.style.padding = '5px';
            item7.style.borderRadius = '4px';
            item7.onmouseover = () => item7.style.background = MENU_THEME.hover;
            item7.onmouseout = () => item7.style.background = MENU_THEME.bg;
            item7.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showCountrySummary === 'function') {
                    showCountrySummary(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item7);

            // Item 8: Storage Summary
            const item8 = document.createElement('div');
            item8.textContent = 'Resumen de almacenamiento';
            item8.style.padding = '5px';
            item8.style.borderRadius = '4px';
            item8.onmouseover = () => item8.style.background = MENU_THEME.hover;
            item8.onmouseout = () => item8.style.background = MENU_THEME.bg;
            item8.onclick = () => {
                const codeMap = {
                    'ARG': 'AR', 'BOL': 'BO', 'BRA': 'BR', 'CHL': 'CL',
                    'COL': 'CO', 'ECU': 'EC', 'PRY': 'PY', 'PER': 'PE',
                    'URY': 'UY', 'VEN': 'VZ', 'MEX': 'MX', 'GTM': 'GU',
                    'SLV': 'ES', 'HND': 'HN', 'NIC': 'NI', 'CRI': 'CR',
                    'PAN': 'PA', 'BLZ': 'BE'
                };
                const queryCode = codeMap[countryId] || countryId;
                if (typeof showStorageSummary === 'function') {
                    showStorageSummary(queryCode);
                }
                document.body.removeChild(menu);
            };
            menu.appendChild(item8);

            // Remove menu on clicking elsewhere
            const removeMenu = function () {
                if (document.body.contains(menu)) document.body.removeChild(menu);
                document.removeEventListener('click', removeMenu);
            };

            document.body.appendChild(menu);
            setTimeout(() => document.addEventListener('click', removeMenu), 100);
        }
    });
}

let geojsonLayer;

// Fetch local GeoJSON for Latin American countries
fetch('latam_countries.geo.json')
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    })
    .then(data => {
        geojsonLayer = L.geoJson(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));

// Function to load and display lines
let lineLayers = [];
let flowLineLayers = [];
let flowArrowLayers = [];
let flowArrowAnimationFrame = null;
let flowAnimationsEnabledBySimulation = false;
let lastOptimizationLineObjId = null;
let lastOptimizationLineName = null;

function updateRemunerationButtonState(enabled) {
    const btn = document.getElementById('view-remuneration-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.title = enabled
        ? 'Abrir resultados de remuneraciones'
        : 'Ejecuta el modelo para habilitar';
}

function loadLines() {
    // Clear existing lines
    lineLayers.forEach(layer => map.removeLayer(layer));
    lineLayers = [];
    flowLineLayers.forEach(layer => map.removeLayer(layer));
    flowLineLayers = [];
    flowArrowLayers.forEach((entry) => {
        if (entry && entry.marker) {
            map.removeLayer(entry.marker);
        }
    });
    flowArrowLayers = [];
    stopFlowArrowAnimation();
    clearNetworkNodes();

    const scenario = document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S1';
    console.log(`Loading lines for scenario ${scenario}...`);
    Promise.all([
        fetch('/api/lines?scenario=' + scenario).then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        }),
        fetch('/api/flows?scenario=' + scenario)
            .then(response => response.ok ? response.json() : null)
            .catch(() => null)
    ])
        .then(([lines, flowData]) => {
            const hasOptimizationResults = lines.some(l => l.X_LN !== undefined);
            const allowFlowAnimations = flowAnimationsEnabledBySimulation && hasOptimizationResults;

            if (scenario === 'S1') {
                if (lastOptimizationLineObjId !== null && !lastOptimizationLineName) {
                    const fixedLine = lines.find(line => String(line.id) === String(lastOptimizationLineObjId) && line.name);
                    if (fixedLine) {
                        lastOptimizationLineName = String(fixedLine.name);
                    }
                }

                if (lastOptimizationLineObjId === null) {
                    const selectedBySolver = lines.find(line =>
                        line
                        && line.status === 'Candidata'
                        && Number(line.X_LN) > 0.9
                        && line.name
                    );
                    if (selectedBySolver) {
                        lastOptimizationLineObjId = selectedBySolver.id ?? null;
                        lastOptimizationLineName = String(selectedBySolver.name);
                    }
                }
            }

            // Ensure pane exists
            if (!map.getPane('linesPane')) {
                map.createPane('linesPane');
                map.getPane('linesPane').style.zIndex = 650;
            }
            if (!map.getPane('flowLinesPane')) {
                map.createPane('flowLinesPane');
                map.getPane('flowLinesPane').style.zIndex = 655;
                map.getPane('flowLinesPane').style.pointerEvents = 'none';
            }
            if (!map.getPane('flowArrowsPane')) {
                map.createPane('flowArrowsPane');
                map.getPane('flowArrowsPane').style.zIndex = 656;
                map.getPane('flowArrowsPane').style.pointerEvents = 'none';
            }

            lines.forEach(line => {
                const latlngs = [
                    [line.start.lat, line.start.lon],
                    [line.end.lat, line.end.lon]
                ];

                let lineColor = LINE_COLORS.neutral; // Default
                if (line.status === 'Existente') {
                    lineColor = LINE_COLORS.existing;
                } else if (line.status === 'Candidata') {
                    lineColor = LINE_COLORS.candidate;
                }

                // Override color if X_LN (expansion decision) is 1
                // Check if property exists and is close to 1 (handling float precision)
                if (line.X_LN !== undefined && line.X_LN > 0.9) {
                    lineColor = LINE_COLORS.selected;
                }

                const polyline = L.polyline(latlngs, {
                    color: lineColor,
                    weight: 3,
                    opacity: 0.7,
                    pane: 'linesPane'
                }).addTo(map);

                polyline.featureData = line;
                lineLayers.push(polyline);

                // Gedobleve-style multiperiod flow: direction from annual net flow, speed from average absolute flow.
                const annualFlow = getAnnualNetFlowSummary(line, flowData);
                if (allowFlowAnimations && annualFlow && Math.abs(annualFlow.netMw) > FLOW_ANIMATION_MIN_MW) {
                    const flowLayer = L.polyline(latlngs, {
                        pane: 'flowLinesPane',
                        color: '#ffffff',
                        weight: 2.2,
                        opacity: 0.72,
                        dashArray: '4 12',
                        lineCap: 'round',
                        interactive: false,
                        className: 'line-flow-animated'
                    }).addTo(map);

                    configureFlowLayerAnimation(flowLayer, annualFlow.netMw, annualFlow.speedMw);
                    flowLineLayers.push(flowLayer);

                    const fromLatLng = Number(annualFlow.netMw) < 0 ? latlngs[1] : latlngs[0];
                    const toLatLng = Number(annualFlow.netMw) < 0 ? latlngs[0] : latlngs[1];
                    const speedMw = Number.isFinite(Number(annualFlow.speedMw))
                        ? Number(annualFlow.speedMw)
                        : Math.abs(Number(annualFlow.netMw) || 0);
                    const durationMs = Math.max(900, getFlowAnimationDurationSec(speedMw) * 1000 * FLOW_ARROW_SPEED_FACTOR);
                    const phaseMs = hashStringStable(line.name || line.id || '') % durationMs;

                    const flowArrowMarker = buildFlowArrowMarker(fromLatLng).addTo(map);
                    const flowArrowEntry = {
                        marker: flowArrowMarker,
                        fromLatLng,
                        toLatLng,
                        durationMs,
                        phaseMs
                    };
                    updateFlowArrowVisual(flowArrowEntry);
                    flowArrowLayers.push(flowArrowEntry);
                }

                // Tooltip on hover
                let tooltipContent = `
                    <b>${line.name}</b><br>
                    Fmax directo: ${line.fmaxDirect} MW<br>
                    Fmax inverso: ${line.fmaxInverse} MW
                `;

                // Add optimization flow if available (example property)
                if (line.flowP1 !== undefined) {
                    tooltipContent += `<br>Flow P1: ${line.flowP1.toFixed(2)} MW`;
                }
                if (annualFlow && Number.isFinite(annualFlow.netMw)) {
                    tooltipContent += `<br>Flujo neto anual: ${annualFlow.netMw.toFixed(2)} MW`;
                }

                // Add X_LN value if available
                if (line.X_LN !== undefined) {
                    tooltipContent += `<br><b>X_LN: ${line.X_LN.toFixed(4)}</b>`;
                }


                // --- MULTI-SELECT LOGIC START ---
                // Global array to store selected line names (ensure this is declared globally or at top of scope)
                if (typeof window.selectedLines === 'undefined') {
                    window.selectedLines = [];
                }

                function updateLineStyle(lineName, polylineLayer) {
                    if (window.selectedLines.includes(lineName)) {
                        polylineLayer.setStyle({ color: LINE_COLORS.highlight, weight: 5, dashArray: '' }); // Highlight style
                    } else {
                        // Reset to original style
                        let originalColor = LINE_COLORS.neutral;
                        if (line.status === 'Existente') originalColor = LINE_COLORS.existing;
                        else if (line.status === 'Candidata') originalColor = LINE_COLORS.candidate;

                        if (line.X_LN !== undefined && line.X_LN > 0.9) originalColor = LINE_COLORS.selected;

                        polylineLayer.setStyle({ color: originalColor, weight: 3, dashArray: '' });
                    }
                }

                // Click event for selection
                polyline.on('click', function (e) {
                    if (e.originalEvent.ctrlKey) {
                        L.DomEvent.preventDefault(e); // Prevent map zoom/pan if needed

                        if (window.selectedLines.includes(line.name)) {
                            // Deselect
                            window.selectedLines = window.selectedLines.filter(name => name !== line.name);
                        } else {
                            // Select
                            window.selectedLines.push(line.name);
                        }
                        updateLineStyle(line.name, polyline);
                    } else {
                        // Normal click behavior (e.g. popup) - do nothing special or clear selection?
                        // For now, let's clear selection if click without Ctrl
                        window.selectedLines.forEach(lName => {
                            // Find layer and reset? Complex to find reference back.
                            // Simpler: Just clear array. Visuals might trail until next interactions or we track layers globally.
                        });
                        window.selectedLines = [];
                        // We need a way to reset all styles. 
                        // Ideally we should iterate all lineLayers.
                        lineLayers.forEach(l => {
                            // We don't easily have 'line' data here unless attached to layer.
                            // Let's re-use loadLines logic or attach data to layer.
                            // For this MVP, let's just create a global reset function or simple toggle.
                        });
                        // Actually, let's just keep selection persist only with Ctrl. 
                        // Without Ctrl, maybe just show popup as before (which happens via bindPopup if enabled, or our tooltip)
                    }
                });

                // Context menu (Right Click)
                polyline.on('contextmenu', function (e) {
                    if (e.originalEvent) {
                        e.originalEvent.preventDefault();
                        e.originalEvent.stopPropagation();
                        e.originalEvent._layer_clicked = true;
                    }

                    const menu = document.createElement('div');
                    menu.style.cssText = `
                        position: absolute;
                        left: ${e.originalEvent.pageX}px;
                        top: ${e.originalEvent.pageY}px;
                        background: ${MENU_THEME.bg};
                        border: 1px solid ${MENU_THEME.border};
                        padding: 5px;
                        z-index: 2000;
                        cursor: pointer;
                        color: ${MENU_THEME.text};
                        box-shadow: 0 12px 28px rgba(0,0,0,0.45);
                        border-radius: 4px;
                        display: flex;
                        flex-direction: column;
                    `;

                    // Option 1: Plot THIS line
                    const itemSingle = document.createElement('div');
                    itemSingle.textContent = 'Ver Gráfico (Esta línea)';
                    itemSingle.style.padding = '5px';
                    itemSingle.style.borderBottom = `1px solid ${MENU_THEME.border}`;
                    itemSingle.style.borderRadius = '4px';
                    itemSingle.onmouseover = () => itemSingle.style.background = MENU_THEME.hover;
                    itemSingle.onmouseout = () => itemSingle.style.background = MENU_THEME.bg;
                    itemSingle.onclick = () => {
                        showFlowChart(line.name);
                        document.body.removeChild(menu);
                    };
                    menu.appendChild(itemSingle);

                    // Option 1.5: Plot Marginal Costs for Nodes
                    if (line.start.node && line.end.node) {
                        const itemMC = document.createElement('div');
                        itemMC.textContent = 'Ver Costos Marginales Nodos Interconectados';
                        itemMC.style.padding = '5px';
                        itemMC.style.borderBottom = `1px solid ${MENU_THEME.border}`;
                        itemMC.style.borderRadius = '4px';
                        itemMC.onmouseover = () => itemMC.style.background = MENU_THEME.hover;
                        itemMC.onmouseout = () => itemMC.style.background = MENU_THEME.bg;
                        itemMC.onclick = () => {
                            if (typeof showLineMarginalCostsChart === 'function') {
                                showLineMarginalCostsChart(line);
                            }
                            document.body.removeChild(menu);
                        };
                        menu.appendChild(itemMC);
                    }

                    // Option 2: Plot SELECTED lines (if any)
                    if (window.selectedLines.length > 0) {
                        const itemMulti = document.createElement('div');
                        itemMulti.textContent = `Comparar Seleccionadas (${window.selectedLines.length})`;
                        itemMulti.style.padding = '5px';
                        itemMulti.style.borderRadius = '4px';
                        itemMulti.onmouseover = () => itemMulti.style.background = MENU_THEME.hover;
                        itemMulti.onmouseout = () => itemMulti.style.background = MENU_THEME.bg;
                        itemMulti.onclick = () => {
                            showFlowChart(window.selectedLines);
                            document.body.removeChild(menu);
                        };
                        menu.appendChild(itemMulti);

                        // Option 3: Clear Selection
                        const itemClear = document.createElement('div');
                        itemClear.textContent = 'Limpiar Selección';
                        itemClear.style.padding = '5px';
                        itemClear.style.color = MENU_THEME.danger;
                        itemClear.style.borderRadius = '4px';
                        itemClear.onmouseover = () => itemClear.style.background = MENU_THEME.hover;
                        itemClear.onmouseout = () => itemClear.style.background = MENU_THEME.bg;
                        itemClear.onclick = () => {
                            window.selectedLines = [];
                            lineLayers.forEach(layer => {
                                // Reset basics (hacky reconstruction of style)
                                // Better: trigger reload or use data attached to layer.
                                // For now, we will reload lines to reset styles cleanly.
                                loadLines();
                            });
                        };
                        menu.appendChild(itemClear);
                    }

                    // Check if conditions for "Fijar X_LN en 1" are met
                    const isS1 = (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S1') === 'S1';
                    const isOrdenDeMerito = document.getElementById('ordendemerito') ? document.getElementById('ordendemerito').checked : false;

                    // Option: Methodology Results (Always visible for candidate lines)
                    if (line.status === 'Candidata') {
                        const itemResults = document.createElement('div');
                        itemResults.textContent = 'Ver Resultados de Metodología (Costo-Beneficio)';
                        itemResults.style.padding = '5px';
                        itemResults.style.borderBottom = `1px solid ${MENU_THEME.border}`;
                        itemResults.style.fontWeight = 'bold';
                        itemResults.style.color = MENU_THEME.accent;
                        itemResults.style.borderRadius = '4px';
                        itemResults.onmouseover = () => itemResults.style.background = MENU_THEME.hover;
                        itemResults.onmouseout = () => itemResults.style.background = MENU_THEME.bg;
                        itemResults.onclick = () => {
                            if (typeof window.showMethodologyResults === 'function') {
                                window.showMethodologyResults(line.name);
                            } else if (typeof showMethodologyResults === 'function') {
                                showMethodologyResults(line.name);
                            } else {
                                alert("No se encontró la función showMethodologyResults.");
                            }
                            document.body.removeChild(menu);
                        };
                        menu.appendChild(itemResults);
                    }

                    if (isS1 && isOrdenDeMerito && line.status === 'Candidata') {
                        const itemFix = document.createElement('div');
                        itemFix.textContent = 'Fijar variable X_LN en 1';
                        itemFix.style.padding = '5px';
                        itemFix.style.borderBottom = `1px solid ${MENU_THEME.border}`;
                        itemFix.style.borderRadius = '4px';
                        itemFix.onmouseover = () => itemFix.style.background = MENU_THEME.hover;
                        itemFix.onmouseout = () => itemFix.style.background = MENU_THEME.bg;
                        itemFix.onclick = () => {
                            window.fixedLineaObjId = line.id;
                            window.fixedLineaObjName = line.name || line.nombre || ('Linea ' + line.id);

                            // Immediately update visual styles for all candidate lines
                            lineLayers.forEach(lLayer => {
                                if (lLayer.featureData && lLayer.featureData.status === 'Candidata') {
                                    if (lLayer.featureData.id === line.id) {
                                        lLayer.setStyle({ color: LINE_COLORS.selected, weight: 4 });
                                    } else {
                                        lLayer.setStyle({ color: LINE_COLORS.candidate, weight: 3 });
                                    }
                                }
                            });
                            if (document.body.contains(menu)) document.body.removeChild(menu);
                            updateLineSelectionUI();
                        };
                        menu.appendChild(itemFix);
                    }

                    // Remove menu on clicking elsewhere
                    const removeMenu = function () {
                        if (document.body.contains(menu)) document.body.removeChild(menu);
                        document.removeEventListener('click', removeMenu);
                    };
                    document.body.appendChild(menu);
                    setTimeout(() => document.addEventListener('click', removeMenu), 100);
                });
                // --- MULTI-SELECT LOGIC END ---

                polyline.bindTooltip(tooltipContent, {
                    sticky: true,
                    className: 'custom-tooltip'
                });
            });

            renderNetworkNodes(lines);
            refreshFlowArrowGeometry();
            startFlowArrowAnimation();
            console.log(`Loaded ${lines.length} lines.`);

            // Check if we have loaded optimization results
            const hasResults = hasOptimizationResults;
            const statusEl = document.getElementById('model-status');
            const resetBtn = document.getElementById('reset-view-btn');
            updateRemunerationButtonState(hasResults && flowAnimationsEnabledBySimulation);

            if (hasResults) {
                if (statusEl) {
                    statusEl.textContent = "✅ Resultados del Modelo Cargados";
                    statusEl.style.color = LINE_COLORS.selected;
                }
                if (resetBtn) resetBtn.style.display = 'block';

                // Fetch timestamp
                fetch('/api/model-status')
                    .then(r => r.json())
                    .then(statusData => {
                        const timeEl = document.getElementById('model-timestamp');
                        if (timeEl && statusData.lastRun) {
                            const date = new Date(statusData.lastRun);
                            timeEl.style.display = 'block';
                            timeEl.textContent = `Última simulación: ${date.toLocaleString()}`;
                        }
                    })
                    .catch(e => console.error("Error fetching timestamp", e));

            } else {
                if (statusEl) {
                    statusEl.textContent = "ℹ️ Visualizando Datos de Entrada (Excel)";
                    statusEl.style.color = "#b0b8cc";
                }
                const timeEl = document.getElementById('model-timestamp');
                if (timeEl) timeEl.style.display = 'none';

                if (resetBtn) resetBtn.style.display = 'none';
            }

        })
        .catch(error => {
            console.error('Error loading lines:', error);
            clearNetworkNodes();
            updateRemunerationButtonState(false);
            const statusEl = document.getElementById('model-status');
            if (statusEl) {
                statusEl.textContent = "❌ Error cargando datos";
                statusEl.style.color = LINE_COLORS.candidate;
            }
        });
}

// Initial load
loadLines();

// --- Configuration Modal Logic ---
const modal = document.getElementById("configModal");
const configBtn = document.getElementById("config-btn");
const span = document.getElementsByClassName("close")[0];
const saveBtn = document.getElementById("save-config-btn");

if (configBtn) {
    configBtn.onclick = function () {
        if (modal) modal.style.display = "block";
    }
}

if (span) {
    span.onclick = function () {
        if (modal) modal.style.display = "none";
    }
}

if (saveBtn) {
    saveBtn.onclick = function () {
        if (modal) modal.style.display = "none";
    }
}

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// --- Line Selection UI Logic ---
function updateLineSelectionUI() {
    const infoPanel = document.getElementById('line-selection-info');
    const hint = document.getElementById('line-selection-hint');
    const selectedDisplay = document.getElementById('line-selected-display');
    const selectedText = document.getElementById('line-selected-text');
    if (!infoPanel) return;

    const runS1 = document.getElementById('run_S1') ? document.getElementById('run_S1').checked : false;
    const isS1View = (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S1') === 'S1';
    const showPanel = runS1 || isS1View;

    infoPanel.style.display = showPanel ? 'block' : 'none';

    if (window.fixedLineaObjId && window.fixedLineaObjName) {
        hint.style.display = 'none';
        selectedDisplay.style.display = 'block';
        selectedText.innerHTML = '<b>Linea seleccionada:</b> ' + window.fixedLineaObjName + ' (ID: ' + window.fixedLineaObjId + ')';
    } else {
        hint.style.display = 'block';
        selectedDisplay.style.display = 'none';
    }
}

// Clear line selection
const clearSelBtn = document.getElementById('line-clear-selection');
if (clearSelBtn) {
    clearSelBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.fixedLineaObjId = null;
        window.fixedLineaObjName = null;
        // Reset candidate line colors
        lineLayers.forEach(lLayer => {
            if (lLayer.featureData && lLayer.featureData.status === 'Candidata') {
                lLayer.setStyle({ color: LINE_COLORS.candidate, weight: 3 });
            }
        });
        updateLineSelectionUI();
    });
}

// Update panel when scenario view or checkboxes change
document.getElementById('visualize-scenario').addEventListener('change', updateLineSelectionUI);
const runS1Checkbox = document.getElementById('run_S1');
if (runS1Checkbox) runS1Checkbox.addEventListener('change', updateLineSelectionUI);

// Initial update
updateLineSelectionUI();

function resolveMethodologyLineName() {
    if (lastOptimizationLineObjId !== null) {
        const byLastId = lineLayers.find(layer => {
            const data = layer && layer.featureData;
            return data && String(data.id) === String(lastOptimizationLineObjId) && data.name;
        });
        if (byLastId && byLastId.featureData) {
            return String(byLastId.featureData.name);
        }
    }

    if (lastOptimizationLineName) {
        return String(lastOptimizationLineName);
    }

    if (window.fixedLineaObjId !== undefined && window.fixedLineaObjId !== null) {
        const byFixedId = lineLayers.find(layer => {
            const data = layer && layer.featureData;
            return data && String(data.id) === String(window.fixedLineaObjId) && data.name;
        });
        if (byFixedId && byFixedId.featureData) {
            return String(byFixedId.featureData.name);
        }
    }

    if (window.fixedLineaObjName) {
        return String(window.fixedLineaObjName);
    }

    if (Array.isArray(window.selectedLines) && window.selectedLines.length === 1) {
        return String(window.selectedLines[0]);
    }

    const candidateChosenBySolver = lineLayers.find(layer => {
        const data = layer && layer.featureData;
        return data
            && data.status === 'Candidata'
            && Number(data.X_LN) > 0.9
            && data.name;
    });
    if (candidateChosenBySolver && candidateChosenBySolver.featureData) {
        return String(candidateChosenBySolver.featureData.name);
    }

    const firstCandidate = lineLayers.find(layer => {
        const data = layer && layer.featureData;
        return data && data.status === 'Candidata' && data.name;
    });
    if (firstCandidate && firstCandidate.featureData) {
        return String(firstCandidate.featureData.name);
    }

    return null;
}

const viewRemunerationBtn = document.getElementById('view-remuneration-btn');
if (viewRemunerationBtn) {
    viewRemunerationBtn.addEventListener('click', () => {
        const lineName = resolveMethodologyLineName();
        if (!lineName) {
            alert('No se pudo identificar una línea para abrir Resultados de Metodologías.');
            return;
        }

        if (typeof showMethodologyResults === 'function') {
            showMethodologyResults(lineName);
        } else if (typeof window.showMethodologyResults === 'function') {
            window.showMethodologyResults(lineName);
        } else {
            alert("No se encontró la función showMethodologyResults.");
        }
    });
}

// Button Event Listener
document.getElementById('run-model-btn').addEventListener('click', async () => {
    const btn = document.getElementById('run-model-btn');
    const loading = document.getElementById('loading');
    const consoleOutput = document.getElementById('console-output');

    // Collect Config Data
    const baseConfigData = {
        year_obj: document.getElementById('year_obj').value,
        costo_combustible: document.getElementById('costo_combustible').value,
        hidrologia: document.getElementById('hidrologia').value,
        inversiones_intx: document.getElementById('inversiones_intx').value,
        inversiones_gx: document.getElementById('inversiones_gx').value,
        demanda_tipo: document.getElementById('demanda_tipo').value,
        sincarbonCL: document.getElementById('sincarbonCL').checked,
        bloquear_invtx_nacional: document.getElementById('bloquear_invtx_nacional').checked,
        bloquear_invtx_existenteinternacional: document.getElementById('bloquear_invtx_existenteinternacional').checked,
        flux0_internacional_candidata: document.getElementById('flux0_internacional_candidata').checked,
        ordendemerito: document.getElementById('ordendemerito').checked,
        linea_obj: window.fixedLineaObjId || null
    };

    const runS0 = document.getElementById('run_S0').checked;
    const runS1 = document.getElementById('run_S1').checked;
    const scenariosToRun = [];
    if (runS0) scenariosToRun.push('S0');
    if (runS1) scenariosToRun.push('S1');

    if (scenariosToRun.length === 0) {
        alert("Por favor seleccione al menos un escenario para ejecutar.");
        return;
    }

    // Disable button, show loading
    if (btn) btn.disabled = true;
    updateRemunerationButtonState(false);
    if (loading) loading.style.display = 'block';

    let consoleEl = consoleOutput;
    if (!consoleEl) {
        consoleEl = document.createElement('div');
        consoleEl.id = 'console-output';
        document.getElementById('controls').appendChild(consoleEl);
    }

    consoleEl.textContent = '';
    consoleEl.style.display = 'block';
    let successfulScenarios = 0;
    let ranS1Successfully = false;

    try {
        for (const scenario of scenariosToRun) {
            consoleEl.textContent += `> Ejecutando escenario ${scenario}...\\n`;

            const configData = { ...baseConfigData, escenario_ejecucion: scenario };

            const response = await fetch('/api/run-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            });

            const data = await response.json();
            console.log(`Result ${scenario}:`, data);

            if (data.error) {
                consoleEl.textContent += `ERROR en ${scenario}: ${data.error}\\nDETAILS: ${data.details}\\n`;
                alert(`Error al ejecutar el escenario ${scenario}: ` + data.error);
                break; // Stop execution if there is an error
            } else {
                consoleEl.textContent += data.output + "\\n";
                consoleEl.scrollTop = consoleEl.scrollHeight;
                successfulScenarios += 1;

                if (scenario === 'S1') {
                    ranS1Successfully = true;
                    if (configData.linea_obj !== undefined && configData.linea_obj !== null) {
                        lastOptimizationLineObjId = configData.linea_obj;
                        if (window.fixedLineaObjName) {
                            lastOptimizationLineName = String(window.fixedLineaObjName);
                        } else {
                            lastOptimizationLineName = null;
                        }
                    } else {
                        lastOptimizationLineObjId = null;
                        lastOptimizationLineName = null;
                    }
                }
            }
        }

        if (!ranS1Successfully && !scenariosToRun.includes('S1')) {
            lastOptimizationLineObjId = null;
            lastOptimizationLineName = null;
        }

        if (successfulScenarios > 0) {
            flowAnimationsEnabledBySimulation = true;
        }

        if (successfulScenarios === scenariosToRun.length) {
            alert('Ejecución(es) completadas exitosamente!');
        }
        loadLines();
    } catch (error) {
        console.error('Error executing model:', error);
        consoleEl.textContent += `\\nFATAL ERROR: ${error.message}`;
        alert('Error de conexión o ejecución del modelo.');
    } finally {
        if (btn) btn.disabled = false;
        if (loading) loading.style.display = 'none';
        checkModelStatus();
    }
});

document.getElementById('visualize-scenario').addEventListener('change', () => {
    loadLines();
});
