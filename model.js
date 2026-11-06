/* Shared, deterministic demo domain. No DOM or storage dependencies. */
(function (root) {
  'use strict';
  const VERSION = 2, STORAGE_KEY = 'wms-action-workbench-v2';
  const LEGACY_STORAGE_KEY = 'wms-action-workbench-v1', INITIALIZED_KEY = STORAGE_KEY + '-initialized';
  const rackData = typeof module !== 'undefined' && module.exports ? require('./rack-data.js') : root.WarehouseRackData;
  const suppliers = ['ACME Supply', 'Global Parts', 'Tech Components', 'ACME Supply', 'Metro Hardware', 'ACME Supply'];
  const quantities = [1200, 800, 240, 600, 360, 480];
  function createLegacyState() {
    const jobs = quantities.map((qty, i) => {
      const pallets = Array.from({length: i === 0 ? 3 : 2}, (_, n) => ({
        id: 'PAL-' + String(4279 + i * 3 + n).padStart(6, '0'),
        qty: qty / (i === 0 ? 3 : 2), cartons: i === 0 ? 4 : 2,
        unloaded: i === 0 ? n < 2 : [1, 3, 5].includes(i),
        destination: i === 0 && n < 2 ? ['B-03-01', 'B-02-04'][n] : '',
        unloadedAt: i === 0 && n < 2 ? '2026-10-28T08:' + (n ? '40' : '20') + ':00+08:00' : '',
        putawayAt: i === 0 && n < 2 ? '2026-10-28T09:' + (n ? '20' : '00') + ':00+08:00' : '',
        source: 'RCV-02'
      }));
      return {asn: String(180004521 + i), id: 'RCV-' + (1042 + i), po: 'PO-' + (778344 + i),
        supplier: suppliers[i], material: i === 0 ? 'MAT-2048' : 'MAT-' + (2048 + i),
        materialName: i === 0 ? 'Widget Assembly' : ['Connector Kit', 'Sensor Module', 'Power Assembly', 'Fastener Kit', 'Control Module'][i - 1],
        batch: 'B261027', warehouse: 'HKW', dock: String(i % 3 + 2).padStart(2, '0'),
        date: '2026-10-28', scheduled: [2, 4].includes(i), pallets, activity: []};
    });
    return {version: 1, jobs, activity: []};
  }
  function getJob(state, asn) { return state.jobs.find(j => j.asn === asn); }
  function totals(job) {
    const sum = list => list.reduce((n, p) => n + p.qty, 0);
    const expected = sum(job.pallets), unloaded = sum(job.pallets.filter(p => p.unloaded));
    const putaway = sum(job.pallets.filter(isPutaway));
    return {expected, unloaded, putaway, remainingUnload: expected - unloaded,
      remainingPutaway: expected - putaway, cartons: job.pallets.reduce((n, p) => n + p.cartons, 0)};
  }
  function stage(job) {
    const t = totals(job);
    return t.remainingUnload ? 'unload' : t.remainingPutaway ? 'putaway' : 'complete';
  }
  function status(job) {
    const s = stage(job);
    if (s === 'complete') return 'SAP pending';
    if (s === 'putaway') return 'In progress';
    return job.scheduled ? 'Scheduled' : 'Ready';
  }
  function locations() {
    return ['A', 'B', 'C'].flatMap(row => Array.from({length: 7}, (_, i) =>
      Array.from({length: 4}, (_, l) => row + '-' + String(i + 1).padStart(2, '0') + '-' + String(l + 1).padStart(2, '0'))).flat());
  }
  function isPutaway(pallet) {
    return !!pallet.destinationLocatorId || (pallet.destinationStatus === 'unresolved' && !!pallet.legacyDestination);
  }
  function destinationLabel(pallet) { return pallet.destinationCode || pallet.legacyDestination || ''; }
  // A content version keeps existing v2 saves valid. It is a local conflict check, not a server lock.
  function taskVersion(job) { return JSON.stringify([job.asn, job.scheduled, job.material, job.pallets]); }
  function validatePutawayContext(state, context) {
    const job = context && getJob(state, context.asn), p = job?.pallets.find(p => p.id === context.palletId);
    if (!job || !p || job.scheduled) return {valid: false, message: 'Task is unavailable. Continue browsing or reopen the original task.'};
    if (context.organizationId !== rackData.legacyScope.organizationId || context.subinventoryId !== rackData.legacyScope.subinventoryId)
      return {valid: false, message: 'Task inventory scope is unavailable.'};
    if (!p.unloaded || isPutaway(p)) return {valid: false, message: 'Task pallet is no longer available for putaway.'};
    if (job.pallets.some(p => p.destinationStatus === 'unresolved')) return {valid: false, message: 'Resolve this ASN’s legacy destination mapping before putaway.'};
    if (context.taskVersion !== taskVersion(job)) return {valid: false, message: 'Task changed. Reopen the original task before selecting a destination.'};
    return {valid: true, job, pallet: p};
  }
  function demoPutawayRule(locatorId) {
    if (Object.values(rackData.legacyLocationMap).includes(locatorId))
      return {maxPallets: 1, maxQuantity: 1200, materials: quantities.map((_, i) => 'MAT-' + (2048 + i)), mixed: false};
    if (locatorId === 'loc-demo-special')
      return {maxPallets: 2, maxQuantity: 1000, materials: ['MAT-DEMO-01', 'MAT-2048'], mixed: true};
    return null;
  }
  function validatePutawayTarget(state, request, catalog = rackData) {
    const task = validatePutawayContext(state, request);
    const fail = message => ({valid: false, eligible: false, message, locatorId: request?.locatorId || null, revision: catalog.revision});
    if (!task.valid) return fail(task.message);
    const locator = catalog.locators.find(l => l.locatorId === request.locatorId && inScope(l, request));
    if (!locator) return fail('Locator is outside the task organization / subinventory.');
    const sub = catalog.subinventories.find(s => s.id === locator.subinventoryId && s.organizationId === locator.organizationId);
    if (sub?.locatorEnabled !== true || locator.enabled !== true) return fail('Locator is disabled or its configuration is unknown.');
    if (!getLocatorMapping({...request}, catalog)) return fail('Locator has no validated physical mapping.');
    const inventory = getLocatorInventory({...request, pageSize: 500}, state, catalog);
    if (!inventory.complete || inventory.nextCursor) return fail('Demo inventory is incomplete; target cannot be validated.');
    const rule = demoPutawayRule(locator.locatorId);
    if (!rule) return fail('Demo material / capacity rules are unknown for this Locator.');
    if (!rule.materials.includes(task.job.material)) return fail('Demo material restriction does not allow this material.');
    if (request.quantity !== task.pallet.qty || request.uom !== 'PCS') return fail('Task quantity or unit changed. Reopen the task.');
    const lines = inventory.inventoryLines.filter(l => l.quantity > 0);
    if (new Set(lines.map(l => l.palletId || l.id)).size >= rule.maxPallets)
      return fail('This location is already occupied. Demo pallet capacity reached.');
    if (lines.some(l => l.uom !== 'PCS')) return fail('Demo capacity cannot combine different units.');
    if (!rule.mixed && lines.some(l => l.materialId !== task.job.material || l.lot !== task.job.batch))
      return fail('Demo rule does not allow mixed material / lots.');
    if (lines.reduce((n, l) => n + l.quantity, 0) + task.pallet.qty > rule.maxQuantity)
      return fail('Demo quantity capacity exceeded.');
    return {valid: true, eligible: true, locatorId: locator.locatorId, destinationCode: locator.locatorCode,
      revision: catalog.revision, message: 'Eligible · Demo only · ' + rule.maxPallets + ' pallet(s), ' + rule.maxQuantity + ' PCS maximum' + (rule.mixed ? ' · mixed material / lots allowed' : ' · no mixed material / lots')};
  }
  function resolveDestination(value) {
    const text = String(value || '').trim();
    return rackData.legacyLocationMap[text.toUpperCase()] || rackData.locators.find(l => inScope(l, rackData.legacyScope) &&
      (l.locatorId === text || l.locatorCode === text))?.locatorId || null;
  }
  function validateLocation(state, value, palletId) {
    const id = String(value || '').trim().toUpperCase(), locatorId = rackData.legacyLocationMap[id];
    const locator = rackData.locators.find(l => l.locatorId === locatorId && inScope(l, rackData.legacyScope));
    const fail = message => ({valid: false, id, locatorId: locatorId || null, message});
    const job = state.jobs.find(j => j.pallets.some(p => p.id === palletId));
    if (job?.pallets.some(p => p.destinationStatus === 'unresolved')) return fail('Resolve this ASN’s legacy destination mapping before putaway. Original progress is retained.');
    if (!locator) return fail('Enter a valid location, e.g. B-03-02.');
    if (!validateRackCatalog().valid || !getLocatorMapping({...rackData.legacyScope, locatorId}) || locator.enabled !== true)
      return fail('Demo location configuration is unavailable or disabled.');
    const snapshot = getLocatorInventory({...rackData.legacyScope, locatorId}, state);
    if (!snapshot.complete) return fail('Demo inventory is incomplete; target cannot be validated.');
    // Demo-only rule for the 84 legacy targets: one task pallet per target; other stock blocks new placement.
    // The historically occupied initial target remains readable, but cannot accept another task pallet.
    const occupied = state.inventoryLines.some(l => l.locatorId === locatorId && l.quantity > 0 && l.palletId !== palletId);
    return {valid: !occupied, id, locatorId, destinationCode: locator.locatorCode,
      message: occupied ? 'This location is already occupied.' : 'Location validated · Demo single-pallet rule only'};
  }
  function suggestLocation(state, palletId) {
    return ['B-03-02', ...locations()].find(id => validateLocation(state, id, palletId).valid);
  }
  function currentPallet(job, view) {
    return job.pallets.find(p => view === 'unload' ? !p.unloaded : p.unloaded && !isPutaway(p));
  }
  function findPallet(job, id) {
    const p = job.pallets.find(p => p.id === id);
    if (!p) throw new Error('Pallet not found on this ASN.');
    return p;
  }
  function addActivity(state, job, message, now = new Date().toISOString()) {
    const entry = {at: now, message, asn: job.asn, operator: 'Conrad'};
    job.activity.unshift(entry); state.activity.unshift(entry); return entry;
  }
  function recordUnload(state, asn, palletId, quantity, cartons, source) {
    const job = getJob(state, asn);
    if (!job) throw new Error('ASN not found.');
    const p = findPallet(job, palletId);
    if (job.scheduled) throw new Error('This job is scheduled and is not released for unloading.');
    if (p.unloaded) throw new Error('This pallet has already been unloaded.');
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || Number(quantity) !== p.qty)
      throw new Error('Record the full pallet quantity (' + p.qty + ' PCS). Report discrepancies separately.');
    if (!Number.isInteger(Number(cartons)) || Number(cartons) !== p.cartons)
      throw new Error('Expected ' + p.cartons + ' cartons. Report discrepancies separately.');
    if (!['RCV-01', 'RCV-02', 'RCV-03'].includes(source)) throw new Error('Select a valid staging location.');
    p.unloaded = true; p.source = source; p.unloadedAt = new Date().toISOString();
    addActivity(state, job, p.id + ' · ' + p.qty + ' PCS unloaded to ' + source, p.unloadedAt); return p;
  }
  function confirmPutaway(state, asn, palletId, destination, expectedVersion) {
    const job = getJob(state, asn);
    if (!job) throw new Error('ASN not found.');
    const p = findPallet(job, palletId);
    if (!p.unloaded) throw new Error('Unload this pallet before putaway.');
    if (isPutaway(p)) throw new Error('This pallet has already been put away.');
    const locatorId = resolveDestination(destination);
    if (!locatorId) throw new Error('Enter a valid location, e.g. B-03-02.');
    const result = validatePutawayTarget(state, {asn, palletId, locatorId, ...rackData.legacyScope,
      taskVersion: expectedVersion === undefined ? taskVersion(job) : expectedVersion, quantity: p.qty, uom: 'PCS'});
    if (!result.valid) throw new Error(result.message);
    if (state.inventoryLines.some(l => l.palletId === p.id)) throw new Error('This pallet already has inventory. Restore a consistent saved state before retrying.');
    p.destinationLocatorId = result.locatorId; p.destinationCode = result.destinationCode;
    p.destinationStatus = 'mapped'; p.putawayAt = new Date().toISOString();
    state.inventoryLines.push(palletInventory(job, p));
    addActivity(state, job, p.id + ' · ' + p.qty + ' PCS put away to ' + destinationLabel(p), p.putawayAt); return p;
  }
  function reportException(state, asn, type, note) {
    const job = getJob(state, asn);
    if (!job) throw new Error('ASN not found.');
    if (!['Quantity discrepancy', 'Damaged packaging', 'Location issue', 'Other'].includes(type)) throw new Error('Select an exception type.');
    if (typeof note !== 'string' || !note.trim() || note.trim().length > 500) throw new Error('Enter a note of 1–500 characters.');
    return addActivity(state, job, type + ': ' + note.trim());
  }
  function searchJobs(state, filters = {}) {
    const q = String(filters.query || '').trim().toUpperCase();
    return state.jobs.filter(j => {
      const fields = filters.type === 'ASN' ? [j.asn] : filters.type === 'Job' ? [j.id] :
        [j.asn, j.id, j.po, j.material, ...j.pallets.map(p => p.id)];
      return (!q || fields.some(v => v.toUpperCase().includes(q))) &&
        (!filters.status || status(j) === filters.status) &&
        (!filters.supplier || j.supplier === filters.supplier) &&
        (!filters.from || j.date >= filters.from) && (!filters.to || j.date <= filters.to);
    });
  }
  function serialize(state) { return JSON.stringify(state); }
  function validEntry(e) {
    return e && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) &&
      typeof e.message === 'string' && e.message.length <= 650 && typeof e.asn === 'string' && e.operator === 'Conrad';
  }
  function validJobs(value, legacy = false) {
    const initial = createLegacyState();
    if (!value || value.version !== (legacy ? 1 : VERSION) || !Array.isArray(value.jobs) ||
      value.jobs.length !== initial.jobs.length || !Array.isArray(value.activity) || !value.activity.every(validEntry)) return false;
    const ids = new Set();
    for (let i = 0; i < value.jobs.length; i++) {
      const j = value.jobs[i], seed = initial.jobs[i];
      if (!j || !['asn','id','supplier','material','materialName','batch','po','date','scheduled','warehouse','dock'].every(k => j[k] === seed[k]) ||
        !Array.isArray(j.pallets) || j.pallets.length !== seed.pallets.length || !Array.isArray(j.activity) || !j.activity.every(validEntry)) return false;
      for (let n = 0; n < j.pallets.length; n++) {
        const p = j.pallets[n], base = seed.pallets[n];
        if (!p || p.id !== base.id || ids.has(p.id) || p.qty !== base.qty || p.cartons !== base.cartons ||
          typeof p.unloaded !== 'boolean' || !['unloadedAt','putawayAt'].every(k => typeof p[k] === 'string' && (!p[k] || Number.isFinite(Date.parse(p[k])))) ||
          !['RCV-01','RCV-02','RCV-03'].includes(p.source)) return false;
        if (legacy && (typeof p.destination !== 'string' || p.destination.length > 200 || (p.destination && !p.unloaded))) return false;
        ids.add(p.id);
      }
    }
    return true;
  }
  function palletInventory(job, p) {
    return {id: 'inv-demo-pallet-' + p.id, ...rackData.legacyScope, locatorId: p.destinationLocatorId,
      materialId: job.material, materialName: job.materialName, lot: job.batch, palletId: p.id,
      quantity: p.qty, uom: 'PCS', asOf: p.putawayAt || null, source: 'Demo v2',
      legacyDestination: p.legacyDestination, mappingStatus: p.destinationStatus};
  }
  function inventoryForJobs(jobs) {
    const ids = new Set(jobs.flatMap(j => j.pallets.map(p => p.id)));
    return [...copy(rackData.inventoryLines.filter(l => !ids.has(l.palletId))),
      ...jobs.flatMap(j => j.pallets.filter(isPutaway).map(p => palletInventory(j, p)))];
  }
  function migrateV1(raw, catalog = rackData) {
    try {
      const value = JSON.parse(raw);
      if (!validJobs(value, true)) return null;
      const targets = new Map(), catalogValid = validateRackCatalog(catalog).valid;
      for (const j of value.jobs) for (const p of j.pallets) if (p.destination) {
        const id = catalog.legacyLocationMap[p.destination];
        if (id) targets.set(id, (targets.get(id) || 0) + 1);
      }
      for (const j of value.jobs) for (const p of j.pallets) {
        const old = p.destination, id = catalog.legacyLocationMap[old];
        const locator = catalog.locators.find(l => l.locatorId === id && inScope(l, catalog.legacyScope));
        const mapped = !!old && catalogValid && locator && targets.get(id) === 1 &&
          catalog.mappings.some(m => m.locatorId === id);
        p.legacyDestination = old; p.destinationLocatorId = mapped ? id : null;
        p.destinationCode = mapped ? locator.locatorCode : old;
        p.destinationStatus = old ? (mapped ? 'mapped' : 'unresolved') : 'none';
        delete p.destination;
      }
      value.version = VERSION; value.initialized = true;
      value.inventoryLines = inventoryForJobs(value.jobs);
      return value;
    } catch { return null; }
  }
  function createState() { return migrateV1(JSON.stringify(createLegacyState())); }
  function restore(raw) {
    try {
      const value = JSON.parse(raw);
      if (!validJobs(value) || value.initialized !== true || !Array.isArray(value.inventoryLines)) return null;
      const occupied = new Set();
      for (const j of value.jobs) for (const p of j.pallets) {
        if ('destination' in p || typeof p.destinationCode !== 'string' || typeof p.legacyDestination !== 'string' || p.legacyDestination.length > 200) return null;
        const locator = rackData.locators.find(l => l.locatorId === p.destinationLocatorId && inScope(l, rackData.legacyScope));
        if (p.destinationStatus === 'mapped') {
          if (!locator || !getLocatorMapping({...rackData.legacyScope, locatorId: p.destinationLocatorId}) ||
            p.destinationCode !== locator.locatorCode || !p.unloaded || occupied.has(locator.locatorId)) return null;
          occupied.add(locator.locatorId);
        } else if (p.destinationStatus === 'unresolved') {
          if (p.destinationLocatorId !== null || !p.legacyDestination || p.destinationCode !== p.legacyDestination || !p.unloaded) return null;
        } else if (p.destinationStatus !== 'none' || p.destinationLocatorId !== null || p.destinationCode || p.legacyDestination || p.putawayAt) return null;
      }
      // Validate task/inventory consistency as one saved unit; never silently rebuild damaged inventory.
      const expected = inventoryForJobs(value.jobs), saved = new Map(value.inventoryLines.map(l => [l.id, l]));
      if (saved.size !== value.inventoryLines.length || expected.length !== saved.size || expected.some(line =>
        !saved.has(line.id) || Object.keys(line).some(k => line[k] !== saved.get(line.id)[k]) ||
        Object.keys(line).length !== Object.keys(saved.get(line.id)).length)) return null;
      return value;
    } catch { return null; }
  }
  function saveState(storage, state) {
    storage.setItem(STORAGE_KEY, serialize(state));
    storage.setItem(INITIALIZED_KEY, 'true');
  }
  function loadState(storage) {
    const memoryWarning = 'Browser storage is unavailable. Progress will last for this session only; original saved data is retained.';
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const state = restore(raw);
        return state ? {state, blocked: false, warning: ''} :
          {state: null, blocked: true, warning: 'Saved v2 data is damaged or incompatible. It has been retained. Export it, repair it using the migration guide, then retry. No v1 data was re-imported.'};
      }
      if (storage.getItem(INITIALIZED_KEY) !== null) return {state: null, blocked: true,
        warning: 'v2 was initialized but its saved data is missing. Restore an exported v2 backup and retry, or explicitly Reset demo. Old v1 progress will not be re-imported.'};
      const legacy = storage.getItem(LEGACY_STORAGE_KEY);
      const state = legacy === null ? createState() : migrateV1(legacy);
      if (!state) return {state: null, blocked: true, warning: 'Saved v1 data could not be migrated. Original content is retained. Export and repair the saved file, then retry, or explicitly Reset demo.'};
      let warning = state.jobs.some(j => j.pallets.some(p => p.destinationStatus === 'unresolved')) ?
        'Some legacy destinations are unresolved. Original quantities, times and history are retained. Export the v2 data and correct its mapping before submitting affected ASNs.' : '';
      try { saveState(storage, state); } catch { warning = memoryWarning; }
      return {state, blocked: false, warning};
    } catch { return {state: createState(), blocked: false, warning: memoryWarning}; }
  }
  // Catalog queries return copies; mutable Demo v2 inventory lives in the business state.
  const copy = value => JSON.parse(JSON.stringify(value));
  const inScope = (value, scope) => value.organizationId === scope.organizationId &&
    (!scope.subinventoryId || value.subinventoryId === scope.subinventoryId);
  function requireScope(scope, catalog, requireSub = true) {
    if (!scope || !catalog.organizations.some(o => o.id === scope.organizationId)) throw new Error('Unknown inventory organization.');
    if ((requireSub || scope.subinventoryId) && !catalog.subinventories.some(s => s.id === scope.subinventoryId && s.organizationId === scope.organizationId))
      throw new Error('Unknown subinventory in this organization.');
  }
  function listRacks(scope, catalog = rackData) {
    requireScope(scope, catalog, false);
    const scene = catalog.scenes.find(s => s.id === scope.sceneId && s.organizationIds.includes(scope.organizationId));
    if (!scene) return [];
    const ids = catalog.rackScopes.filter(s => inScope(s, scope)).map(s => s.physicalRackId);
    return copy(catalog.racks.filter(r => r.sceneId === scene.id && scene.racks.includes(r.id) && ids.includes(r.id)));
  }
  function listLocators(scope, catalog = rackData) {
    requireScope(scope, catalog);
    return copy(catalog.locators.filter(l => inScope(l, scope)));
  }
  function validateRackCatalog(catalog = rackData) {
    const errors = [], fail = message => errors.push(message);
    for (const key of ['scenes', 'organizations', 'subinventories', 'racks', 'rackScopes', 'locators', 'mappings', 'inventoryLines', 'inventorySnapshots'])
      if (!Array.isArray(catalog[key])) fail('Missing array: ' + key);
    if (errors.length) return {valid: false, errors};
    function unique(list, key, label) {
      const seen = new Set();
      for (const item of list) {
        const id = key(item);
        if (!id || seen.has(id)) fail('Duplicate or missing ' + label + ': ' + id);
        seen.add(id);
      }
    }
    unique(catalog.scenes, s => s.id, 'scene ID');
    unique(catalog.organizations, o => o.id, 'organization ID');
    unique(catalog.subinventories, s => s.id, 'subinventory ID');
    unique(catalog.racks, r => r.id, 'physical rack ID');
    unique(catalog.locators, l => l.locatorId, 'Locator ID');
    unique(catalog.inventoryLines, l => l.id, 'inventory ID');
    const snapshotKey = s => JSON.stringify([s.organizationId, s.subinventoryId, s.locatorId]);
    unique(catalog.inventorySnapshots, snapshotKey, 'inventory snapshot');
    const positive = n => Number.isFinite(n) && n > 0;
    const scopedSub = s => catalog.subinventories.find(sub => sub.id === s.subinventoryId && sub.organizationId === s.organizationId);
    for (const s of catalog.subinventories) {
      if (!catalog.organizations.some(o => o.id === s.organizationId) || ![true, false, null].includes(s.locatorEnabled)) fail('Invalid subinventory: ' + s.id);
    }
    for (const scene of catalog.scenes) {
      if (!Array.isArray(scene.organizationIds) || scene.organizationIds.some(id => !catalog.organizations.some(o => o.id === id)) ||
        !Array.isArray(scene.racks) || scene.racks.some(id => !catalog.racks.some(r => r.id === id && r.sceneId === scene.id))) fail('Invalid scene: ' + scene.id);
    }
    for (const rack of catalog.racks) {
      if (!catalog.scenes.some(s => s.id === rack.sceneId && s.racks.includes(rack.id))) fail('Rack scene mismatch: ' + rack.id);
      if (!rack.overviewPosition || !['x', 'y', 'z'].every(k => Number.isFinite(rack.overviewPosition[k]))) fail('Invalid overview position: ' + rack.id);
      if (rack.layoutStatus === 'pending') {
        if (!Array.isArray(rack.levels) || rack.levels.length) fail('Pending rack has invented layout: ' + rack.id);
        continue;
      }
      if (rack.layoutStatus !== 'configured' || !positive(rack.width) || !positive(rack.depth) || !Array.isArray(rack.levels) || !rack.levels.length) {
        fail('Invalid rack dimensions/layout: ' + rack.id); continue;
      }
      let top = 0;
      for (const [i, level] of rack.levels.entries()) {
        if (level.levelIndex !== i || !Number.isFinite(level.baseZ) || level.baseZ < top || !positive(level.height)) fail('Invalid/overlapping level: ' + rack.id + '/' + i);
        top = level.baseZ + level.height;
        if (!Array.isArray(level.slots) || !level.slots.length) { fail('Missing slots: ' + rack.id + '/' + i); continue; }
        let right = 0;
        for (const [n, slot] of level.slots.entries()) {
          if (slot.slotIndex !== n || !Number.isFinite(slot.x) || slot.x < right || !positive(slot.width) || slot.x + slot.width > rack.width)
            fail('Invalid/overlapping slot: ' + rack.id + '/' + i + '/' + n);
          right = slot.x + slot.width;
        }
      }
    }
    for (const s of catalog.rackScopes) {
      const rack = catalog.racks.find(r => r.id === s.physicalRackId), scene = catalog.scenes.find(scene => scene.id === rack?.sceneId);
      if (!rack || !scopedSub(s) || !scene?.organizationIds.includes(s.organizationId)) fail('Invalid rack scope: ' + s.physicalRackId);
    }
    for (const l of catalog.locators) {
      if (scopedSub(l)?.locatorEnabled !== true || ![true, false, null].includes(l.enabled) ||
        typeof l.locatorCode !== 'string' || !l.locatorCode || !['rack', 'row', 'bin'].every(k => typeof l.segments?.[k] === 'string') ||
        !['standard', 'pallet', 'unknown'].includes(l.storageMode)) fail('Invalid Locator scope/status: ' + l.locatorId);
    }
    unique(catalog.mappings, m => m.locatorId, 'Locator mapping');
    unique(catalog.mappings, m => JSON.stringify([m.physicalRackId, m.levelIndex, m.slotIndex, m.side, m.depthIndex]), 'physical slot mapping');
    for (const m of catalog.mappings) {
      const l = catalog.locators.find(l => l.locatorId === m.locatorId), rack = catalog.racks.find(r => r.id === m.physicalRackId);
      const level = rack?.levels?.find(level => level.levelIndex === m.levelIndex);
      if (!l || rack?.layoutStatus !== 'configured' || !Number.isInteger(m.levelIndex) || !Number.isInteger(m.slotIndex) ||
        !level?.slots?.some(slot => slot.slotIndex === m.slotIndex) || m.side !== 'front' || m.depthIndex !== 0)
        fail('Mapping out of bounds/unsupported: ' + m.locatorId);
      if (l && !catalog.rackScopes.some(s => s.physicalRackId === m.physicalRackId && inScope(s, l))) fail('Mapping scope mismatch: ' + m.locatorId);
    }
    function validInventoryScope(value) {
      const sub = scopedSub(value);
      return sub && (value.locatorId === null ? sub.locatorEnabled !== true :
        catalog.locators.some(l => l.locatorId === value.locatorId && inScope(l, value)));
    }
    for (const line of catalog.inventoryLines) {
      if (!validInventoryScope(line) || !Number.isFinite(line.quantity) || line.quantity < 0 || !line.uom || !line.materialId)
        fail('Invalid inventory line: ' + line.id);
    }
    for (const s of catalog.inventorySnapshots) {
      if (!validInventoryScope(s) || typeof s.complete !== 'boolean' || !Number.isFinite(Date.parse(s.asOf)) || !s.revision)
        fail('Invalid inventory snapshot: ' + s.locatorId);
    }
    const legacyEntries = Object.entries(catalog.legacyLocationMap || {});
    if (legacyEntries.length !== locations().length || locations().some(code => !catalog.legacyLocationMap?.[code]) ||
      new Set(legacyEntries.map(([, id]) => id)).size !== legacyEntries.length) fail('Incomplete or conflicting Demo legacy mapping');
    for (const [code, id] of legacyEntries) {
      if (!catalog.locators.some(l => l.locatorId === id && inScope(l, catalog.legacyScope)) || !catalog.mappings.some(m => m.locatorId === id))
        fail('Invalid Demo legacy mapping: ' + code);
    }
    for (const rack of catalog.racks) if (catalog.overviewRackMap?.[rack.overviewRackId] !== rack.id) fail('Missing overview rack mapping: ' + rack.id);
    return {valid: !errors.length, errors};
  }
  function getLocatorMapping(scope, catalog = rackData) {
    const locator = listLocators(scope, catalog).find(l => l.locatorId === scope.locatorId);
    if (!locator || !validateRackCatalog(catalog).valid) return null;
    const mapping = catalog.mappings.find(m => m.locatorId === locator.locatorId);
    return mapping ? copy(mapping) : null;
  }
  function inventoryProjection(scope, state, catalog) {
    if (state?.version === VERSION) return {
      lines: state.inventoryLines.filter(l => inScope(l, scope) && l.mappingStatus !== 'unresolved'),
      unresolvedLines: state.inventoryLines.filter(l => inScope(l, scope) && l.mappingStatus === 'unresolved'), legacyOverlay: false
    };
    let lines = catalog.inventoryLines.filter(l => inScope(l, scope));
    const unresolvedLines = [];
    // v1 overlay is a read projection. Stable pallet IDs replace catalog seeds exactly once.
    if (state && inScope(catalog.legacyScope, scope)) {
      for (const job of state.jobs) for (const pallet of job.pallets) {
        lines = lines.filter(l => l.palletId !== pallet.id);
        if (!pallet.destination) continue;
        const locatorId = catalog.legacyLocationMap[pallet.destination];
        const line = {id: 'inv-demo-v1-' + pallet.id, ...catalog.legacyScope, locatorId: locatorId || null,
          materialId: job.material, materialName: job.materialName, lot: job.batch, palletId: pallet.id,
          quantity: pallet.qty, uom: 'PCS', asOf: pallet.putawayAt || null, source: 'Demo v1 compatibility',
          legacyDestination: pallet.destination, mappingStatus: locatorId ? 'mapped' : 'unresolved'};
        if (locatorId) lines.push(line); else unresolvedLines.push(line);
      }
    }
    return {lines, unresolvedLines, legacyOverlay: !!state && inScope(catalog.legacyScope, scope)};
  }
  function inventorySnapshot(scope, projection, catalog, validation) {
    const sub = catalog.subinventories.find(s => s.id === scope.subinventoryId);
    const lines = projection.lines.filter(l => inScope(l, scope) && l.locatorId === scope.locatorId);
    const unresolvedLines = projection.unresolvedLines.filter(l => inScope(l, scope));
    const snapshot = catalog.inventorySnapshots.find(s => inScope(s, scope) && s.locatorId === scope.locatorId);
    const complete = !!snapshot?.complete && !unresolvedLines.length && validation.valid && sub.locatorEnabled !== null;
    const times = [snapshot?.asOf, ...lines.map(l => l.asOf)].filter(t => Number.isFinite(Date.parse(t)));
    const asOf = times.length ? times.reduce((a, b) => Date.parse(a) >= Date.parse(b) ? a : b) : null;
    return copy({inventoryLines: lines, unresolvedLines, complete, asOf,
      revision: projection.legacyOverlay && inScope(scope, catalog.legacyScope) ? (snapshot?.revision || catalog.revision) + '+v1' : snapshot?.revision || null,
      source: 'Demo', nextCursor: null, errors: validation.errors});
  }
  function pageItems(items, scope) {
    const start = scope.cursor ? Number(scope.cursor) : 0, size = scope.pageSize ?? 50;
    if (!Number.isInteger(start) || start < 0 || !Number.isInteger(size) || size < 1 || size > 500)
      throw new Error('Invalid pagination.');
    return {items: items.slice(start, start + size), nextCursor: start + size < items.length ? String(start + size) : null};
  }
  function getLocatorInventory(scope, state, catalog = rackData) {
    requireScope(scope, catalog);
    const sub = catalog.subinventories.find(s => s.id === scope.subinventoryId);
    const locator = catalog.locators.find(l => l.locatorId === scope.locatorId && inScope(l, scope));
    if ((!locator && scope.locatorId !== null) || (scope.locatorId === null && sub.locatorEnabled === true)) throw new Error('Locator not found in this scope.');
    const result = inventorySnapshot(scope, inventoryProjection(scope, state, catalog), catalog, validateRackCatalog(catalog));
    const q = String(scope.query || '').trim().toUpperCase();
    const page = pageItems(result.inventoryLines.filter(l => !q || (scope.queryType === 'material' ? [l.materialId,l.materialName] :
      scope.queryType === 'pallet' ? [l.palletId] : [l.materialId,l.materialName,l.palletId]).some(v => String(v || '').toUpperCase().includes(q))), scope);
    return {...result, inventoryLines: page.items, nextCursor: page.nextCursor, filtered: !!q};
  }
  function locatorState(locator, inventory) {
    return {locatorId: locator.locatorId, availability: locator.enabled === true ? 'active' : locator.enabled === false ? 'blocked' : 'unknown',
      occupancy: !inventory.complete ? 'unknown' : inventory.inventoryLines.some(line => line.quantity > 0) ? 'occupied' : 'empty',
      eligibility: 'unchecked', reasons: locator.enabled === false ? ['Disabled (Demo)'] : [], capacity: null,
      complete: inventory.complete, asOf: inventory.asOf, revision: inventory.revision};
  }
  function summarizeLocations(locations, complete = true) {
    const states = locations.map(l => l.state), active = states.filter(s => s.availability === 'active');
    const known = complete && states.every(s => s.complete && s.availability !== 'unknown') && active.every(s => s.occupancy !== 'unknown');
    const occupied = active.filter(s => s.occupancy === 'occupied').length;
    return {total: locations.length, mapped: locations.filter(l => l.mapping).length, unmapped: locations.filter(l => !l.mapping).length,
      occupied: states.filter(s => s.occupancy === 'occupied').length, empty: states.filter(s => s.occupancy === 'empty').length,
      disabled: states.filter(s => s.availability === 'blocked').length,
      unknown: states.filter(s => s.occupancy === 'unknown' || s.availability === 'unknown').length,
      active: active.length, activeOccupied: occupied, complete: known,
      occupancyRatio: !known || !active.length ? null : occupied / active.length};
  }
  function searchLocations(scope, state, catalog = rackData) {
    requireScope(scope, catalog, false);
    const validation = validateRackCatalog(catalog), projection = inventoryProjection(scope, state, catalog);
    const locations = catalog.locators.filter(l => inScope(l, scope)).map(locator => {
      const inventory = inventorySnapshot({...locator}, projection, catalog, validation);
      const mapping = validation.valid ? catalog.mappings.find(m => m.locatorId === locator.locatorId) || null : null;
      return {...locator, mapping, state: locatorState(locator, inventory)};
    });
    const q = String(scope.query || '').trim().toUpperCase();
    const results = locations.filter(l => {
      const lines = projection.lines.filter(line => line.locatorId === l.locatorId && inScope(line, l));
      const fields = scope.queryType === 'material' ? lines.flatMap(line => [line.materialId, line.materialName]) :
        scope.queryType === 'pallet' ? lines.map(line => line.palletId) : scope.queryType === 'locator' ? [l.locatorCode] :
        [l.locatorCode, ...lines.flatMap(line => [line.materialId, line.materialName, line.palletId])];
      // Invalid geometry still permits a list of explicitly associated Locators, without coordinates.
      const onRack = l.mapping?.physicalRackId === scope.physicalRackId || (!validation.valid &&
        catalog.mappings.some(m => m.locatorId === l.locatorId && m.physicalRackId === scope.physicalRackId));
      return (!scope.physicalRackId || onRack) &&
        (scope.levelIndex === undefined || l.mapping?.levelIndex === Number(scope.levelIndex)) &&
        (!scope.status || (scope.status === 'disabled' ? l.state.availability === 'blocked' : scope.status === 'unknown' ?
          l.state.occupancy === 'unknown' || l.state.availability === 'unknown' : l.state.occupancy === scope.status)) &&
        (!q || fields.some(value => String(value || '').toUpperCase().includes(q)));
    });
    const page = pageItems(results, scope);
    const scopeComplete = validation.valid && !projection.unresolvedLines.length &&
      !catalog.subinventories.some(s => inScope({organizationId:s.organizationId,subinventoryId:s.id}, scope) && s.locatorEnabled === null);
    return copy({locations: page.items, nextCursor: page.nextCursor, total: results.length,
      summary: summarizeLocations(locations, scopeComplete),
      unresolvedLines: projection.unresolvedLines, asOf: [catalog.asOf, ...projection.lines.map(l => l.asOf)].filter(Boolean)
        .reduce((a, b) => Date.parse(a) > Date.parse(b) ? a : b, catalog.asOf),
      complete: scopeComplete && locations.every(l => l.state.complete),
      revision: catalog.revision, source: 'Demo', errors: validation.errors});
  }
  function getRackDetail(scope, state, catalog = rackData) {
    const rack = listRacks(scope, catalog).find(r => r.id === scope.physicalRackId);
    if (!rack) return null;
    const validation = validateRackCatalog(catalog);
    const mappings = validation.valid ? catalog.mappings.filter(m => m.physicalRackId === rack.id &&
      catalog.locators.some(l => l.locatorId === m.locatorId && inScope(l, scope))) : [];
    const locators = catalog.locators.filter(l => mappings.some(m => m.locatorId === l.locatorId));
    const projection = inventoryProjection(scope, state, catalog);
    const states = locators.map(l => locatorState(l, inventorySnapshot(l, projection, catalog, validation)));
    return copy({rack, locators, mappings, states, errors: validation.errors,
      complete: rack.layoutStatus === 'configured' && validation.valid && states.every(s => s.complete),
      asOf: states.length ? states.reduce((a, s) => !a || Date.parse(s.asOf) > Date.parse(a) ? s.asOf : a, null) : catalog.asOf,
      revision: catalog.revision, source: 'Demo'});
  }
  function locationPoint(value, catalog = rackData) {
    const locatorId = catalog.legacyLocationMap[value] || value;
    const mapping = getLocatorMapping({...catalog.legacyScope, locatorId}, catalog);
    const rack = catalog.racks.find(r => r.id === mapping?.physicalRackId);
    const level = rack?.levels[mapping?.levelIndex], slot = level?.slots[mapping?.slotIndex];
    return slot ? {x: rack.overviewPosition.x + slot.x + slot.width / 2,
      y: rack.overviewPosition.y + rack.depth / 2, z: rack.overviewPosition.z + level.baseZ} : null;
  }
  const api = {VERSION, STORAGE_KEY, LEGACY_STORAGE_KEY, INITIALIZED_KEY, loadState, saveState, migrateV1, isPutaway, destinationLabel, locationPoint, createState, getJob, totals, stage, status, locations, validateLocation,
    listRacks, listLocators, validateRackCatalog, getLocatorMapping, getLocatorInventory, getRackDetail, searchLocations, summarizeLocations,
    suggestLocation, currentPallet, recordUnload, confirmPutaway, validatePutawayContext, validatePutawayTarget, taskVersion, resolveDestination, reportException, searchJobs, serialize, restore};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WarehouseModel = api;
})(typeof window !== 'undefined' ? window : globalThis);

