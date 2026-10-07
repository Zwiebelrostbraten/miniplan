import { describe, expect, it } from 'vitest';
import { serviceView } from '../src/core/service-view.js';

describe('service display filter', () => {
  const services = [{ location: 'Kirche STRASSE' }, { location: 'Andere' }, { location: 'extern' }, { location: 'Dorffest' }];
  it('folds German case and ß, trims the parish and retains source indices', () => {
    expect(serviceView(services, ' Straße ', false)).toEqual([{ service: services[0], index: 0 }]);
    expect(serviceView(services, 'andere', false)).toEqual([{ service: services[1], index: 1 }]);
    expect(services).toHaveLength(4);
  });
  it('shows nothing for empty or unmatched parish unless all locations are requested', () => {
    expect(serviceView(services, ' ', false)).toEqual([]);
    expect(serviceView(services, 'unbekannt', false)).toEqual([]);
    expect(serviceView(services, '', true).map(({ service }) => service)).toEqual(services);
  });
  it('keeps filtering separate from the five-row preview', () => {
    const rows = Array.from({ length: 8 }, () => ({ location: 'Straße' }));
    expect(serviceView(rows, 'STRASSE', false)).toHaveLength(8);
  });
});
