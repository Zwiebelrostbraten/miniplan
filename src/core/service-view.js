import { fold } from './normalize.js';

export function serviceView(services, parish, showAll) {
  const needle = fold(parish.trim());
  return services.map((service, index) => ({ service, index }))
    .filter(({ service }) => showAll || (needle && fold(service.location ?? '').includes(needle)));
}
