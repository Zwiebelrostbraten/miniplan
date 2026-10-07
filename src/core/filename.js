const UNSAFE_FILENAME = /[<>:"/\\|?*]/g;

export function miniplanFilename(parish, first, last, format) {
  const title = `${parish} - Miniplan vom ${first} - ${last}`;
  const safeTitle = [...title].map((character) => character.charCodeAt(0) < 32 ? '_' : character).join('');
  return `${safeTitle.replace(UNSAFE_FILENAME, '_')}.${format}`;
}
