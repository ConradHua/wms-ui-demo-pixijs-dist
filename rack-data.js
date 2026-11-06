/* Read-only Demo catalog. These IDs, codes and scene-unit dimensions are not production master data. */
(function (root) {
  'use strict';
  const asOf = '2026-10-29T10:00:00+08:00', revision = 'demo-r2';
  const org = 'org-wh-demo', sub = 'si-gs-demo';
  const racks = ['A', 'B', 'C'].flatMap((row, r) => Array.from({length: 7}, (_, bay) => ({
    id: 'rack-demo-' + row.toLowerCase() + String(bay + 1).padStart(2, '0'), sceneId: 'scene-demo',
    overviewRackId: row + '-' + String(bay + 1).padStart(2, '0'), label: row + '-' + String(bay + 1).padStart(2, '0') + ' (Demo)',
    overviewPosition: {x: 225 + bay * 100, y: 125 + r * 160, z: 0},
    layoutStatus: 'pending', layoutNote: '布局待配置 (Demo)', width: null, depth: null, levels: []
  })));
  // Demo migration layout: each of the other 19 racks has four explicitly numbered levels.
  // This is authored sample master data, not a parser for production location codes.
  for (const rack of racks.filter(r => !['B-02', 'B-03'].includes(r.overviewRackId))) {
    Object.assign(rack, {layoutStatus: 'configured', layoutNote: '迁移示例布局 (Demo)', width: 90, depth: 52,
      levels: [0, 1, 2, 3].map(levelIndex => ({levelIndex, baseZ: 8 + levelIndex * 38, height: 32,
        slots: [{slotIndex: 0, x: 0, width: 90}]}))});
  }
  const b02 = racks.find(r => r.overviewRackId === 'B-02'), b03 = racks.find(r => r.overviewRackId === 'B-03');
  Object.assign(b02, {layoutStatus: 'configured', layoutNote: '示意尺寸 (Demo)', width: 90, depth: 52,
    levels: [0, 1, 2, 3].map(levelIndex => ({levelIndex, baseZ: 8 + levelIndex * 38, height: 32,
      slots: [{slotIndex: 0, x: 0, width: 30}, {slotIndex: 1, x: 30, width: 60}]}))});
  Object.assign(b03, {layoutStatus: 'configured', layoutNote: '示意尺寸 (Demo)', width: 100, depth: 50,
    levels: [
      {levelIndex: 0, baseZ: 10, height: 35, slots: [{slotIndex: 0, x: 0, width: 60}, {slotIndex: 1, x: 60, width: 40}]},
      {levelIndex: 1, baseZ: 50, height: 40, slots: [{slotIndex: 0, x: 0, width: 100}]},
      {levelIndex: 2, baseZ: 95, height: 35, slots: [{slotIndex: 0, x: 0, width: 25}, {slotIndex: 1, x: 25, width: 25}, {slotIndex: 2, x: 50, width: 50}]}
    ]});
  const locators = [], mappings = [];
  function locator(id, code, rack, row, bin, enabled = true, storageMode = 'standard', specialPalletNumber = null,
    organizationId = org, subinventoryId = sub) {
    locators.push({locatorId: id, sourceLocatorId: id.replace('loc-demo-', ''), organizationId, subinventoryId,
      locatorCode: code, segments: {rack, row, bin}, enabled, storageMode, specialPalletNumber});
    return id;
  }
  function map(locatorId, physicalRackId, levelIndex, slotIndex) {
    mappings.push({locatorId, physicalRackId, levelIndex, slotIndex, side: 'front', depthIndex: 0});
  }
  const legacyLocationMap = {};
  // Explicit Demo decisions for the two detailed racks; no legacy code parsing in the reader.
  for (const [i, row] of ['01', '03', '07', '10'].entries()) {
    const id = locator('loc-demo-b02-' + row, 'R02.' + row + '.01', 'R02', row, '01');
    map(id, b02.id, i, 0); legacyLocationMap['B-02-0' + (i + 1)] = id;
  }
  for (const [i, row] of ['02', '09', '20'].entries()) {
    const id = locator('loc-demo-b03-' + row, 'R03.' + row + '.01', 'R03', row, '01');
    map(id, b03.id, i, 0); legacyLocationMap['B-03-0' + (i + 1)] = id;
  }
  // B-03-04 deliberately uses the former unconfigured third slot on Row 20.
  // Preserve the three-level sample; the old suffix is not interpreted as a new level index.
  map(locator('loc-demo-b03-20-03', 'R03.20.03', 'R03', '20', '03'), b03.id, 2, 2);
  legacyLocationMap['B-03-04'] = 'loc-demo-b03-20-03';
  map(locator('loc-demo-blocked', 'R03.02.02', 'R03', '02', '02', false), b03.id, 0, 1);
  map(locator('loc-demo-unknown', 'R03.20.02', 'R03', '20', '02', null), b03.id, 2, 1);
  map(locator('loc-demo-special', 'OnSemi/007-A', 'R02', '03', 'P-007', true, 'pallet', '007-A'), b02.id, 1, 1);
  locator('loc-demo-unmapped', 'Dialog:PAL?0042', 'RAW-R', 'X', '0042', true, 'pallet', null);
  locator('loc-demo-other-org', 'R03.02.01', 'R03', '02', '01', true, 'standard', null, 'org-other-demo', 'si-other-gs-demo');
  map('loc-demo-other-org', b02.id, 0, 1);
  locator('loc-demo-other-sub', 'R03.02.01', 'R03', '02', '01', true, 'standard', null, org, 'si-wip-demo');
  // Complete authored compatibility table: old code, physical rack, level, slot, ID, code, segments.
  // Runtime readers only look up these decisions; no old-code coordinate inference.
  const legacyPlacements = [
    ['A-01-01', 'rack-demo-a01', 0, 0, 'loc-demo-a01-01', 'DEMO.A01.01.01', 'A01', '01', '01'],
    ['A-01-02', 'rack-demo-a01', 1, 0, 'loc-demo-a01-02', 'DEMO.A01.02.01', 'A01', '02', '01'],
    ['A-01-03', 'rack-demo-a01', 2, 0, 'loc-demo-a01-03', 'DEMO.A01.03.01', 'A01', '03', '01'],
    ['A-01-04', 'rack-demo-a01', 3, 0, 'loc-demo-a01-04', 'DEMO.A01.04.01', 'A01', '04', '01'],
    ['A-02-01', 'rack-demo-a02', 0, 0, 'loc-demo-a02-01', 'DEMO.A02.01.01', 'A02', '01', '01'],
    ['A-02-02', 'rack-demo-a02', 1, 0, 'loc-demo-a02-02', 'DEMO.A02.02.01', 'A02', '02', '01'],
    ['A-02-03', 'rack-demo-a02', 2, 0, 'loc-demo-a02-03', 'DEMO.A02.03.01', 'A02', '03', '01'],
    ['A-02-04', 'rack-demo-a02', 3, 0, 'loc-demo-a02-04', 'DEMO.A02.04.01', 'A02', '04', '01'],
    ['A-03-01', 'rack-demo-a03', 0, 0, 'loc-demo-a03-01', 'DEMO.A03.01.01', 'A03', '01', '01'],
    ['A-03-02', 'rack-demo-a03', 1, 0, 'loc-demo-a03-02', 'DEMO.A03.02.01', 'A03', '02', '01'],
    ['A-03-03', 'rack-demo-a03', 2, 0, 'loc-demo-a03-03', 'DEMO.A03.03.01', 'A03', '03', '01'],
    ['A-03-04', 'rack-demo-a03', 3, 0, 'loc-demo-a03-04', 'DEMO.A03.04.01', 'A03', '04', '01'],
    ['A-04-01', 'rack-demo-a04', 0, 0, 'loc-demo-a04-01', 'DEMO.A04.01.01', 'A04', '01', '01'],
    ['A-04-02', 'rack-demo-a04', 1, 0, 'loc-demo-a04-02', 'DEMO.A04.02.01', 'A04', '02', '01'],
    ['A-04-03', 'rack-demo-a04', 2, 0, 'loc-demo-a04-03', 'DEMO.A04.03.01', 'A04', '03', '01'],
    ['A-04-04', 'rack-demo-a04', 3, 0, 'loc-demo-a04-04', 'DEMO.A04.04.01', 'A04', '04', '01'],
    ['A-05-01', 'rack-demo-a05', 0, 0, 'loc-demo-a05-01', 'DEMO.A05.01.01', 'A05', '01', '01'],
    ['A-05-02', 'rack-demo-a05', 1, 0, 'loc-demo-a05-02', 'DEMO.A05.02.01', 'A05', '02', '01'],
    ['A-05-03', 'rack-demo-a05', 2, 0, 'loc-demo-a05-03', 'DEMO.A05.03.01', 'A05', '03', '01'],
    ['A-05-04', 'rack-demo-a05', 3, 0, 'loc-demo-a05-04', 'DEMO.A05.04.01', 'A05', '04', '01'],
    ['A-06-01', 'rack-demo-a06', 0, 0, 'loc-demo-a06-01', 'DEMO.A06.01.01', 'A06', '01', '01'],
    ['A-06-02', 'rack-demo-a06', 1, 0, 'loc-demo-a06-02', 'DEMO.A06.02.01', 'A06', '02', '01'],
    ['A-06-03', 'rack-demo-a06', 2, 0, 'loc-demo-a06-03', 'DEMO.A06.03.01', 'A06', '03', '01'],
    ['A-06-04', 'rack-demo-a06', 3, 0, 'loc-demo-a06-04', 'DEMO.A06.04.01', 'A06', '04', '01'],
    ['A-07-01', 'rack-demo-a07', 0, 0, 'loc-demo-a07-01', 'DEMO.A07.01.01', 'A07', '01', '01'],
    ['A-07-02', 'rack-demo-a07', 1, 0, 'loc-demo-a07-02', 'DEMO.A07.02.01', 'A07', '02', '01'],
    ['A-07-03', 'rack-demo-a07', 2, 0, 'loc-demo-a07-03', 'DEMO.A07.03.01', 'A07', '03', '01'],
    ['A-07-04', 'rack-demo-a07', 3, 0, 'loc-demo-a07-04', 'DEMO.A07.04.01', 'A07', '04', '01'],
    ['B-01-01', 'rack-demo-b01', 0, 0, 'loc-demo-b01-01', 'DEMO.B01.01.01', 'B01', '01', '01'],
    ['B-01-02', 'rack-demo-b01', 1, 0, 'loc-demo-b01-02', 'DEMO.B01.02.01', 'B01', '02', '01'],
    ['B-01-03', 'rack-demo-b01', 2, 0, 'loc-demo-b01-03', 'DEMO.B01.03.01', 'B01', '03', '01'],
    ['B-01-04', 'rack-demo-b01', 3, 0, 'loc-demo-b01-04', 'DEMO.B01.04.01', 'B01', '04', '01'],
    ['B-04-01', 'rack-demo-b04', 0, 0, 'loc-demo-b04-01', 'DEMO.B04.01.01', 'B04', '01', '01'],
    ['B-04-02', 'rack-demo-b04', 1, 0, 'loc-demo-b04-02', 'DEMO.B04.02.01', 'B04', '02', '01'],
    ['B-04-03', 'rack-demo-b04', 2, 0, 'loc-demo-b04-03', 'DEMO.B04.03.01', 'B04', '03', '01'],
    ['B-04-04', 'rack-demo-b04', 3, 0, 'loc-demo-b04-04', 'DEMO.B04.04.01', 'B04', '04', '01'],
    ['B-05-01', 'rack-demo-b05', 0, 0, 'loc-demo-b05-01', 'DEMO.B05.01.01', 'B05', '01', '01'],
    ['B-05-02', 'rack-demo-b05', 1, 0, 'loc-demo-b05-02', 'DEMO.B05.02.01', 'B05', '02', '01'],
    ['B-05-03', 'rack-demo-b05', 2, 0, 'loc-demo-b05-03', 'DEMO.B05.03.01', 'B05', '03', '01'],
    ['B-05-04', 'rack-demo-b05', 3, 0, 'loc-demo-b05-04', 'DEMO.B05.04.01', 'B05', '04', '01'],
    ['B-06-01', 'rack-demo-b06', 0, 0, 'loc-demo-b06-01', 'DEMO.B06.01.01', 'B06', '01', '01'],
    ['B-06-02', 'rack-demo-b06', 1, 0, 'loc-demo-b06-02', 'DEMO.B06.02.01', 'B06', '02', '01'],
    ['B-06-03', 'rack-demo-b06', 2, 0, 'loc-demo-b06-03', 'DEMO.B06.03.01', 'B06', '03', '01'],
    ['B-06-04', 'rack-demo-b06', 3, 0, 'loc-demo-b06-04', 'DEMO.B06.04.01', 'B06', '04', '01'],
    ['B-07-01', 'rack-demo-b07', 0, 0, 'loc-demo-b07-01', 'DEMO.B07.01.01', 'B07', '01', '01'],
    ['B-07-02', 'rack-demo-b07', 1, 0, 'loc-demo-b07-02', 'DEMO.B07.02.01', 'B07', '02', '01'],
    ['B-07-03', 'rack-demo-b07', 2, 0, 'loc-demo-b07-03', 'DEMO.B07.03.01', 'B07', '03', '01'],
    ['B-07-04', 'rack-demo-b07', 3, 0, 'loc-demo-b07-04', 'DEMO.B07.04.01', 'B07', '04', '01'],
    ['C-01-01', 'rack-demo-c01', 0, 0, 'loc-demo-c01-01', 'DEMO.C01.01.01', 'C01', '01', '01'],
    ['C-01-02', 'rack-demo-c01', 1, 0, 'loc-demo-c01-02', 'DEMO.C01.02.01', 'C01', '02', '01'],
    ['C-01-03', 'rack-demo-c01', 2, 0, 'loc-demo-c01-03', 'DEMO.C01.03.01', 'C01', '03', '01'],
    ['C-01-04', 'rack-demo-c01', 3, 0, 'loc-demo-c01-04', 'DEMO.C01.04.01', 'C01', '04', '01'],
    ['C-02-01', 'rack-demo-c02', 0, 0, 'loc-demo-c02-01', 'DEMO.C02.01.01', 'C02', '01', '01'],
    ['C-02-02', 'rack-demo-c02', 1, 0, 'loc-demo-c02-02', 'DEMO.C02.02.01', 'C02', '02', '01'],
    ['C-02-03', 'rack-demo-c02', 2, 0, 'loc-demo-c02-03', 'DEMO.C02.03.01', 'C02', '03', '01'],
    ['C-02-04', 'rack-demo-c02', 3, 0, 'loc-demo-c02-04', 'DEMO.C02.04.01', 'C02', '04', '01'],
    ['C-03-01', 'rack-demo-c03', 0, 0, 'loc-demo-c03-01', 'DEMO.C03.01.01', 'C03', '01', '01'],
    ['C-03-02', 'rack-demo-c03', 1, 0, 'loc-demo-c03-02', 'DEMO.C03.02.01', 'C03', '02', '01'],
    ['C-03-03', 'rack-demo-c03', 2, 0, 'loc-demo-c03-03', 'DEMO.C03.03.01', 'C03', '03', '01'],
    ['C-03-04', 'rack-demo-c03', 3, 0, 'loc-demo-c03-04', 'DEMO.C03.04.01', 'C03', '04', '01'],
    ['C-04-01', 'rack-demo-c04', 0, 0, 'loc-demo-c04-01', 'DEMO.C04.01.01', 'C04', '01', '01'],
    ['C-04-02', 'rack-demo-c04', 1, 0, 'loc-demo-c04-02', 'DEMO.C04.02.01', 'C04', '02', '01'],
    ['C-04-03', 'rack-demo-c04', 2, 0, 'loc-demo-c04-03', 'DEMO.C04.03.01', 'C04', '03', '01'],
    ['C-04-04', 'rack-demo-c04', 3, 0, 'loc-demo-c04-04', 'DEMO.C04.04.01', 'C04', '04', '01'],
    ['C-05-01', 'rack-demo-c05', 0, 0, 'loc-demo-c05-01', 'DEMO.C05.01.01', 'C05', '01', '01'],
    ['C-05-02', 'rack-demo-c05', 1, 0, 'loc-demo-c05-02', 'DEMO.C05.02.01', 'C05', '02', '01'],
    ['C-05-03', 'rack-demo-c05', 2, 0, 'loc-demo-c05-03', 'DEMO.C05.03.01', 'C05', '03', '01'],
    ['C-05-04', 'rack-demo-c05', 3, 0, 'loc-demo-c05-04', 'DEMO.C05.04.01', 'C05', '04', '01'],
    ['C-06-01', 'rack-demo-c06', 0, 0, 'loc-demo-c06-01', 'DEMO.C06.01.01', 'C06', '01', '01'],
    ['C-06-02', 'rack-demo-c06', 1, 0, 'loc-demo-c06-02', 'DEMO.C06.02.01', 'C06', '02', '01'],
    ['C-06-03', 'rack-demo-c06', 2, 0, 'loc-demo-c06-03', 'DEMO.C06.03.01', 'C06', '03', '01'],
    ['C-06-04', 'rack-demo-c06', 3, 0, 'loc-demo-c06-04', 'DEMO.C06.04.01', 'C06', '04', '01'],
    ['C-07-01', 'rack-demo-c07', 0, 0, 'loc-demo-c07-01', 'DEMO.C07.01.01', 'C07', '01', '01'],
    ['C-07-02', 'rack-demo-c07', 1, 0, 'loc-demo-c07-02', 'DEMO.C07.02.01', 'C07', '02', '01'],
    ['C-07-03', 'rack-demo-c07', 2, 0, 'loc-demo-c07-03', 'DEMO.C07.03.01', 'C07', '03', '01'],
    ['C-07-04', 'rack-demo-c07', 3, 0, 'loc-demo-c07-04', 'DEMO.C07.04.01', 'C07', '04', '01']
  ];
  for (const [oldCode, rackId, level, slot, id, code, rack, row, bin] of legacyPlacements) {
    locator(id, code, rack, row, bin); map(id, rackId, level, slot); legacyLocationMap[oldCode] = id;
  }
  const inventoryLines = [];
  function line(id, locatorId, palletId, quantity, materialId = 'MAT-DEMO-01', lot = 'LOT-DEMO-01', uom = 'PCS', organizationId = org, subinventoryId = sub) {
    inventoryLines.push({id, organizationId, subinventoryId, locatorId, materialId, materialName: materialId + ' (Demo)',
      lot, palletId, quantity, uom, asOf, source: 'Demo catalog'});
  }
  line('inv-demo-seed-4279', 'loc-demo-b03-02', 'PAL-004279', 400, 'MAT-2048', 'B261027');
  line('inv-demo-seed-4280', 'loc-demo-b02-10', 'PAL-004280', 400, 'MAT-2048', 'B261027');
  line('inv-demo-extra-1', 'loc-demo-b03-02', 'PAL-DEMO-01', 120);
  line('inv-demo-extra-2', 'loc-demo-b03-02', 'PAL-DEMO-02', 50, 'MAT-DEMO-02', 'LOT-DEMO-02');
  line('inv-demo-extra-3', 'loc-demo-b03-02', 'PAL-DEMO-03', 2, 'MAT-DEMO-01', 'LOT-DEMO-03', 'BOX');
  line('inv-demo-blocked', 'loc-demo-blocked', 'PAL-DEMO-BLOCK', 5);
  line('inv-demo-special', 'loc-demo-special', 'PAL-DEMO-SPECIAL', 80);
  line('inv-demo-unmapped', 'loc-demo-unmapped', 'PAL-DEMO-UNMAPPED', 60);
  line('inv-demo-other-org', 'loc-demo-other-org', 'PAL-DEMO-OTHER', 999, 'MAT-DEMO-01', 'LOT-DEMO-01', 'PCS', 'org-other-demo', 'si-other-gs-demo');
  line('inv-demo-other-sub', 'loc-demo-other-sub', 'PAL-DEMO-WIP', 8, 'MAT-DEMO-01', 'LOT-DEMO-01', 'PCS', org, 'si-wip-demo');
  line('inv-demo-no-locator', null, 'PAL-DEMO-BULK', 200, 'MAT-DEMO-01', 'LOT-DEMO-01', 'PCS', org, 'si-bulk-demo');
  const subinventories = [
    {id: sub, organizationId: org, code: 'GS', name: 'GS (Demo)', locatorEnabled: true},
    {id: 'si-wip-demo', organizationId: org, code: 'WIP', name: 'WIP (Demo)', locatorEnabled: true},
    {id: 'si-bulk-demo', organizationId: org, code: 'BULK', name: '无 Locator (Demo)', locatorEnabled: false},
    {id: 'si-unknown-demo', organizationId: org, code: 'UNKNOWN', name: '配置待确认 (Demo)', locatorEnabled: null},
    {id: 'si-empty-demo', organizationId: org, code: 'EMPTY', name: '启用但无货位 (Demo)', locatorEnabled: true},
    {id: 'si-other-gs-demo', organizationId: 'org-other-demo', code: 'GS', name: 'GS (Demo, other organization)', locatorEnabled: true}
  ];
  const inventorySnapshots = locators.map(l => ({organizationId: l.organizationId, subinventoryId: l.subinventoryId,
    locatorId: l.locatorId, asOf, revision, complete: l.locatorId !== 'loc-demo-unknown'}));
  for (const s of subinventories.filter(s => s.locatorEnabled !== true))
    inventorySnapshots.push({organizationId: s.organizationId, subinventoryId: s.id, locatorId: null,
      asOf, revision, complete: s.locatorEnabled === false});
  const catalog = {
    demo: true, source: 'Demo catalog', asOf, revision,
    scenes: [{id: 'scene-demo', name: 'Warehouse (Demo)', organizationIds: [org, 'org-other-demo'], racks: racks.map(r => r.id)}],
    organizations: [{id: org, code: 'WH', name: 'Warehouse (Demo)'}, {id: 'org-other-demo', code: 'OTHER', name: 'Other organization (Demo)'}],
    subinventories, racks, locators, mappings, inventoryLines, inventorySnapshots,
    overviewRackMap: Object.fromEntries(racks.map(r => [r.overviewRackId, r.id])),
    rackScopes: [...racks.map(r => ({physicalRackId: r.id, organizationId: org, subinventoryId: sub})),
      {physicalRackId: b02.id, organizationId: 'org-other-demo', subinventoryId: 'si-other-gs-demo'}],
    legacyScope: {organizationId: org, subinventoryId: sub}, legacyLocationMap
  };
  function freeze(value) { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(value); }
  freeze(catalog);
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog; else root.WarehouseRackData = catalog;
})(typeof window !== 'undefined' ? window : globalThis);
